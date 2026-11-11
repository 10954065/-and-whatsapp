import { z } from "zod";
import { META_FREE_REPLIES_PER_MONTH } from "@/config/whatsapp-fees";
import type { Channel, Integration } from "@/generated/prisma/client";
import { prisma } from "@/lib/db/prisma";
import { withTenantTx } from "@/lib/db/tenant";
import { env } from "@/lib/env";
import type { TenantActor } from "@/lib/auth/tenant";
import { fail } from "@/lib/monitoring/errors";
import { decryptJson, encryptJson, hashToken, randomToken } from "@/lib/security/crypto";
import { recordAudit } from "@/modules/administration/audit.service";
import { getPlanLimits } from "@/modules/billing/usage";
import {
  exchangeInstagramCode,
  getInstagramProfile,
  getWhatsAppPhoneNumber,
  instagramAuthorizeUrl,
  subscribeInstagramWebhooks,
} from "@/modules/integrations/meta";

export interface ChannelCredentials {
  accessToken: string;
}

export const whatsappConnectSchema = z.object({
  phoneNumberId: z.string().trim().regex(/^\d{6,30}$/, "The phone number ID is a long number from WhatsApp Manager."),
  wabaId: z.string().trim().regex(/^\d{6,30}$/, "The WhatsApp Business Account ID is a long number."),
  accessToken: z.string().trim().min(20, "Paste the permanent system-user access token.").max(1_000),
  metaFeesAcknowledged: z.literal("on", { error: "Confirm that you understand Meta's WhatsApp fees." }),
});

export function credentialsFor(integration: Pick<Integration, "credentialsEnc">): ChannelCredentials {
  if (!integration.credentialsEnc) throw fail.precondition("This channel has no stored credentials.");
  return decryptJson<ChannelCredentials>(integration.credentialsEnc);
}

export async function listIntegrations(businessId: string) {
  return prisma.integration.findMany({ where: { businessId }, orderBy: { createdAt: "asc" } });
}

async function assertChannelAllowance(businessId: string): Promise<void> {
  const [limits, connected] = await Promise.all([
    getPlanLimits(businessId),
    prisma.integration.count({ where: { businessId, status: "CONNECTED", channel: { not: "SANDBOX" } } }),
  ]);
  if (connected >= limits.channels) throw fail.limitExceeded(`Your plan allows ${limits.channels} connected channel(s). Upgrade to add more.`);
}

async function upsertIntegration(
  actor: TenantActor,
  channel: Channel,
  externalAccountId: string,
  data: { externalAccountName?: string | null; displayHandle?: string | null; wabaId?: string | null; credentialsEnc?: string | null; tokenExpiresAt?: Date | null; scopes?: string[] },
  auditMetadata: Record<string, unknown> = {},
): Promise<Integration> {
  const existing = await prisma.integration.findUnique({ where: { channel_externalAccountId: { channel, externalAccountId } } });
  if (existing && existing.businessId !== actor.businessId) {
    throw fail.conflict("This account is already connected to another SUNLEON AI workspace.");
  }
  const integration = await withTenantTx(actor.businessId, async (tx) => {
    const saved = existing
      ? await tx.integration.update({ where: { id: existing.id }, data: { ...data, status: "CONNECTED", lastError: null, lastErrorAt: null, lastHealthCheckAt: new Date() } })
      : await tx.integration.create({
          data: { businessId: actor.businessId, channel, externalAccountId, status: "CONNECTED", connectedById: actor.userId, lastHealthCheckAt: new Date(), scopes: [], ...data },
        });
    await recordAudit(
      { businessId: actor.businessId, actorType: "USER", actorId: actor.userId, action: "integration.connected", entityType: "Integration", entityId: saved.id, metadata: { channel, ...auditMetadata } },
      tx,
    );
    return saved;
  });
  return integration;
}

/**
 * Connects a WhatsApp Cloud API number with a system-user token. The token is verified
 * against the Graph API before anything is stored, and stored only encrypted.
 */
export async function connectWhatsApp(actor: TenantActor, input: z.infer<typeof whatsappConnectSchema>): Promise<Integration> {
  if (!actor.emailVerified) throw fail.precondition("Confirm your email address before connecting channels.");
  await assertChannelAllowance(actor.businessId);
  let phone;
  try {
    phone = await getWhatsAppPhoneNumber(input.phoneNumberId, { accessToken: input.accessToken });
  } catch (error) {
    throw fail.validation(`WhatsApp rejected these details: ${(error as Error).message}`);
  }
  return upsertIntegration(
    actor,
    "WHATSAPP",
    input.phoneNumberId,
    {
      externalAccountName: phone.verified_name,
      displayHandle: phone.display_phone_number,
      wabaId: input.wabaId,
      credentialsEnc: encryptJson({ accessToken: input.accessToken } satisfies ChannelCredentials),
    },
    // Proof the owner saw Meta's fees, and the free allowance they were shown.
    { metaFeesAcknowledged: true, metaFreeRepliesShown: META_FREE_REPLIES_PER_MONTH },
  );
}

/** A private test channel: messages are simulated in the inbox and never leave SUNLEON AI. */
export async function connectSandbox(actor: TenantActor): Promise<Integration> {
  return upsertIntegration(actor, "SANDBOX", `sandbox-${actor.businessId}`, { externalAccountName: "Test channel", displayHandle: "Sandbox" });
}

export function instagramRedirectUri(): string {
  return `${env().APP_URL}/api/integrations/instagram/callback`;
}

/** Starts Instagram Login: stores a hashed one-time state bound to user + business. */
export async function startInstagramConnect(actor: TenantActor): Promise<string> {
  if (!actor.emailVerified) throw fail.precondition("Confirm your email address before connecting channels.");
  await assertChannelAllowance(actor.businessId);
  const state = randomToken(24);
  await prisma.oAuthState.create({
    data: { stateHash: hashToken(state), userId: actor.userId, businessId: actor.businessId, provider: "instagram", expiresAt: new Date(Date.now() + 10 * 60_000) },
  });
  return instagramAuthorizeUrl(state, instagramRedirectUri());
}

/** Completes Instagram Login after validating the state against the signed-in user. */
export async function completeInstagramConnect(userId: string, state: string, code: string): Promise<{ businessId: string }> {
  const record = await prisma.oAuthState.findUnique({ where: { stateHash: hashToken(state) } });
  if (!record || record.provider !== "instagram" || record.usedAt || record.expiresAt < new Date() || record.userId !== userId) {
    throw fail.validation("This Instagram connection link has expired. Start again from Integrations.");
  }
  await prisma.oAuthState.update({ where: { id: record.id }, data: { usedAt: new Date() } });
  const membership = await prisma.businessMembership.findUnique({ where: { businessId_userId: { businessId: record.businessId, userId } } });
  if (!membership || !["OWNER", "ADMIN"].includes(membership.role)) throw fail.forbidden();
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { name: true, emailVerifiedAt: true } });
  const business = await prisma.business.findUniqueOrThrow({ where: { id: record.businessId }, select: { name: true } });

  const token = await exchangeInstagramCode(code, instagramRedirectUri());
  const profile = await getInstagramProfile(token.accessToken);
  await subscribeInstagramWebhooks(token.accessToken).catch(() => undefined);
  await upsertIntegration(
    { userId, userName: user.name, emailVerified: Boolean(user.emailVerifiedAt), businessId: record.businessId, businessName: business.name, role: membership.role, ipAddress: null },
    "INSTAGRAM",
    profile.user_id,
    {
      externalAccountName: profile.name ?? profile.username,
      displayHandle: `@${profile.username}`,
      credentialsEnc: encryptJson({ accessToken: token.accessToken } satisfies ChannelCredentials),
      tokenExpiresAt: token.expiresAt,
      scopes: token.scopes,
    },
  );
  return { businessId: record.businessId };
}

export async function disconnectIntegration(actor: TenantActor, integrationId: string): Promise<void> {
  await withTenantTx(actor.businessId, async (tx) => {
    const result = await tx.integration.updateMany({
      where: { id: integrationId, businessId: actor.businessId },
      data: { status: "DISCONNECTED", credentialsEnc: null },
    });
    if (result.count === 0) throw fail.notFound("Integration");
    await recordAudit({ businessId: actor.businessId, actorType: "USER", actorId: actor.userId, action: "integration.disconnected", entityType: "Integration", entityId: integrationId }, tx);
  });
}

/** Re-validates stored credentials against Meta and records the result. */
export async function checkIntegrationHealth(actor: TenantActor, integrationId: string): Promise<Integration> {
  const integration = await prisma.integration.findFirst({ where: { id: integrationId, businessId: actor.businessId } });
  if (!integration) throw fail.notFound("Integration");
  let error: string | null = null;
  try {
    if (integration.channel === "WHATSAPP") await getWhatsAppPhoneNumber(integration.externalAccountId, credentialsFor(integration));
    if (integration.channel === "INSTAGRAM") await getInstagramProfile(credentialsFor(integration).accessToken);
  } catch (caught) {
    error = (caught as Error).message;
  }
  const expired = integration.tokenExpiresAt ? integration.tokenExpiresAt < new Date() : false;
  return prisma.integration.update({
    where: { id: integration.id },
    data: {
      status: expired ? "EXPIRED" : error ? "ERROR" : "CONNECTED",
      lastHealthCheckAt: new Date(),
      lastError: error,
      lastErrorAt: error ? new Date() : integration.lastErrorAt,
    },
  });
}

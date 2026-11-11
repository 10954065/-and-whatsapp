import { randomInt } from "node:crypto";
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
  exchangeEmbeddedSignupCode,
  exchangeInstagramCode,
  getInstagramProfile,
  getTokenAppId,
  getWhatsAppPhoneNumber,
  instagramAuthorizeUrl,
  listWhatsAppAccountNumberIds,
  registerWhatsAppNumber,
  subscribeInstagramWebhooks,
  subscribeWhatsAppWebhooks,
} from "@/modules/integrations/meta";

export interface ChannelCredentials {
  accessToken: string;
  /** Two-step verification PIN set when SUNLEON AI registered the number with the Cloud API. */
  registrationPin?: string;
}

const phoneNumberIdField = z.string().trim().regex(/^\d{6,30}$/, "The phone number ID is a long number from WhatsApp Manager.");
const wabaIdField = z.string().trim().regex(/^\d{6,30}$/, "The WhatsApp Business Account ID is a long number.");
const metaFeesAcknowledgedField = z.literal("on", { error: "Confirm that you understand Meta's WhatsApp fees." });

export const whatsappConnectSchema = z.object({
  phoneNumberId: phoneNumberIdField,
  wabaId: wabaIdField,
  accessToken: z.string().trim().min(20, "Paste the permanent system-user access token.").max(1_000),
  metaFeesAcknowledged: metaFeesAcknowledgedField,
});

export const whatsappEmbeddedConnectSchema = z.object({
  code: z.string().trim().min(1, "Meta did not return a sign-in code. Click Connect WhatsApp and try again.").max(2_000),
  phoneNumberId: phoneNumberIdField,
  wabaId: wabaIdField,
  metaFeesAcknowledged: metaFeesAcknowledgedField,
});

export function credentialsFor(integration: Pick<Integration, "credentialsEnc">): ChannelCredentials {
  if (!integration.credentialsEnc) throw fail.precondition("This channel has no stored credentials.");
  return decryptJson<ChannelCredentials>(integration.credentialsEnc);
}

export async function listIntegrations(businessId: string) {
  return prisma.integration.findMany({ where: { businessId }, orderBy: { createdAt: "asc" } });
}

const CONNECTED_ELSEWHERE = "This account is already connected to another SUNLEON AI workspace.";

/** Reconnecting an account the workspace already has (a fresh token, say) does not use up another channel. */
async function assertChannelAllowance(businessId: string, reconnectingAccountId?: string): Promise<void> {
  const [limits, connected] = await Promise.all([
    getPlanLimits(businessId),
    prisma.integration.count({
      where: { businessId, status: "CONNECTED", channel: { not: "SANDBOX" }, ...(reconnectingAccountId ? { externalAccountId: { not: reconnectingAccountId } } : {}) },
    }),
  ]);
  if (connected >= limits.channels) throw fail.limitExceeded(`Your plan allows ${limits.channels} connected channel(s). Upgrade to add more.`);
}

/** The number's current connection, if any. Checked before any call to Meta changes the number. */
async function existingWhatsAppNumber(actor: TenantActor, phoneNumberId: string): Promise<Integration | null> {
  const existing = await prisma.integration.findUnique({ where: { channel_externalAccountId: { channel: "WHATSAPP", externalAccountId: phoneNumberId } } });
  if (existing && existing.businessId !== actor.businessId) throw fail.conflict(CONNECTED_ELSEWHERE);
  return existing;
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
    throw fail.conflict(CONNECTED_ELSEWHERE);
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
  const existing = await existingWhatsAppNumber(actor, input.phoneNumberId);
  await assertChannelAllowance(actor.businessId, input.phoneNumberId);
  const credentials: ChannelCredentials = { accessToken: input.accessToken };
  const phone = await lookUpWhatsAppNumber(input.phoneNumberId, credentials);
  // Meta only sends a number's messages to the app its token was made for, so check that first.
  const platformAppId = env().META_APP_ID;
  const tokenAppId = await getTokenAppId(input.accessToken).catch(() => null);
  if (platformAppId && tokenAppId && tokenAppId !== platformAppId) {
    throw fail.validation("This token was made for a different Meta app. Generate it for the SUNLEON AI app, or customer messages won't reach your inbox.");
  }
  await linkWhatsAppAccount(input.wabaId, credentials);
  return saveWhatsAppNumber(actor, input, phone, credentials, "manual", existing);
}

/**
 * Connects the number an owner picked in Meta's Embedded Signup popup. The browser passes only
 * the one-time code and the ids the popup reported; each is checked with Meta before saving.
 */
export async function connectWhatsAppEmbedded(actor: TenantActor, input: z.infer<typeof whatsappEmbeddedConnectSchema>): Promise<Integration> {
  if (!actor.emailVerified) throw fail.precondition("Confirm your email address before connecting channels.");
  const { META_APP_ID, META_APP_SECRET } = env();
  if (!META_APP_ID || !META_APP_SECRET) throw fail.precondition("Connecting with Facebook is not set up on this platform yet. Use the manual form instead.");
  const existing = await existingWhatsAppNumber(actor, input.phoneNumberId);
  await assertChannelAllowance(actor.businessId, input.phoneNumberId);

  let accessToken: string;
  try {
    accessToken = await exchangeEmbeddedSignupCode(input.code);
  } catch (error) {
    throw fail.validation(`Meta did not accept the sign-in (${(error as Error).message}). Click Connect WhatsApp and try again.`);
  }
  const credentials: ChannelCredentials = { accessToken };
  const phone = await lookUpWhatsAppNumber(input.phoneNumberId, credentials);
  let accountNumbers: string[];
  try {
    accountNumbers = await listWhatsAppAccountNumberIds(input.wabaId, credentials);
  } catch (error) {
    throw fail.validation(`WhatsApp rejected these details: ${(error as Error).message}`);
  }
  if (!accountNumbers.includes(input.phoneNumberId)) {
    throw fail.validation("This number is not part of the WhatsApp account you picked in Meta. Click Connect WhatsApp and choose the number again.");
  }
  const registrationPin = phone.platform_type === "CLOUD_API" ? null : await registerNewNumber(input.phoneNumberId, credentials);
  await linkWhatsAppAccount(input.wabaId, credentials);
  return saveWhatsAppNumber(actor, input, phone, registrationPin ? { ...credentials, registrationPin } : credentials, "embedded_signup", existing);
}

/** A number new to the Cloud API has to be registered before it can send or receive. Returns its PIN. */
async function registerNewNumber(phoneNumberId: string, credentials: ChannelCredentials): Promise<string> {
  const pin = randomInt(0, 1_000_000).toString().padStart(6, "0");
  try {
    await registerWhatsAppNumber(phoneNumberId, pin, credentials);
  } catch (error) {
    throw fail.validation(
      `WhatsApp would not switch this number on: ${(error as Error).message} If another provider set a two-step verification PIN on this number, turn it off in WhatsApp Manager and try again.`,
    );
  }
  return pin;
}

async function lookUpWhatsAppNumber(phoneNumberId: string, credentials: ChannelCredentials) {
  try {
    return await getWhatsAppPhoneNumber(phoneNumberId, credentials);
  } catch (error) {
    throw fail.validation(`WhatsApp rejected these details: ${(error as Error).message}`);
  }
}

/** Sends the account's webhooks to SUNLEON AI; without this, customer messages never arrive. */
async function linkWhatsAppAccount(wabaId: string, credentials: ChannelCredentials): Promise<void> {
  try {
    await subscribeWhatsAppWebhooks(wabaId, credentials);
  } catch (error) {
    throw fail.validation(`WhatsApp accepted the number but would not send this number's messages to SUNLEON AI: ${(error as Error).message}`);
  }
}

/** The PIN SUNLEON AI set when it registered the number, if a previous connection stored one. */
function storedRegistrationPin(existing: Integration | null): string | undefined {
  if (!existing?.credentialsEnc) return undefined;
  try {
    return credentialsFor(existing).registrationPin;
  } catch {
    return undefined;
  }
}

function saveWhatsAppNumber(
  actor: TenantActor,
  input: { phoneNumberId: string; wabaId: string },
  phone: { verified_name: string; display_phone_number: string },
  credentials: ChannelCredentials,
  method: "manual" | "embedded_signup",
  existing: Integration | null,
): Promise<Integration> {
  // A new token must not lose the PIN: Meta asks for it to register the number again.
  const previousPin = credentials.registrationPin ? undefined : storedRegistrationPin(existing);
  return upsertIntegration(
    actor,
    "WHATSAPP",
    input.phoneNumberId,
    {
      externalAccountName: phone.verified_name,
      displayHandle: phone.display_phone_number,
      wabaId: input.wabaId,
      credentialsEnc: encryptJson(previousPin ? { ...credentials, registrationPin: previousPin } : credentials),
    },
    // Proof the owner saw Meta's fees, and the free allowance they were shown.
    { method, metaFeesAcknowledged: true, metaFreeRepliesShown: META_FREE_REPLIES_PER_MONTH },
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

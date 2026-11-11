import { randomInt } from "node:crypto";
import { z } from "zod";
import { META_FREE_REPLIES_PER_MONTH } from "@/config/whatsapp-fees";
import type { Channel, Integration } from "@/generated/prisma/client";
import { prisma } from "@/lib/db/prisma";
import { withTenantTx } from "@/lib/db/tenant";
import { env } from "@/lib/env";
import type { TenantActor } from "@/lib/auth/tenant";
import { fail, isAppError } from "@/lib/monitoring/errors";
import { logger } from "@/lib/monitoring/logger";
import { decryptJson, encryptJson, hashToken, randomToken } from "@/lib/security/crypto";
import { recordAudit } from "@/modules/administration/audit.service";
import { getPlanLimits } from "@/modules/billing/usage";
import {
  type BusinessInstagramEdge,
  exchangeBusinessLoginCode,
  getClientBusinessId,
  getGrantedScopes,
  getInstagramAccount,
  getTokenAppId,
  getWhatsAppPhoneNumber,
  instagramLoginUrl,
  listBusinessInstagramAccountIds,
  listInstagramAccounts,
  listWhatsAppAccountNumberIds,
  registerWhatsAppNumber,
  subscribeInstagramWebhooks,
  subscribeWhatsAppWebhooks,
  unsubscribeInstagramWebhooks,
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

/** The account's current connection, if any. Checked before any call to Meta changes the account. */
async function existingConnection(actor: TenantActor, channel: Channel, externalAccountId: string): Promise<Integration | null> {
  const existing = await prisma.integration.findUnique({ where: { channel_externalAccountId: { channel, externalAccountId } } });
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
  const existing = await existingConnection(actor, "WHATSAPP", input.phoneNumberId);
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
  const existing = await existingConnection(actor, "WHATSAPP", input.phoneNumberId);
  await assertChannelAllowance(actor.businessId, input.phoneNumberId);

  let accessToken: string;
  try {
    accessToken = await exchangeBusinessLoginCode(input.code);
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

/** Starts Instagram's Unified Login: stores a hashed one-time state bound to user + business. */
export async function startInstagramConnect(actor: TenantActor): Promise<string> {
  if (!actor.emailVerified) throw fail.precondition("Confirm your email address before connecting channels.");
  const state = randomToken(24);
  await prisma.oAuthState.create({
    data: { stateHash: hashToken(state), userId: actor.userId, businessId: actor.businessId, provider: "instagram", expiresAt: new Date(Date.now() + 10 * 60_000) },
  });
  // The plan's channel allowance is checked once Meta says which account was shared, so
  // reconnecting an account the workspace already has is not refused here.
  return instagramLoginUrl(state, instagramRedirectUri());
}

/** Uses up the one-time state and returns the owner or admin it was issued to. */
async function instagramActorFor(userId: string, state: string): Promise<TenantActor> {
  const expired = fail.validation("This Instagram connection link has expired. Start again from Integrations.");
  const record = await prisma.oAuthState.findUnique({ where: { stateHash: hashToken(state) } });
  if (!record || record.provider !== "instagram" || record.userId !== userId) throw expired;
  // One conditional update, so two redirects arriving together cannot both use the state.
  const now = new Date();
  const used = await prisma.oAuthState.updateMany({ where: { id: record.id, usedAt: null, expiresAt: { gt: now } }, data: { usedAt: now } });
  if (used.count !== 1) throw expired;
  const membership = await prisma.businessMembership.findUnique({ where: { businessId_userId: { businessId: record.businessId, userId } } });
  if (!membership || !["OWNER", "ADMIN"].includes(membership.role)) throw fail.forbidden();
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { name: true, emailVerifiedAt: true } });
  const business = await prisma.business.findUniqueOrThrow({ where: { id: record.businessId }, select: { name: true } });
  return { userId, userName: user.name, emailVerified: Boolean(user.emailVerifiedAt), businessId: record.businessId, businessName: business.name, role: membership.role, ipAddress: null };
}

/** Completes Instagram's Unified Login after validating the state against the signed-in user. */
export async function completeInstagramConnect(userId: string, state: string, code: string): Promise<{ businessId: string }> {
  const actor = await instagramActorFor(userId, state);
  let credentials: ChannelCredentials;
  let accounts: { id: string; username: string }[];
  try {
    credentials = { accessToken: await exchangeBusinessLoginCode(code, instagramRedirectUri()) };
    accounts = await listInstagramAccounts(credentials);
    if (accounts.length === 0) accounts = await findUnlistedInstagramAccounts(credentials);
  } catch (error) {
    throw fail.validation(`Meta did not accept the sign-in (${(error as Error).message}). Click Connect with Instagram and try again.`);
  }
  const account = await chooseInstagramAccount(actor, accounts);
  await assertChannelAllowance(actor.businessId, account.id);
  try {
    await subscribeInstagramWebhooks(account.id, credentials);
  } catch (error) {
    throw fail.validation(`Instagram connected but would not send this account's messages to SUNLEON AI: ${(error as Error).message}`);
  }
  await upsertIntegration(actor, "INSTAGRAM", account.id, {
    externalAccountName: account.username,
    displayHandle: `@${account.username}`,
    credentialsEnc: encryptJson(credentials),
    tokenExpiresAt: null,
    scopes: [],
  });
  return { businessId: actor.businessId };
}

/** At most this many granted accounts are looked up, so one token cannot trigger unbounded calls to Meta. */
const MAX_GRANTED_ACCOUNTS = 25;

const BUSINESS_INSTAGRAM_EDGES: BusinessInstagramEdge[] = ["owned_instagram_accounts", "instagram_accounts"];

/**
 * Meta does not always list a shared account under the business token: a portfolio connecting to
 * its own app gets a token that covers every account and has none assigned. The account is then
 * looked for in the token's grant and in the portfolio itself, and kept only if the token reads it.
 */
async function findUnlistedInstagramAccounts(credentials: ChannelCredentials): Promise<{ id: string; username: string }[]> {
  const grants = await getGrantedScopes(credentials.accessToken);
  const tried: Record<string, string> = { grants: grants.map((grant) => `${grant.scope}:${grant.targetIds?.length ?? "all"}`).join(",") };
  let candidateIds = grants.find((grant) => grant.scope === "instagram_manage_messages")?.targetIds ?? [];
  if (candidateIds.length === 0) candidateIds = await instagramAccountIdsFromBusiness(credentials, tried);
  if (candidateIds.length === 0) candidateIds = fallbackInstagramAccountIds();

  const accounts: { id: string; username: string }[] = [];
  for (const id of candidateIds.slice(0, MAX_GRANTED_ACCOUNTS)) {
    try {
      const account = await getInstagramAccount(id, credentials);
      accounts.push({ id: account.id, username: account.username ?? account.id });
    } catch (error) {
      tried.read = (error as Error).message;
    }
  }
  if (accounts.length === 0) logger.warn("integration.instagram_no_account_found", tried);
  return accounts;
}

/** Account ids the platform owner listed for when Meta names none; only numeric ids are kept. */
function fallbackInstagramAccountIds(): string[] {
  return (env().META_INSTAGRAM_FALLBACK_ACCOUNT_IDS ?? "")
    .split(",")
    .map((id) => id.trim())
    .filter((id) => /^\d{5,30}$/.test(id));
}

/** Ids from the connecting portfolio's own Instagram accounts; `tried` records what each lookup answered. */
async function instagramAccountIdsFromBusiness(credentials: ChannelCredentials, tried: Record<string, string>): Promise<string[]> {
  let businessId: string | null;
  try {
    businessId = await getClientBusinessId(credentials);
  } catch (error) {
    tried.business = (error as Error).message;
    return [];
  }
  if (!businessId) {
    tried.business = "none reported";
    return [];
  }
  for (const edge of BUSINESS_INSTAGRAM_EDGES) {
    try {
      const ids = await listBusinessInstagramAccountIds(businessId, edge, credentials);
      tried[edge] = String(ids.length);
      if (ids.length > 0) return ids;
    } catch (error) {
      tried[edge] = (error as Error).message;
    }
  }
  return [];
}

/**
 * Meta lists every Instagram account the business has shared with the platform, not only the one
 * picked just now. Prefer one this workspace has not connected yet, then one it has (a reconnect),
 * and never one that belongs to another workspace.
 */
async function chooseInstagramAccount(actor: TenantActor, accounts: { id: string; username: string }[]) {
  if (accounts.length === 0) throw fail.validation("No Instagram professional account was shared. Click Connect with Instagram and choose your account.");
  const known = await prisma.integration.findMany({
    where: { channel: "INSTAGRAM", externalAccountId: { in: accounts.map((account) => account.id) } },
    select: { externalAccountId: true, businessId: true, status: true },
  });
  const ownedElsewhere = new Set(known.filter((row) => row.businessId !== actor.businessId).map((row) => row.externalAccountId));
  const connectedHere = new Set(known.filter((row) => row.businessId === actor.businessId && row.status !== "DISCONNECTED").map((row) => row.externalAccountId));
  const available = accounts.filter((account) => !ownedElsewhere.has(account.id));
  const account = available.find((candidate) => !connectedHere.has(candidate.id)) ?? available[0];
  if (!account) throw fail.conflict(CONNECTED_ELSEWHERE);
  return account;
}

/** The notice the Integrations page shows after an Instagram connection fails. */
export function instagramFailureNotice(error: unknown): "limit" | "taken" | "failed" {
  if (isAppError(error) && error.code === "LIMIT_EXCEEDED") return "limit";
  if (isAppError(error) && error.code === "CONFLICT") return "taken";
  return "failed";
}

export async function disconnectIntegration(actor: TenantActor, integrationId: string): Promise<void> {
  const integration = await prisma.integration.findFirst({ where: { id: integrationId, businessId: actor.businessId } });
  if (integration?.channel === "INSTAGRAM" && integration.credentialsEnc) await unlinkInstagramAccount(integration);
  await withTenantTx(actor.businessId, async (tx) => {
    const result = await tx.integration.updateMany({
      where: { id: integrationId, businessId: actor.businessId },
      data: { status: "DISCONNECTED", credentialsEnc: null },
    });
    if (result.count === 0) throw fail.notFound("Integration");
    await recordAudit({ businessId: actor.businessId, actorType: "USER", actorId: actor.userId, action: "integration.disconnected", entityType: "Integration", entityId: integrationId }, tx);
  });
}

/**
 * The business token never expires, so a disconnected account also stops its webhooks at Meta.
 * Best effort: disconnecting must still work when Meta is unreachable or the token was revoked.
 */
async function unlinkInstagramAccount(integration: Integration): Promise<void> {
  try {
    await unsubscribeInstagramWebhooks(integration.externalAccountId, credentialsFor(integration));
  } catch (error) {
    logger.warn("integration.instagram_unlink_failed", { integrationId: integration.id, error: (error as Error).message });
  }
}

/** Re-validates stored credentials against Meta and records the result. */
export async function checkIntegrationHealth(actor: TenantActor, integrationId: string): Promise<Integration> {
  const integration = await prisma.integration.findFirst({ where: { id: integrationId, businessId: actor.businessId } });
  if (!integration) throw fail.notFound("Integration");
  let error: string | null = null;
  try {
    if (integration.channel === "WHATSAPP") await getWhatsAppPhoneNumber(integration.externalAccountId, credentialsFor(integration));
    if (integration.channel === "INSTAGRAM") await getInstagramAccount(integration.externalAccountId, credentialsFor(integration));
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

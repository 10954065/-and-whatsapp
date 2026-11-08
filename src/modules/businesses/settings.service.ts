import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db/prisma";
import { withTenantTx } from "@/lib/db/tenant";
import type { TenantActor } from "@/lib/auth/tenant";
import { recordAudit } from "@/modules/administration/audit.service";
import type {
  BusinessHours,
  BusinessProfileInput,
  NotificationSettingsInput,
} from "@/modules/businesses/settings.schemas";

export async function getBusinessSettings(businessId: string) {
  return prisma.business.findUniqueOrThrow({
    where: { id: businessId },
    include: { settings: true },
  });
}

export async function updateBusinessProfile(actor: TenantActor, input: BusinessProfileInput): Promise<void> {
  await withTenantTx(actor.businessId, async (tx) => {
    await tx.business.update({ where: { id: actor.businessId }, data: input });
    await recordAudit(
      {
        businessId: actor.businessId,
        actorType: "USER",
        actorId: actor.userId,
        action: "business.profile_updated",
        entityType: "Business",
        entityId: actor.businessId,
        metadata: { fields: Object.keys(input) },
        ipAddress: actor.ipAddress,
      },
      tx,
    );
  });
}

export async function updateBusinessHours(actor: TenantActor, hours: BusinessHours): Promise<void> {
  await withTenantTx(actor.businessId, async (tx) => {
    await tx.business.update({
      where: { id: actor.businessId },
      data: { businessHours: hours as unknown as Prisma.InputJsonValue },
    });
    await recordAudit(
      { businessId: actor.businessId, actorType: "USER", actorId: actor.userId, action: "business.hours_updated", ipAddress: actor.ipAddress },
      tx,
    );
  });
}

export async function updateNotificationSettings(actor: TenantActor, input: NotificationSettingsInput): Promise<void> {
  await withTenantTx(actor.businessId, async (tx) => {
    await tx.businessSettings.upsert({
      where: { businessId: actor.businessId },
      update: input,
      create: { businessId: actor.businessId, ...input },
    });
    await recordAudit(
      { businessId: actor.businessId, actorType: "USER", actorId: actor.userId, action: "business.settings_updated", ipAddress: actor.ipAddress },
      tx,
    );
  });
}

/** True when `now` falls inside the business's configured opening hours. Unset hours = always open. */
export function isWithinBusinessHours(hours: BusinessHours | null, timezone: string, now: Date = new Date()): boolean {
  if (!hours) return true;
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: timezone,
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const weekday = parts.find((part) => part.type === "weekday")?.value.toLowerCase().slice(0, 3) as keyof BusinessHours;
  const time = `${parts.find((part) => part.type === "hour")?.value}:${parts.find((part) => part.type === "minute")?.value}`;
  const intervals = hours[weekday] ?? [];
  return intervals.some((interval) => time >= interval.start && time < interval.end);
}

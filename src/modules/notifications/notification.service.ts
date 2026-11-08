import type { BusinessSettings } from "@/generated/prisma/client";
import { prisma } from "@/lib/db/prisma";
import { withTenantTx } from "@/lib/db/tenant";
import type { TenantActor } from "@/lib/auth/tenant";
import { logger } from "@/lib/monitoring/logger";
import { reportError } from "@/lib/monitoring/report";
import { enqueueJob } from "@/lib/queue";

export const NOTIFICATION_EMAIL_JOB = "notification.email";

export type NotificationKind = "ai.escalation" | "order.created" | "booking.created" | "stock.low" | "automation";

type PreferenceField = keyof Pick<BusinessSettings, "notifyOnEscalation" | "notifyOnNewOrder" | "notifyOnNewBooking" | "notifyOnLowStock">;

/** Which business setting switches each kind on or off (automation alerts are explicit workflow steps). */
const PREFERENCE: Record<NotificationKind, PreferenceField | null> = {
  "ai.escalation": "notifyOnEscalation",
  "order.created": "notifyOnNewOrder",
  "booking.created": "notifyOnNewBooking",
  "stock.low": "notifyOnLowStock",
  automation: null,
};

export interface TeamNotification {
  businessId: string;
  kind: NotificationKind;
  title: string;
  body?: string | null;
  link?: string | null;
}

/**
 * Alerts the business's team in the app and by email (a background job sends to the
 * notification email, or else to verified owners and admins). Respects the business's
 * notification preferences.
 * Call it after the transaction that caused the event has committed. Failures are reported,
 * never thrown: the order, booking or escalation that triggered the alert already happened.
 */
export async function notifyTeam(input: TeamNotification): Promise<{ id: string } | null> {
  try {
    return await createTeamNotification(input);
  } catch (error) {
    await reportError(error, { source: "notifications.notify", businessId: input.businessId, kind: input.kind });
    return null;
  }
}

async function createTeamNotification(input: TeamNotification): Promise<{ id: string } | null> {
  const settings = await prisma.businessSettings.findUnique({ where: { businessId: input.businessId } });
  const preference = PREFERENCE[input.kind];
  if (preference && settings && !settings[preference]) return null;

  const notification = await withTenantTx(input.businessId, (tx) =>
    tx.notification.create({
      data: {
        businessId: input.businessId,
        type: input.kind,
        title: input.title.slice(0, 140),
        body: input.body ? input.body.slice(0, 500) : null,
        link: input.link ?? null,
      },
      select: { id: true },
    }),
  );
  try {
    await enqueueJob(NOTIFICATION_EMAIL_JOB, { notificationId: notification.id }, { businessId: input.businessId, idempotencyKey: `notification-email:${notification.id}` });
  } catch (error) {
    // The in-app notification exists; a missing email must not break the triggering flow.
    logger.error("notification.email_enqueue_failed", { businessId: input.businessId, notificationId: notification.id, error });
  }
  return notification;
}

export async function listNotifications(businessId: string, limit = 50) {
  return prisma.notification.findMany({ where: { businessId, userId: null }, orderBy: { createdAt: "desc" }, take: limit });
}

export async function countUnreadNotifications(businessId: string): Promise<number> {
  return prisma.notification.count({ where: { businessId, userId: null, readAt: null } });
}

/** Marks one notification (or all of them) as read for the whole team. */
export async function markNotificationsRead(actor: TenantActor, notificationId: string | "all"): Promise<number> {
  const result = await withTenantTx(actor.businessId, (tx) =>
    tx.notification.updateMany({
      where: { businessId: actor.businessId, readAt: null, ...(notificationId === "all" ? {} : { id: notificationId }) },
      data: { readAt: new Date() },
    }),
  );
  return result.count;
}

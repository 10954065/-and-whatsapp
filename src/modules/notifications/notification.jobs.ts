import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { notificationEmail } from "@/lib/email/templates";
import { sendEmail } from "@/lib/email";
import { env } from "@/lib/env";
import { PermanentJobError, enqueueJob, registerJobHandler } from "@/lib/queue";
import { NOTIFICATION_EMAIL_JOB } from "@/modules/notifications/notification.service";

const payloadSchema = z.object({ notificationId: z.string().min(1), to: z.email().optional() });

/** The business's notification email, or else its verified owners and admins. */
async function notificationRecipients(businessId: string, notificationEmail: string | null | undefined): Promise<string[]> {
  if (notificationEmail) return [notificationEmail];
  const members = await prisma.businessMembership.findMany({
    where: { businessId, status: "ACTIVE", role: { in: ["OWNER", "ADMIN"] }, user: { emailVerifiedAt: { not: null } } },
    select: { user: { select: { email: true } } },
  });
  return members.map((member) => member.user.email);
}

/**
 * Without `to`, fans out one job per recipient; with `to`, sends that one email. Splitting keeps
 * retries per recipient, so a failure never re-sends to people who already got the email.
 */
registerJobHandler(NOTIFICATION_EMAIL_JOB, async (payload) => {
  const { notificationId, to } = payloadSchema.parse(payload);
  const notification = await prisma.notification.findUnique({
    where: { id: notificationId },
    include: { business: { select: { name: true, settings: { select: { notificationEmail: true } } } } },
  });
  if (!notification) throw new PermanentJobError("Notification no longer exists.");

  if (!to) {
    for (const recipient of await notificationRecipients(notification.businessId, notification.business.settings?.notificationEmail)) {
      await enqueueJob(NOTIFICATION_EMAIL_JOB, { notificationId, to: recipient }, { businessId: notification.businessId, idempotencyKey: `notification-email:${notificationId}:${recipient}` });
    }
    return;
  }

  const { RESEND_API_KEY, NODE_ENV } = env();
  if (!RESEND_API_KEY && NODE_ENV === "production") throw new PermanentJobError("Email delivery is not configured (RESEND_API_KEY missing).");
  const delivered = await sendEmail(
    notificationEmail({
      to,
      title: `${notification.business.name}: ${notification.title}`,
      body: notification.body ?? notification.title,
      url: `${env().APP_URL}${notification.link ?? "/app/notifications"}`,
      businessId: notification.businessId,
    }),
  );
  // sendEmail records failures in EmailLog; throwing lets the queue retry with back-off.
  if (!delivered) throw new Error("Notification email was not delivered.");
});

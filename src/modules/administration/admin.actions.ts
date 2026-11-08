"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { ActionResult } from "@/lib/monitoring/errors";
import { fail } from "@/lib/monitoring/errors";
import { parseInput, runAction } from "@/lib/http/action";
import { getRequestMeta } from "@/lib/auth/request";
import { requireSuperAdminForAction } from "@/lib/auth/current";
import {
  addSupportNote,
  businessStatusSchema,
  grantSubscription,
  grantSubscriptionSchema,
  planUpdateSchema,
  setBusinessStatus,
  supportNoteSchema,
  updatePlan,
  type AdminActor,
} from "@/modules/administration/admin.service";
import {
  aiSwitchSchema,
  announcementSchema,
  createAnnouncement,
  inquiryStatusSchema,
  retryFailedJob,
  setAiGloballyEnabled,
  setAnnouncementActive,
  setInquiryStatus,
} from "@/modules/administration/monitoring.service";

/** Every admin change needs a super-admin with two-factor authentication on this session. */
async function adminActor(): Promise<AdminActor> {
  const session = await requireSuperAdminForAction();
  if (!session.user.mfaEnabled || !session.mfaVerified) throw fail.precondition("Turn on two-factor authentication to use the admin console.");
  return { userId: session.user.id, ipAddress: (await getRequestMeta()).ipAddress };
}

type Result = Promise<ActionResult<unknown>>;

export async function setBusinessStatusAction(_previous: ActionResult<unknown> | null, formData: FormData): Result {
  return runAction(
    async () => {
      const input = parseInput(businessStatusSchema, formData);
      await setBusinessStatus(await adminActor(), input);
      revalidatePath(`/admin/businesses/${input.businessId}`);
    },
    { source: "admin.business_status", successMessage: "Business status updated." },
  );
}

export async function addSupportNoteAction(_previous: ActionResult<unknown> | null, formData: FormData): Result {
  return runAction(
    async () => {
      const input = parseInput(supportNoteSchema, formData);
      await addSupportNote(await adminActor(), input);
      revalidatePath(`/admin/businesses/${input.businessId}`);
    },
    { source: "admin.support_note", successMessage: "Note added." },
  );
}

export async function grantSubscriptionAction(_previous: ActionResult<unknown> | null, formData: FormData): Result {
  return runAction(
    async () => {
      const input = parseInput(grantSubscriptionSchema, formData);
      await grantSubscription(await adminActor(), input);
      revalidatePath(`/admin/businesses/${input.businessId}`);
    },
    { source: "admin.grant_subscription", successMessage: "Subscription activated." },
  );
}

export async function updatePlanAction(_previous: ActionResult<unknown> | null, formData: FormData): Result {
  return runAction(
    async () => {
      await updatePlan(await adminActor(), parseInput(planUpdateSchema, formData));
      revalidatePath("/admin/plans");
      revalidatePath("/pricing");
    },
    { source: "admin.plan", successMessage: "Plan saved." },
  );
}

export async function retryJobAction(_previous: ActionResult<unknown> | null, formData: FormData): Result {
  return runAction(
    async () => {
      await retryFailedJob(await adminActor(), parseInput(z.object({ jobId: z.string().min(1) }), formData).jobId);
      revalidatePath("/admin/monitoring");
    },
    { source: "admin.retry_job", successMessage: "Job queued again." },
  );
}

export async function setInquiryStatusAction(_previous: ActionResult<unknown> | null, formData: FormData): Result {
  return runAction(
    async () => {
      await setInquiryStatus(await adminActor(), parseInput(inquiryStatusSchema, formData));
      revalidatePath("/admin/inquiries");
    },
    { source: "admin.inquiry", successMessage: "Inquiry updated." },
  );
}

export async function createAnnouncementAction(_previous: ActionResult<unknown> | null, formData: FormData): Result {
  return runAction(
    async () => {
      await createAnnouncement(await adminActor(), parseInput(announcementSchema, formData));
      revalidatePath("/admin/announcements");
      revalidatePath("/app", "layout");
    },
    { source: "admin.announcement", successMessage: "Announcement published." },
  );
}

const toggleSchema = z.object({ announcementId: z.string().min(1), isActive: z.enum(["true", "false"]).transform((value) => value === "true") });

export async function setAnnouncementActiveAction(_previous: ActionResult<unknown> | null, formData: FormData): Result {
  return runAction(
    async () => {
      const input = parseInput(toggleSchema, formData);
      await setAnnouncementActive(await adminActor(), input.announcementId, input.isActive);
      revalidatePath("/admin/announcements");
      revalidatePath("/app", "layout");
    },
    { source: "admin.announcement_toggle", successMessage: "Announcement updated." },
  );
}

export async function setAiEnabledAction(_previous: ActionResult<unknown> | null, formData: FormData): Result {
  return runAction(
    async () => {
      await setAiGloballyEnabled(await adminActor(), parseInput(aiSwitchSchema, formData));
      revalidatePath("/admin/settings");
    },
    { source: "admin.ai_switch", successMessage: "AI setting saved." },
  );
}

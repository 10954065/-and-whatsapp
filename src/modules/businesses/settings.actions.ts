"use server";

import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/lib/monitoring/errors";
import { parseInput, runAction } from "@/lib/http/action";
import { getRequestMeta } from "@/lib/auth/request";
import { requireTenantAction, toActor } from "@/lib/auth/tenant";
import {
  businessHoursSchema,
  businessProfileSchema,
  notificationSettingsSchema,
} from "@/modules/businesses/settings.schemas";
import {
  updateBusinessHours,
  updateBusinessProfile,
  updateNotificationSettings,
} from "@/modules/businesses/settings.service";

async function actor() {
  const context = await requireTenantAction("business.update");
  return toActor(context, (await getRequestMeta()).ipAddress);
}

export async function updateProfileAction(_previous: ActionResult | null, formData: FormData): Promise<ActionResult> {
  return runAction(
    async () => {
      await updateBusinessProfile(await actor(), parseInput(businessProfileSchema, formData));
      revalidatePath("/app", "layout");
    },
    { source: "settings.profile", successMessage: "Business profile saved." },
  );
}

export async function updateHoursAction(_previous: ActionResult | null, formData: FormData): Promise<ActionResult> {
  return runAction(
    async () => {
      await updateBusinessHours(await actor(), parseInput(businessHoursSchema, formData));
      revalidatePath("/app/settings");
    },
    { source: "settings.hours", successMessage: "Opening hours saved." },
  );
}

export async function updateNotificationsAction(_previous: ActionResult | null, formData: FormData): Promise<ActionResult> {
  return runAction(
    async () => {
      await updateNotificationSettings(await actor(), parseInput(notificationSettingsSchema, formData));
      revalidatePath("/app/settings");
    },
    { source: "settings.notifications", successMessage: "Notification settings saved." },
  );
}

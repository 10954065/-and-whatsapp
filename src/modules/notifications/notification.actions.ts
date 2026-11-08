"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { ActionResult } from "@/lib/monitoring/errors";
import { parseInput, runAction } from "@/lib/http/action";
import { getRequestMeta } from "@/lib/auth/request";
import { requireTenantAction, toActor } from "@/lib/auth/tenant";
import { markNotificationsRead } from "@/modules/notifications/notification.service";

const markReadSchema = z.object({ notificationId: z.union([z.literal("all"), z.string().min(1).max(64)]) });

export async function markNotificationsReadAction(_previous: ActionResult<unknown> | null, formData: FormData): Promise<ActionResult<unknown>> {
  return runAction(
    async () => {
      const context = await requireTenantAction("business.read");
      const input = parseInput(markReadSchema, formData);
      await markNotificationsRead(toActor(context, (await getRequestMeta()).ipAddress), input.notificationId);
      revalidatePath("/app", "layout");
    },
    { source: "notifications.read", successMessage: "Marked as read." },
  );
}

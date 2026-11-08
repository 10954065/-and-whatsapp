"use server";

import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/lib/monitoring/errors";
import { parseInput, runAction } from "@/lib/http/action";
import { getRequestMeta } from "@/lib/auth/request";
import { requireTenantAction, toActor } from "@/lib/auth/tenant";
import { applyIndustryTemplate, applyTemplateSchema } from "@/modules/onboarding/template.service";

export async function applyTemplateAction(_previous: ActionResult<unknown> | null, formData: FormData): Promise<ActionResult<unknown>> {
  return runAction(
    async () => {
      const context = await requireTenantAction("business.update");
      const actor = toActor(context, (await getRequestMeta()).ipAddress);
      await applyIndustryTemplate(actor, parseInput(applyTemplateSchema, formData), { canManageAutomation: context.can("automation.manage") });
      revalidatePath("/app", "layout");
    },
    { source: "business.template", successMessage: "Template applied. New workflows are saved as drafts in Automation." },
  );
}

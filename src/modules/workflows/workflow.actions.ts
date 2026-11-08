"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { ActionResult } from "@/lib/monitoring/errors";
import { parseInput, runAction } from "@/lib/http/action";
import { getRequestMeta } from "@/lib/auth/request";
import { requireTenantAction, toActor } from "@/lib/auth/tenant";
import { createWorkflow, setWorkflowStatus, workflowFormSchema } from "@/modules/workflows/workflow.service";

async function automationActor() {
  const context = await requireTenantAction("automation.manage");
  return toActor(context, (await getRequestMeta()).ipAddress);
}

export async function createWorkflowAction(_previous: ActionResult<unknown> | null, formData: FormData): Promise<ActionResult<unknown>> {
  return runAction(async () => void (await createWorkflow(await automationActor(), parseInput(workflowFormSchema, formData)), revalidatePath("/app/automation")), {
    source: "automation.create",
    successMessage: "Workflow saved as a draft. Activate it when you're ready.",
  });
}

const statusSchema = z.object({ workflowId: z.string().min(1), status: z.enum(["ACTIVE", "PAUSED", "ARCHIVED"]) });

export async function setWorkflowStatusAction(_previous: ActionResult<unknown> | null, formData: FormData): Promise<ActionResult<unknown>> {
  return runAction(
    async () => {
      const input = parseInput(statusSchema, formData);
      await setWorkflowStatus(await automationActor(), input.workflowId, input.status);
      revalidatePath("/app/automation");
    },
    { source: "automation.status", successMessage: "Workflow updated." },
  );
}

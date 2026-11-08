"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { parseInput } from "@/lib/http/action";
import { requireTenantAction, toActor } from "@/lib/auth/tenant";
import { skipSetupStep } from "@/modules/onboarding/setup.service";

const skipSchema = z.object({ stepId: z.string().min(1).max(40) });

export async function skipSetupStepAction(formData: FormData): Promise<void> {
  const context = await requireTenantAction("business.update");
  await skipSetupStep(toActor(context), parseInput(skipSchema, formData).stepId);
  revalidatePath("/app/setup");
}

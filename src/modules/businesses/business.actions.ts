"use server";

import { redirect } from "next/navigation";
import type { ActionResult } from "@/lib/monitoring/errors";
import { parseInput, runAction } from "@/lib/http/action";
import { requireUserForAction } from "@/lib/auth/current";
import { getRequestMeta } from "@/lib/auth/request";
import { setActiveBusiness } from "@/lib/auth/tenant";
import { createBusiness } from "@/modules/businesses/business.service";
import { createBusinessSchema, switchBusinessSchema } from "@/modules/businesses/business.schemas";

export async function createBusinessAction(_previous: ActionResult | null, formData: FormData): Promise<ActionResult> {
  return runAction(
    async () => {
      const session = await requireUserForAction();
      const input = parseInput(createBusinessSchema, formData);
      const { businessId } = await createBusiness(session.user.id, input, await getRequestMeta());
      await setActiveBusiness(session.user.id, businessId);
      redirect("/app/dashboard?welcome=1");
    },
    { source: "business.create" },
  );
}

/** Switches the active workspace; membership is verified before the cookie is set. */
export async function switchBusinessAction(formData: FormData): Promise<void> {
  const session = await requireUserForAction();
  const { businessId } = parseInput(switchBusinessSchema, formData);
  await setActiveBusiness(session.user.id, businessId);
  redirect("/app/dashboard");
}

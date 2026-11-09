"use server";

import { redirect } from "next/navigation";
import type { ActionResult } from "@/lib/monitoring/errors";
import { fail } from "@/lib/monitoring/errors";
import { parseInput, runAction } from "@/lib/http/action";
import { getRequestMeta } from "@/lib/auth/request";
import { requireTenantAction, toActor } from "@/lib/auth/tenant";
import { checkoutSchema, startSubscriptionCheckout } from "@/modules/billing/billing.service";

/** Sends the owner to Paystack's hosted checkout for the chosen plan and billing period. */
export async function startCheckoutAction(_previous: ActionResult<unknown> | null, formData: FormData): Promise<ActionResult<unknown>> {
  return runAction(
    async () => {
      const context = await requireTenantAction("billing.manage");
      if (!context.user.emailVerifiedAt) throw fail.precondition("Confirm your email address before paying. Paystack sends your receipt there.");
      const actor = { ...toActor(context, (await getRequestMeta()).ipAddress), email: context.user.email };
      const checkoutUrl = await startSubscriptionCheckout(actor, parseInput(checkoutSchema, formData));
      redirect(checkoutUrl);
    },
    { source: "billing.checkout" },
  );
}

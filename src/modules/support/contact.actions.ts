"use server";

import type { ActionResult } from "@/lib/monitoring/errors";
import { parseInput, runAction } from "@/lib/http/action";
import { getRequestMeta } from "@/lib/auth/request";
import { contactSchema, createContactInquiry } from "@/modules/support/contact.service";

export async function contactAction(_previous: ActionResult | null, formData: FormData): Promise<ActionResult> {
  return runAction(
    async () => {
      const input = parseInput(contactSchema, formData);
      const { ipAddress } = await getRequestMeta();
      await createContactInquiry(input, ipAddress);
    },
    { source: "contact.submit", successMessage: "Thank you — our team will get back to you within one business day." },
  );
}

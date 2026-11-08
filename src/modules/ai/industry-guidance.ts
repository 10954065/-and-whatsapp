import type { Industry } from "@/generated/prisma/enums";
import { INDUSTRY_TEMPLATES } from "@/config/industry-templates";

/** Industry-specific guidance injected into the shared agent prompt (one engine, many configs). */
export function industryGuidanceFor(industry: Industry): string {
  const template = INDUSTRY_TEMPLATES[industry];
  return [template.aiGuidance, ...template.escalationRules.map((rule) => `- Escalate when: ${rule}`)].join("\n");
}

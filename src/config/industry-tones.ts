import type { Industry } from "@/generated/prisma/enums";

/**
 * One colour per industry for the marketing site, set as --tone on whatever wraps the card.
 * Dark mode steps each one down so light ink lines stay readable on it.
 */
export const INDUSTRY_TONES: Record<Industry, string> = {
  RESTAURANT: "[--tone:oklch(0.7_0.17_40)] dark:[--tone:oklch(0.6_0.15_40)]",
  RETAIL: "[--tone:oklch(0.76_0.1_195)] dark:[--tone:oklch(0.56_0.08_195)]",
  FASHION: "[--tone:oklch(0.84_0.14_88)] dark:[--tone:oklch(0.66_0.12_80)]",
  BEAUTY: "[--tone:oklch(0.8_0.09_12)] dark:[--tone:oklch(0.58_0.1_12)]",
  SALON_SPA: "[--tone:oklch(0.76_0.1_305)] dark:[--tone:oklch(0.56_0.11_305)]",
  HEALTHCARE_ADMIN: "[--tone:oklch(0.82_0.1_162)] dark:[--tone:oklch(0.58_0.09_162)]",
  HOSPITALITY: "[--tone:oklch(0.72_0.1_262)] dark:[--tone:oklch(0.54_0.11_262)]",
  REAL_ESTATE: "[--tone:oklch(0.78_0.1_128)] dark:[--tone:oklch(0.58_0.09_128)]",
  EDUCATION: "[--tone:oklch(0.8_0.09_232)] dark:[--tone:oklch(0.58_0.09_232)]",
  PROFESSIONAL_SERVICES: "[--tone:oklch(0.72_0.09_62)] dark:[--tone:oklch(0.55_0.08_62)]",
  GENERAL: "[--tone:var(--sun)]",
};

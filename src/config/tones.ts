import type { Industry } from "@/generated/prisma/enums";

/**
 * The marketing site's drawing colours, set as --tone on whatever wraps a card.
 * Dark mode steps each one down so light ink lines stay readable on it.
 */
export const TONES = {
  coral: "[--tone:oklch(0.7_0.17_40)] dark:[--tone:oklch(0.6_0.15_40)]",
  teal: "[--tone:oklch(0.76_0.1_195)] dark:[--tone:oklch(0.56_0.08_195)]",
  gold: "[--tone:oklch(0.84_0.14_88)] dark:[--tone:oklch(0.66_0.12_80)]",
  rose: "[--tone:oklch(0.8_0.09_12)] dark:[--tone:oklch(0.58_0.1_12)]",
  lilac: "[--tone:oklch(0.76_0.1_305)] dark:[--tone:oklch(0.56_0.11_305)]",
  mint: "[--tone:oklch(0.82_0.1_162)] dark:[--tone:oklch(0.58_0.09_162)]",
  indigo: "[--tone:oklch(0.72_0.1_262)] dark:[--tone:oklch(0.54_0.11_262)]",
  lime: "[--tone:oklch(0.78_0.1_128)] dark:[--tone:oklch(0.58_0.09_128)]",
  sky: "[--tone:oklch(0.8_0.09_232)] dark:[--tone:oklch(0.58_0.09_232)]",
  clay: "[--tone:oklch(0.72_0.09_62)] dark:[--tone:oklch(0.55_0.08_62)]",
  sun: "[--tone:var(--sun)]",
} as const;

export type Tone = keyof typeof TONES;

export const INDUSTRY_TONES: Record<Industry, string> = {
  RESTAURANT: TONES.coral,
  RETAIL: TONES.teal,
  FASHION: TONES.gold,
  BEAUTY: TONES.rose,
  SALON_SPA: TONES.lilac,
  HEALTHCARE_ADMIN: TONES.mint,
  HOSPITALITY: TONES.indigo,
  REAL_ESTATE: TONES.lime,
  EDUCATION: TONES.sky,
  PROFESSIONAL_SERVICES: TONES.clay,
  GENERAL: TONES.sun,
};

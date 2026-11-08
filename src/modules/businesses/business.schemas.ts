import { z } from "zod";
import { CURRENCY_OPTIONS, TIMEZONE_OPTIONS } from "@/config/industries";

export const INDUSTRIES = [
  "RESTAURANT",
  "RETAIL",
  "FASHION",
  "BEAUTY",
  "SALON_SPA",
  "HEALTHCARE_ADMIN",
  "HOSPITALITY",
  "REAL_ESTATE",
  "EDUCATION",
  "PROFESSIONAL_SERVICES",
  "GENERAL",
] as const;

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((value) => (value ? value : undefined));

export const createBusinessSchema = z.object({
  name: z.string().trim().min(2, "Enter your business name.").max(80, "Name is too long."),
  industry: z.enum(INDUSTRIES, { error: "Choose an industry." }),
  country: z.string().trim().length(2, "Choose a country.").toUpperCase().default("GH"),
  city: optionalText(80),
  timezone: z.enum(TIMEZONE_OPTIONS, { error: "Choose a timezone." }).default("Africa/Accra"),
  currency: z.enum(CURRENCY_OPTIONS, { error: "Choose a currency." }).default("GHS"),
});

export type CreateBusinessInput = z.infer<typeof createBusinessSchema>;

export const switchBusinessSchema = z.object({ businessId: z.string().min(1).max(64) });

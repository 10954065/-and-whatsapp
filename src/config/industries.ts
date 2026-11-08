import type { Industry } from "@/generated/prisma/enums";

export interface IndustryOption {
  value: Industry;
  label: string;
  description: string;
}

/** Display metadata. Full AI templates for each industry live in config/industry-templates.ts. */
export const INDUSTRY_OPTIONS: IndustryOption[] = [
  { value: "RESTAURANT", label: "Restaurant & food", description: "Menus, orders, delivery and reservations" },
  { value: "RETAIL", label: "Retail shop", description: "Products, stock, orders and delivery" },
  { value: "FASHION", label: "Fashion store", description: "Collections, sizes, orders and styling questions" },
  { value: "BEAUTY", label: "Beauty & cosmetics", description: "Products, routines, orders and consultations" },
  { value: "SALON_SPA", label: "Salon & spa", description: "Services, appointments and reminders" },
  { value: "HEALTHCARE_ADMIN", label: "Healthcare administration", description: "Appointments and front-desk questions (no medical advice)" },
  { value: "HOSPITALITY", label: "Hotel & hospitality", description: "Rooms, availability enquiries and guest questions" },
  { value: "REAL_ESTATE", label: "Real estate", description: "Listings, viewings and lead qualification" },
  { value: "EDUCATION", label: "Education", description: "Courses, admissions and enquiries" },
  { value: "PROFESSIONAL_SERVICES", label: "Professional services", description: "Consultations, quotes and follow-ups" },
  { value: "GENERAL", label: "Other / general business", description: "A flexible setup for any business" },
];

export function industryLabel(industry: Industry): string {
  return INDUSTRY_OPTIONS.find((option) => option.value === industry)?.label ?? "Business";
}

export const CURRENCY_OPTIONS = ["GHS", "NGN", "KES", "ZAR", "XOF", "USD", "GBP", "EUR"] as const;

export const TIMEZONE_OPTIONS = [
  "Africa/Accra",
  "Africa/Lagos",
  "Africa/Abidjan",
  "Africa/Nairobi",
  "Africa/Johannesburg",
  "Africa/Cairo",
  "Europe/London",
  "Europe/Paris",
  "America/New_York",
  "UTC",
] as const;

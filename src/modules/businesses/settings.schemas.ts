import { z } from "zod";
import { CURRENCY_OPTIONS, TIMEZONE_OPTIONS } from "@/config/industries";
import { INDUSTRIES } from "@/modules/businesses/business.schemas";

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Use at most ${max} characters.`)
    .optional()
    .transform((value) => (value ? value : null));

const optionalEmail = z
  .string()
  .trim()
  .toLowerCase()
  .optional()
  .transform((value) => (value ? value : null))
  .pipe(z.email("Enter a valid email address.").nullable());

const optionalWebsite = z
  .string()
  .trim()
  .optional()
  .transform((value) => (value ? value : null))
  .refine((value) => value === null || /^https?:\/\/[^\s]+\.[^\s]+$/i.test(value), "Enter a full web address starting with https://");

export const checkbox = z.preprocess((value) => value === "on" || value === "true" || value === true, z.boolean());

export const businessProfileSchema = z.object({
  name: z.string().trim().min(2, "Enter your business name.").max(80),
  industry: z.enum(INDUSTRIES),
  description: optionalText(2_000),
  phone: optionalText(32),
  email: optionalEmail,
  website: optionalWebsite,
  address: optionalText(200),
  city: optionalText(80),
  country: z.string().trim().length(2).toUpperCase(),
  timezone: z.enum(TIMEZONE_OPTIONS),
  currency: z.enum(CURRENCY_OPTIONS),
});

export type BusinessProfileInput = z.infer<typeof businessProfileSchema>;

export const WEEKDAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;
export type Weekday = (typeof WEEKDAYS)[number];
export type BusinessHours = Record<Weekday, { start: string; end: string }[]>;

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

/**
 * Parses the opening-hours form (`mon_open`, `mon_start`, `mon_end`, …) into
 * {"mon": [{"start": "08:00", "end": "17:00"}], "sun": []}.
 */
export const businessHoursSchema = z.record(z.string(), z.unknown()).transform((raw, context) => {
  const hours = {} as BusinessHours;
  for (const day of WEEKDAYS) {
    const isOpen = raw[`${day}_open`] === "on";
    const start = String(raw[`${day}_start`] ?? "");
    const end = String(raw[`${day}_end`] ?? "");
    if (!isOpen) {
      hours[day] = [];
      continue;
    }
    if (!TIME.test(start) || !TIME.test(end) || end <= start) {
      context.addIssue({ code: "custom", path: [day], message: "Closing time must be after opening time." });
      hours[day] = [];
      continue;
    }
    hours[day] = [{ start, end }];
  }
  return hours;
});

export const notificationSettingsSchema = z.object({
  notificationEmail: optionalEmail,
  notifyOnEscalation: checkbox,
  notifyOnNewOrder: checkbox,
  notifyOnNewBooking: checkbox,
  notifyOnLowStock: checkbox,
  messageRetentionDays: z.coerce.number().int().min(0).max(3_650),
});

export type NotificationSettingsInput = z.infer<typeof notificationSettingsSchema>;

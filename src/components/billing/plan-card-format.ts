import { formatNumber } from "@/lib/format";

export type CardFinish = "paper" | "sun" | "ink";

const FINISHES: CardFinish[] = ["paper", "sun", "ink"];

/** A plan's card finish by its place in price order: cream, then sun, then ink for the top plans. */
export function cardFinish(index: number): CardFinish {
  return FINISHES[Math.min(Math.max(index, 0), FINISHES.length - 1)];
}

const count = (value: unknown): number | null => (typeof value === "number" && Number.isFinite(value) && value > 0 ? value : null);

const ALLOWANCES = [
  { key: "aiMessagesPerMonth", one: "reply", many: "replies" },
  { key: "channels", one: "channel", many: "channels" },
  { key: "staffSeats", one: "seat", many: "seats" },
] as const;

/** The embossed line on a plan card: what the plan includes, in the order customers compare plans. */
export function allowanceLine(limits: unknown): string {
  const record = (limits ?? {}) as Record<string, unknown>;
  return ALLOWANCES.flatMap(({ key, one, many }) => {
    const value = count(record[key]);
    return value === null ? [] : [`${formatNumber(value)} ${value === 1 ? one : many}`];
  }).join(" · ");
}

/** What paying yearly saves against twelve monthly payments, or null when it saves nothing. */
export function yearlySavingMinor(monthlyMinor: number, yearlyMinor: number): number | null {
  const saving = monthlyMinor * 12 - yearlyMinor;
  return saving > 0 ? saving : null;
}

/** "2 months free" when every plan's yearly price works out to the same whole number of free months. */
export function freeMonthsLabel(plans: { priceMonthlyMinor: number; priceYearlyMinor: number }[]): string | null {
  const months = plans.map((plan) => (plan.priceMonthlyMinor > 0 ? (plan.priceMonthlyMinor * 12 - plan.priceYearlyMinor) / plan.priceMonthlyMinor : 0));
  const [first] = months;
  if (first === undefined || !Number.isInteger(first) || first <= 0 || months.some((value) => value !== first)) return null;
  return first === 1 ? "1 month free" : `${first} months free`;
}

/** Card-style end date (MM/YY) in the business's time zone. */
export function validThru(date: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-GB", { month: "2-digit", year: "2-digit", timeZone }).formatToParts(date);
  const part = (type: "month" | "year") => parts.find((entry) => entry.type === type)?.value ?? "";
  return `${part("month")}/${part("year")}`;
}

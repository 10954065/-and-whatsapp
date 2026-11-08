/** Formats integer minor units (e.g. pesewas) as a localised currency string. */
export function formatMoney(minor: number, currency = "GHS", options: { compact?: boolean } = {}): string {
  return new Intl.NumberFormat("en-GH", {
    style: "currency",
    currency,
    notation: options.compact ? "compact" : "standard",
    maximumFractionDigits: minor % 100 === 0 ? 0 : 2,
  }).format(minor / 100);
}

export function formatNumber(value: number): string {
  return new Intl.NumberFormat("en-GH").format(value);
}

/** Date/time in the business's timezone, e.g. "Mon 9 Nov, 14:30". */
export function formatDateTime(date: Date, timezone: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: timezone,
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export function formatDate(date: Date, timezone: string): string {
  return new Intl.DateTimeFormat("en-GB", { timeZone: timezone, day: "numeric", month: "short", year: "numeric" }).format(date);
}

export function formatRelative(date: Date, now: Date = new Date()): string {
  const seconds = Math.round((date.getTime() - now.getTime()) / 1000);
  const units: [Intl.RelativeTimeFormatUnit, number][] = [
    ["year", 31_536_000],
    ["month", 2_592_000],
    ["week", 604_800],
    ["day", 86_400],
    ["hour", 3_600],
    ["minute", 60],
  ];
  const formatter = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
  for (const [unit, size] of units) {
    if (Math.abs(seconds) >= size) return formatter.format(Math.round(seconds / size), unit);
  }
  return "just now";
}

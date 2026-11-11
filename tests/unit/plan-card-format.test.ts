import { describe, expect, it } from "vitest";
import { allowanceLine, cardFinish, freeMonthsLabel, validThru, yearlySavingMinor } from "@/components/billing/plan-card-format";

describe("plan card formatting", () => {
  it("gives plans cream, sun and ink finishes in price order", () => {
    expect([0, 1, 2, 3].map(cardFinish)).toEqual(["paper", "sun", "ink", "ink"]);
  });

  it("lists replies, channels and seats with singular and plural wording", () => {
    expect(allowanceLine({ aiMessagesPerMonth: 1500, channels: 1, staffSeats: 2 })).toBe("1,500 replies · 1 channel · 2 seats");
    expect(allowanceLine({ aiMessagesPerMonth: 1, channels: 5, staffSeats: 1 })).toBe("1 reply · 5 channels · 1 seat");
  });

  it("leaves out limits that are missing, zero or not numbers", () => {
    expect(allowanceLine({ aiMessagesPerMonth: 6000, channels: 0, staffSeats: "10" })).toBe("6,000 replies");
    expect(allowanceLine(null)).toBe("");
  });

  it("works out what paying yearly saves, or nothing when it does not", () => {
    expect(yearlySavingMinor(29_900, 299_000)).toBe(59_800);
    expect(yearlySavingMinor(29_900, 358_800)).toBeNull();
  });

  it("names the free months only when every plan gives the same whole number", () => {
    const starter = { priceMonthlyMinor: 29_900, priceYearlyMinor: 299_000 };
    const business = { priceMonthlyMinor: 79_900, priceYearlyMinor: 799_000 };
    expect(freeMonthsLabel([starter, business])).toBe("2 months free");
    expect(freeMonthsLabel([{ priceMonthlyMinor: 10_000, priceYearlyMinor: 110_000 }])).toBe("1 month free");
    expect(freeMonthsLabel([starter, { priceMonthlyMinor: 79_900, priceYearlyMinor: 800_000 }])).toBeNull();
    expect(freeMonthsLabel([])).toBeNull();
  });

  it("writes the end date as month and year in the business's time zone", () => {
    expect(validThru(new Date("2026-11-30T23:30:00Z"), "Africa/Accra")).toBe("11/26");
    expect(validThru(new Date("2026-11-30T23:30:00Z"), "Asia/Tokyo")).toBe("12/26");
  });
});

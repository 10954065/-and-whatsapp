import { describe, expect, it } from "vitest";
import { niceCeiling } from "@/components/analytics/daily-column-chart";
import { hmacHex } from "@/lib/security/crypto";
import { localDateRange, parseRange } from "@/modules/analytics/analytics.service";
import { addMonths, isSubscriptionLapsed, nextPeriod, unusedTimeCredit } from "@/modules/billing/billing.service";
import { verifyPaystackSignature } from "@/modules/billing/paystack";

describe("billing periods", () => {
  it("adds calendar months and clamps to the end of shorter months", () => {
    expect(addMonths(new Date("2027-01-31T10:00:00Z"), 1).toISOString()).toBe("2027-02-28T10:00:00.000Z");
    expect(addMonths(new Date("2028-01-31T10:00:00Z"), 1).toISOString()).toBe("2028-02-29T10:00:00.000Z");
    expect(addMonths(new Date("2026-11-08T12:00:00Z"), 12).toISOString()).toBe("2027-11-08T12:00:00.000Z");
  });

  it("extends a running period for the same plan and starts fresh otherwise", () => {
    const now = new Date("2026-11-08T12:00:00Z");
    const running = { planId: "p1", interval: "MONTHLY" as const, status: "ACTIVE" as const, currentPeriodEnd: new Date("2026-11-20T12:00:00Z") };
    expect(nextPeriod(running, "p1", "MONTHLY", now)).toEqual({ start: running.currentPeriodEnd, end: new Date("2026-12-20T12:00:00Z") });
    expect(nextPeriod(running, "p2", "MONTHLY", now).start).toEqual(now);
    expect(nextPeriod(running, "p1", "YEARLY", now)).toEqual({ start: now, end: new Date("2027-11-08T12:00:00Z") });
    expect(nextPeriod({ ...running, status: "GRACE" }, "p1", "MONTHLY", now).start).toEqual(now);
    expect(nextPeriod(null, "p1", "MONTHLY", now).start).toEqual(now);
  });

  it("credits unused time at the two plans' daily rates when switching", () => {
    const now = new Date("2026-11-08T12:00:00Z");
    const starter = { priceMonthlyMinor: 30_000, priceYearlyMinor: 300_000 };
    const business = { priceMonthlyMinor: 90_000, priceYearlyMinor: 900_000 };
    const current = { status: "ACTIVE" as const, interval: "MONTHLY" as const, currentPeriodEnd: new Date("2026-11-23T12:00:00Z"), plan: starter };
    expect(unusedTimeCredit(current, business, "MONTHLY", now)).toBe(5 * 86_400_000);
    expect(unusedTimeCredit({ ...current, status: "GRACE" }, business, "MONTHLY", now)).toBe(0);
    expect(nextPeriod(null, "p2", "MONTHLY", now, 5 * 86_400_000).end.toISOString()).toBe("2026-12-13T12:00:00.000Z");
  });

  it("treats ended trials, expiry and cancellation as lapsed", () => {
    const now = new Date("2026-11-08T12:00:00Z");
    expect(isSubscriptionLapsed(null, now)).toBe(false);
    expect(isSubscriptionLapsed({ status: "TRIALING", trialEndsAt: new Date("2026-11-01T00:00:00Z") }, now)).toBe(true);
    expect(isSubscriptionLapsed({ status: "TRIALING", trialEndsAt: new Date("2026-11-20T00:00:00Z") }, now)).toBe(false);
    expect(isSubscriptionLapsed({ status: "GRACE", trialEndsAt: null }, now)).toBe(false);
    expect(isSubscriptionLapsed({ status: "EXPIRED", trialEndsAt: null }, now)).toBe(true);
  });
});

describe("Paystack webhook signature", () => {
  const secret = "sk_test_signature_secret";
  const body = JSON.stringify({ event: "charge.success", data: { reference: "sl-123" } });

  it("accepts the HMAC-SHA512 of the raw body and rejects anything else", () => {
    expect(verifyPaystackSignature(body, hmacHex("sha512", secret, body), secret)).toBe(true);
    expect(verifyPaystackSignature(`${body} `, hmacHex("sha512", secret, body), secret)).toBe(false);
    expect(verifyPaystackSignature(body, hmacHex("sha256", secret, body), secret)).toBe(false);
    expect(verifyPaystackSignature(body, null, secret)).toBe(false);
    expect(verifyPaystackSignature(body, hmacHex("sha512", secret, body), undefined)).toBe(false);
  });
});

describe("analytics helpers", () => {
  it("lists local calendar days ending today in the business timezone", () => {
    const lateEvening = new Date("2026-11-08T23:30:00Z");
    expect(localDateRange(lateEvening, "Africa/Accra", 3)).toEqual(["2026-11-06", "2026-11-07", "2026-11-08"]);
    expect(localDateRange(lateEvening, "Africa/Lagos", 3)).toEqual(["2026-11-07", "2026-11-08", "2026-11-09"]);
    expect(localDateRange(new Date("2026-03-01T08:00:00Z"), "UTC", 2)).toEqual(["2026-02-28", "2026-03-01"]);
  });

  it("only accepts the supported ranges", () => {
    expect(parseRange("7")).toBe(7);
    expect(parseRange("90")).toBe(90);
    expect(parseRange("365")).toBe(30);
    expect(parseRange(undefined)).toBe(30);
  });

  it("rounds chart axes up to clean numbers", () => {
    expect([0, 1, 7, 12, 45, 101, 2_500].map(niceCeiling)).toEqual([1, 1, 10, 20, 50, 200, 5_000]);
  });
});

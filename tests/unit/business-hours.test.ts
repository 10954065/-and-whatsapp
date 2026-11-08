import { describe, expect, it } from "vitest";
import { businessHoursSchema } from "@/modules/businesses/settings.schemas";
import { isWithinBusinessHours } from "@/modules/businesses/settings.service";

describe("businessHoursSchema", () => {
  it("turns the form into per-day intervals and closed days", () => {
    const hours = businessHoursSchema.parse({
      mon_open: "on",
      mon_start: "08:00",
      mon_end: "17:00",
      sat_open: "on",
      sat_start: "09:00",
      sat_end: "13:30",
    });
    expect(hours.mon).toEqual([{ start: "08:00", end: "17:00" }]);
    expect(hours.sat).toEqual([{ start: "09:00", end: "13:30" }]);
    expect(hours.sun).toEqual([]);
  });

  it("rejects a closing time before the opening time", () => {
    const result = businessHoursSchema.safeParse({ tue_open: "on", tue_start: "18:00", tue_end: "09:00" });
    expect(result.success).toBe(false);
  });
});

describe("isWithinBusinessHours", () => {
  const hours = businessHoursSchema.parse({ mon_open: "on", mon_start: "08:00", mon_end: "17:00" });

  it("evaluates opening hours in the business timezone", () => {
    // Monday 9 Nov 2026, 10:00 in Accra (UTC+0).
    expect(isWithinBusinessHours(hours, "Africa/Accra", new Date("2026-11-09T10:00:00Z"))).toBe(true);
    // Same instant is 11:00 in Lagos (UTC+1) — still open; 18:30 Accra is closed.
    expect(isWithinBusinessHours(hours, "Africa/Lagos", new Date("2026-11-09T10:00:00Z"))).toBe(true);
    expect(isWithinBusinessHours(hours, "Africa/Accra", new Date("2026-11-09T18:30:00Z"))).toBe(false);
    // 16:30 UTC is 17:30 in Lagos → closed there but open in Accra.
    expect(isWithinBusinessHours(hours, "Africa/Lagos", new Date("2026-11-09T16:30:00Z"))).toBe(false);
    expect(isWithinBusinessHours(hours, "Africa/Accra", new Date("2026-11-09T16:30:00Z"))).toBe(true);
  });

  it("treats unset hours as always open and closed days as closed", () => {
    expect(isWithinBusinessHours(null, "Africa/Accra")).toBe(true);
    expect(isWithinBusinessHours(hours, "Africa/Accra", new Date("2026-11-08T10:00:00Z"))).toBe(false);
  });
});

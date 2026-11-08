import { describe, expect, it } from "vitest";
import { z } from "zod";
import { formDataToObject, parseInput, safeRedirectPath } from "@/lib/http/action";
import { AppError } from "@/lib/monitoring/errors";

describe("safeRedirectPath", () => {
  it.each([
    ["/app/inbox", "/app/inbox"],
    ["/app/orders?status=PAID", "/app/orders?status=PAID"],
    ["//evil.example", "/fallback"],
    ["https://evil.example", "/fallback"],
    ["/\\evil.example", "/fallback"],
    ["javascript:alert(1)", "/fallback"],
    [undefined, "/fallback"],
  ])("maps %s to %s", (input, expected) => {
    expect(safeRedirectPath(input, "/fallback")).toBe(expected);
  });
});

describe("formDataToObject", () => {
  it("collects repeated keys into arrays and skips Next.js action fields", () => {
    const formData = new FormData();
    formData.append("name", "Ama");
    formData.append("tag", "vip");
    formData.append("tag", "wholesale");
    formData.append("$ACTION_ID_123", "x");
    expect(formDataToObject(formData)).toEqual({ name: "Ama", tag: ["vip", "wholesale"] });
  });
});

describe("parseInput", () => {
  const schema = z.object({ email: z.email("Bad email"), age: z.coerce.number().int().min(18) });

  it("returns parsed data", () => {
    expect(parseInput(schema, { email: "a@b.co", age: "21" })).toEqual({ email: "a@b.co", age: 21 });
  });

  it("throws a VALIDATION AppError with per-field messages", () => {
    try {
      parseInput(schema, { email: "nope", age: "3" });
      expect.unreachable();
    } catch (error) {
      expect(error).toBeInstanceOf(AppError);
      const appError = error as AppError;
      expect(appError.code).toBe("VALIDATION");
      expect(appError.fieldErrors?.email).toEqual(["Bad email"]);
      expect(appError.fieldErrors?.age).toHaveLength(1);
    }
  });
});

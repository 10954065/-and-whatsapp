import { describe, expect, it } from "vitest";
import { PERMISSIONS, assignableRoles, can } from "@/config/permissions";

describe("role permission matrix", () => {
  it("grants owners every permission", () => {
    for (const permission of PERMISSIONS) expect(can("OWNER", permission)).toBe(true);
  });

  it("reserves billing management and workspace deletion for owners", () => {
    for (const role of ["ADMIN", "MANAGER", "STAFF", "READONLY"] as const) {
      expect(can(role, "billing.manage")).toBe(false);
      expect(can(role, "business.delete")).toBe(false);
    }
  });

  it("keeps read-only members from writing anything", () => {
    const writes = PERMISSIONS.filter((permission) => !permission.endsWith(".read"));
    for (const permission of writes) expect(can("READONLY", permission)).toBe(false);
  });

  it("lets staff reply and take orders but not manage AI, team or integrations", () => {
    expect(can("STAFF", "inbox.reply")).toBe(true);
    expect(can("STAFF", "orders.write")).toBe(true);
    expect(can("STAFF", "ai.manage")).toBe(false);
    expect(can("STAFF", "team.manage")).toBe(false);
    expect(can("STAFF", "integrations.manage")).toBe(false);
    expect(can("STAFF", "billing.read")).toBe(false);
  });

  it("lets managers decide approvals but not refunds", () => {
    expect(can("MANAGER", "approvals.decide")).toBe(true);
    expect(can("MANAGER", "orders.refund")).toBe(false);
  });

  it("never lets a member assign a role at or above their own", () => {
    expect(assignableRoles("OWNER")).not.toContain("OWNER");
    expect(assignableRoles("ADMIN")).toEqual(["MANAGER", "STAFF", "READONLY"]);
    expect(assignableRoles("MANAGER")).toEqual([]);
    expect(assignableRoles("STAFF")).toEqual([]);
  });
});

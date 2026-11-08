import type { MemberRole } from "@/generated/prisma/enums";

export const PERMISSIONS = [
  "business.read",
  "business.update",
  "business.delete",
  "team.read",
  "team.manage",
  "billing.read",
  "billing.manage",
  "integrations.read",
  "integrations.manage",
  "ai.read",
  "ai.manage",
  "knowledge.read",
  "knowledge.manage",
  "inbox.read",
  "inbox.reply",
  "inbox.manage",
  "customers.read",
  "customers.write",
  "customers.delete",
  "leads.read",
  "leads.write",
  "products.read",
  "products.write",
  "inventory.write",
  "orders.read",
  "orders.write",
  "orders.refund",
  "bookings.read",
  "bookings.write",
  "services.write",
  "automation.read",
  "automation.manage",
  "analytics.read",
  "audit.read",
  "approvals.decide",
  "data.export",
] as const;

export type Permission = (typeof PERMISSIONS)[number];

const READ_ONLY: Permission[] = [
  "business.read",
  "team.read",
  "integrations.read",
  "ai.read",
  "knowledge.read",
  "inbox.read",
  "customers.read",
  "leads.read",
  "products.read",
  "orders.read",
  "bookings.read",
  "automation.read",
  "analytics.read",
];

const STAFF: Permission[] = [
  ...READ_ONLY.filter((permission) => permission !== "analytics.read" && permission !== "automation.read"),
  "inbox.reply",
  "customers.write",
  "leads.write",
  "orders.write",
  "bookings.write",
];

const MANAGER: Permission[] = [
  ...READ_ONLY,
  "inbox.reply",
  "inbox.manage",
  "customers.write",
  "leads.write",
  "products.write",
  "inventory.write",
  "orders.write",
  "bookings.write",
  "services.write",
  "knowledge.manage",
  "approvals.decide",
];

const OWNER_ONLY: Permission[] = ["business.delete", "billing.manage"];

const ADMIN: Permission[] = PERMISSIONS.filter((permission) => !OWNER_ONLY.includes(permission));

export const ROLE_PERMISSIONS: Record<MemberRole, ReadonlySet<Permission>> = {
  OWNER: new Set(PERMISSIONS),
  ADMIN: new Set(ADMIN),
  MANAGER: new Set(MANAGER),
  STAFF: new Set(STAFF),
  READONLY: new Set(READ_ONLY),
};

export function can(role: MemberRole, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role].has(permission);
}

/** Roles a member with `actorRole` may assign to others (never above their own). */
export function assignableRoles(actorRole: MemberRole): MemberRole[] {
  switch (actorRole) {
    case "OWNER":
      return ["ADMIN", "MANAGER", "STAFF", "READONLY"];
    case "ADMIN":
      return ["MANAGER", "STAFF", "READONLY"];
    default:
      return [];
  }
}

export const ROLE_LABELS: Record<MemberRole, string> = {
  OWNER: "Owner",
  ADMIN: "Admin",
  MANAGER: "Manager",
  STAFF: "Staff",
  READONLY: "Read-only",
};

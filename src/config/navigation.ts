import type { Permission } from "@/config/permissions";

export type NavIcon =
  | "dashboard"
  | "setup"
  | "inbox"
  | "customers"
  | "leads"
  | "orders"
  | "bookings"
  | "products"
  | "inventory"
  | "services"
  | "automation"
  | "analytics"
  | "ai"
  | "knowledge"
  | "integrations"
  | "team"
  | "billing"
  | "settings";

export interface NavItem {
  href: string;
  label: string;
  icon: NavIcon;
  permission: Permission;
}

export interface NavSection {
  title: string;
  items: NavItem[];
}

/** Sidebar navigation. Items are filtered by the member's permissions at render time. */
export const APP_NAVIGATION: NavSection[] = [
  {
    title: "Overview",
    items: [
      { href: "/app/dashboard", label: "Dashboard", icon: "dashboard", permission: "business.read" },
    ],
  },
];

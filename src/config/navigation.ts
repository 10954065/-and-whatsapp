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
      { href: "/app/setup", label: "Setup guide", icon: "setup", permission: "business.read" },
      { href: "/app/inbox", label: "Inbox", icon: "inbox", permission: "inbox.read" },
      { href: "/app/analytics", label: "Analytics", icon: "analytics", permission: "analytics.read" },
    ],
  },
  {
    title: "Business",
    items: [
      { href: "/app/customers", label: "Customers", icon: "customers", permission: "customers.read" },
      { href: "/app/leads", label: "Leads", icon: "leads", permission: "leads.read" },
      { href: "/app/orders", label: "Orders", icon: "orders", permission: "orders.read" },
      { href: "/app/products", label: "Products", icon: "products", permission: "products.read" },
      { href: "/app/inventory", label: "Inventory", icon: "inventory", permission: "products.read" },
      { href: "/app/bookings", label: "Bookings", icon: "bookings", permission: "bookings.read" },
      { href: "/app/services", label: "Services & staff", icon: "services", permission: "bookings.read" },
    ],
  },
  {
    title: "Assistant",
    items: [
      { href: "/app/ai-agents", label: "Assistant", icon: "ai", permission: "ai.read" },
      { href: "/app/knowledge", label: "Knowledge base", icon: "knowledge", permission: "knowledge.read" },
      { href: "/app/automation", label: "Automation", icon: "automation", permission: "automation.read" },
    ],
  },
  {
    title: "Workspace",
    items: [
      { href: "/app/integrations", label: "Integrations", icon: "integrations", permission: "integrations.read" },
      { href: "/app/team", label: "Team", icon: "team", permission: "team.read" },
      { href: "/app/billing", label: "Billing", icon: "billing", permission: "billing.manage" },
      { href: "/app/settings", label: "Settings", icon: "settings", permission: "business.read" },
    ],
  },
];

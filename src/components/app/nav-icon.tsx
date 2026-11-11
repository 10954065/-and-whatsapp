import {
  BarChart3,
  BookOpen,
  Boxes,
  CalendarClock,
  CreditCard,
  LayoutGrid,
  ListChecks,
  MessagesSquare,
  Package,
  Cable,
  Settings,
  ShoppingBag,
  ConciergeBell,
  Headset,
  Workflow,
  Target,
  UserRound,
  Users,
  UsersRound,
  type LucideIcon,
} from "lucide-react";
import type { NavIcon } from "@/config/navigation";

const ICONS: Record<NavIcon, LucideIcon> = {
  dashboard: LayoutGrid,
  setup: ListChecks,
  inbox: MessagesSquare,
  customers: Users,
  leads: Target,
  orders: ShoppingBag,
  bookings: CalendarClock,
  products: Package,
  inventory: Boxes,
  services: ConciergeBell,
  automation: Workflow,
  analytics: BarChart3,
  ai: Headset,
  knowledge: BookOpen,
  integrations: Cable,
  team: UsersRound,
  billing: CreditCard,
  settings: Settings,
  account: UserRound,
};

export function NavIconGlyph({ icon, className }: { icon: NavIcon; className?: string }) {
  const Icon = ICONS[icon];
  return <Icon className={className} aria-hidden="true" />;
}

import {
  BarChart3,
  Blocks,
  BookOpen,
  Bot,
  Boxes,
  CalendarClock,
  CreditCard,
  LayoutDashboard,
  ListChecks,
  MessagesSquare,
  Package,
  Plug,
  Settings,
  ShoppingBag,
  Sparkles,
  Target,
  Users,
  UsersRound,
  type LucideIcon,
} from "lucide-react";
import type { NavIcon } from "@/config/navigation";

const ICONS: Record<NavIcon, LucideIcon> = {
  dashboard: LayoutDashboard,
  setup: ListChecks,
  inbox: MessagesSquare,
  customers: Users,
  leads: Target,
  orders: ShoppingBag,
  bookings: CalendarClock,
  products: Package,
  inventory: Boxes,
  services: Sparkles,
  automation: Blocks,
  analytics: BarChart3,
  ai: Bot,
  knowledge: BookOpen,
  integrations: Plug,
  team: UsersRound,
  billing: CreditCard,
  settings: Settings,
};

export function NavIconGlyph({ icon, className }: { icon: NavIcon; className?: string }) {
  const Icon = ICONS[icon];
  return <Icon className={className} aria-hidden="true" />;
}

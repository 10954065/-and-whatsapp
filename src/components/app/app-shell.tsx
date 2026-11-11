"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { motion } from "motion/react";
import { Bell, Check, ChevronsUpDown, LogOut, Menu, Plus, ShieldCheck, UserRound } from "lucide-react";
import { Logo, LogoMark } from "@/components/brand/logo";
import { NavIconGlyph } from "@/components/app/nav-icon";
import { ThemeToggle } from "@/components/theme-toggle";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import type { NavSection } from "@/config/navigation";
import { cn } from "@/lib/utils";
import { logoutAction } from "@/modules/auth/auth.actions";
import { switchBusinessAction } from "@/modules/businesses/business.actions";

export interface ShellBusiness {
  id: string;
  name: string;
  roleLabel: string;
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

function NavLinks({ sections, onNavigate, layoutId }: { sections: NavSection[]; onNavigate?: () => void; layoutId: string }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Main navigation" className="grid gap-5">
      {sections.map((section) => (
        <div key={section.title} className="grid gap-0.5">
          <p className="px-2.5 pb-1 text-[12px] font-medium text-muted-foreground">{section.title}</p>
          {section.items.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onNavigate}
                aria-current={isActive ? "page" : undefined}
                className={cn(
                  "group relative flex h-9 items-center gap-3 rounded-[10px] px-2.5 text-[14px] transition-colors duration-150",
                  isActive ? "font-medium text-foreground" : "text-foreground/70 hover:bg-foreground/4.5 hover:text-foreground",
                )}
              >
                {isActive ? (
                  <motion.span
                    layoutId={layoutId}
                    className="absolute inset-0 rounded-[10px] bg-sidebar-accent shadow-[var(--shadow-hairline),0_1px_3px_rgb(0_0_0/0.06)]"
                    transition={{ type: "spring", bounce: 0.12, duration: 0.38 }}
                  />
                ) : null}
                <NavIconGlyph
                  icon={item.icon}
                  className={cn("relative size-4.5 shrink-0", isActive ? "text-sun-ink" : "text-foreground/55 group-hover:text-foreground/80")}
                />
                <span className="relative">{item.label}</span>
              </Link>
            );
          })}
        </div>
      ))}
    </nav>
  );
}

function WorkspaceSwitcher({ business, businesses, className }: { business: ShellBusiness; businesses: ShellBusiness[]; className?: string }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className={cn(
            "pressable flex w-full min-w-0 items-center gap-2.5 rounded-xl p-1.5 pr-2.5 text-left transition-colors hover:bg-foreground/4.5 aria-expanded:bg-foreground/4.5",
            className,
          )}
        >
          <span className="flex size-8 shrink-0 items-center justify-center rounded-[9px] bg-[#1d1a16] text-[11px] font-semibold text-[#f6b383]">
            {initials(business.name)}
          </span>
          <span className="min-w-0 flex-1 leading-tight">
            <span className="block truncate text-[14px] font-semibold">{business.name}</span>
            <span className="block truncate text-[12px] text-muted-foreground">{business.roleLabel}</span>
          </span>
          <ChevronsUpDown className="size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64">
        <DropdownMenuLabel>Workspaces</DropdownMenuLabel>
        {businesses.map((entry) => (
          <form key={entry.id} action={switchBusinessAction}>
            <input type="hidden" name="businessId" value={entry.id} />
            <DropdownMenuItem asChild>
              <button type="submit" className="w-full">
                <span className="flex-1 truncate text-left">{entry.name}</span>
                <span className="text-xs text-muted-foreground">{entry.roleLabel}</span>
                {entry.id === business.id ? <Check className="size-4 text-sun-ink" /> : null}
              </button>
            </DropdownMenuItem>
          </form>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/onboarding?new=1">
            <Plus /> New workspace
          </Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function AppSidebar({ sections, business, businesses }: { sections: NavSection[]; business: ShellBusiness; businesses: ShellBusiness[] }) {
  return (
    <aside className="sticky top-0 hidden h-svh w-66 shrink-0 flex-col border-r border-sidebar-border bg-sidebar lg:flex">
      <div className="flex items-center gap-2 px-4 pt-4 pb-3">
        <Logo href="/app/dashboard" />
      </div>
      <div className="px-3 pb-3">
        <WorkspaceSwitcher business={business} businesses={businesses} />
      </div>
      <div className="flex-1 overflow-y-auto px-3 pt-2 pb-6">
        <NavLinks sections={sections} layoutId="sidebar-active" />
      </div>
    </aside>
  );
}

export function AppTopbar({
  sections,
  business,
  businesses,
  user,
  unreadNotifications,
  isPlatformAdmin = false,
}: {
  sections: NavSection[];
  business: ShellBusiness;
  businesses: ShellBusiness[];
  user: { name: string; email: string };
  unreadNotifications: number;
  isPlatformAdmin?: boolean;
}) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const notificationsLabel = unreadNotifications > 0 ? `Notifications, ${unreadNotifications} unread` : "Notifications";
  return (
    <header className="chrome-bar sticky top-0 z-30 flex h-14 items-center gap-2 px-3 lg:px-8">
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetTrigger asChild>
          <Button variant="ghost" size="icon" className="lg:hidden" aria-label="Open navigation">
            <Menu />
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="w-[18rem] border-sidebar-border bg-sidebar p-0">
          <SheetHeader className="px-4 pt-4 pb-2">
            <SheetTitle className="sr-only">Navigation</SheetTitle>
            <Logo href="/app/dashboard" />
          </SheetHeader>
          <div className="overflow-y-auto px-3 pb-6">
            <NavLinks sections={sections} onNavigate={() => setMobileOpen(false)} layoutId="sheet-active" />
          </div>
        </SheetContent>
      </Sheet>

      <LogoMark className="size-7 lg:hidden" />
      <div className="min-w-0 flex-1 lg:hidden">
        <WorkspaceSwitcher business={business} businesses={businesses} className="max-w-60" />
      </div>

      <div className="ml-auto flex items-center gap-0.5">
        <Button asChild variant="ghost" size="icon" className="relative">
          <Link href="/app/notifications" aria-label={notificationsLabel}>
            <Bell />
            {unreadNotifications > 0 ? (
              <span
                className="absolute top-1 right-1 flex min-w-[17px] items-center justify-center rounded-full bg-sun px-1 text-[10px] leading-[17px] font-semibold text-[#1d1a16] ring-2 ring-chrome"
                aria-hidden="true"
              >
                {unreadNotifications > 99 ? "99+" : unreadNotifications}
              </span>
            ) : null}
          </Link>
        </Button>
        <ThemeToggle />
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="ml-1 rounded-full" aria-label="Account menu">
              <Avatar className="size-8">
                <AvatarFallback className="bg-foreground text-[11px] font-semibold text-background">{initials(user.name)}</AvatarFallback>
              </Avatar>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-64">
            <DropdownMenuLabel className="grid">
              <span className="truncate">{user.name}</span>
              <span className="truncate text-xs font-normal text-muted-foreground">{user.email}</span>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href="/app/account">
                <UserRound /> Account & security
              </Link>
            </DropdownMenuItem>
            {isPlatformAdmin ? (
              <DropdownMenuItem asChild>
                <Link href="/admin">
                  <ShieldCheck /> Admin console
                </Link>
              </DropdownMenuItem>
            ) : null}
            <DropdownMenuSeparator />
            <form action={logoutAction}>
              <DropdownMenuItem asChild>
                <button type="submit" className="w-full">
                  <LogOut /> Sign out
                </button>
              </DropdownMenuItem>
            </form>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}

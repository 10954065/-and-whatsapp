"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Check, ChevronsUpDown, LogOut, Menu, Plus, UserRound } from "lucide-react";
import { Logo } from "@/components/brand/logo";
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

function NavLinks({ sections, onNavigate }: { sections: NavSection[]; onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Main navigation" className="grid gap-6">
      {sections.map((section) => (
        <div key={section.title} className="grid gap-1">
          <p className="px-3 pb-1 text-[11px] font-semibold tracking-[0.14em] text-sidebar-foreground/45 uppercase">
            {section.title}
          </p>
          {section.items.map((item) => {
            const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onNavigate}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "group flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                  active
                    ? "bg-sidebar-accent text-sidebar-accent-foreground shadow-[inset_2px_0_0_var(--sidebar-primary)]"
                    : "text-sidebar-foreground/75 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground",
                )}
              >
                <NavIconGlyph
                  icon={item.icon}
                  className={cn("size-4", active ? "text-sidebar-primary" : "opacity-70 group-hover:opacity-100")}
                />
                {item.label}
              </Link>
            );
          })}
        </div>
      ))}
    </nav>
  );
}

export function AppSidebar({ sections }: { sections: NavSection[] }) {
  return (
    <aside className="sticky top-0 hidden h-svh w-64 shrink-0 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground lg:flex">
      <div className="px-5 py-5">
        <Logo href="/app/dashboard" inverted />
      </div>
      <div className="flex-1 overflow-y-auto px-3 pb-6">
        <NavLinks sections={sections} />
      </div>
    </aside>
  );
}

export function AppTopbar({
  sections,
  business,
  businesses,
  user,
}: {
  sections: NavSection[];
  business: ShellBusiness;
  businesses: ShellBusiness[];
  user: { name: string; email: string };
}) {
  const [mobileOpen, setMobileOpen] = useState(false);
  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b bg-background/85 px-4 backdrop-blur lg:px-8">
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetTrigger asChild>
          <Button variant="ghost" size="icon" className="lg:hidden" aria-label="Open navigation">
            <Menu />
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="w-72 border-sidebar-border bg-sidebar p-0 text-sidebar-foreground">
          <SheetHeader className="px-5 py-5">
            <SheetTitle className="sr-only">Navigation</SheetTitle>
            <Logo href="/app/dashboard" inverted />
          </SheetHeader>
          <div className="px-3 pb-6">
            <NavLinks sections={sections} onNavigate={() => setMobileOpen(false)} />
          </div>
        </SheetContent>
      </Sheet>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" className="h-9 max-w-[16rem] gap-2 px-2">
            <span className="flex size-6 items-center justify-center rounded-md bg-primary/12 text-[11px] font-bold text-primary">
              {initials(business.name)}
            </span>
            <span className="truncate font-semibold">{business.name}</span>
            <ChevronsUpDown className="size-3.5 opacity-60" />
          </Button>
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
                  {entry.id === business.id ? <Check className="size-4 text-primary" /> : null}
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

      <div className="ml-auto flex items-center gap-1">
        <ThemeToggle />
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="rounded-full" aria-label="Account menu">
              <Avatar className="size-8">
                <AvatarFallback className="bg-navy text-xs font-semibold text-white">{initials(user.name)}</AvatarFallback>
              </Avatar>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-60">
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

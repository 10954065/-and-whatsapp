"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { motion } from "motion/react";
import {
  Activity,
  ArrowLeft,
  Building2,
  Inbox,
  Layers,
  LayoutGrid,
  Megaphone,
  Menu,
  ScrollText,
  Settings,
  UserRound,
  type LucideIcon,
} from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

const ADMIN_NAV: Array<{ href: string; label: string; icon: LucideIcon }> = [
  { href: "/admin", label: "Overview", icon: LayoutGrid },
  { href: "/admin/businesses", label: "Businesses", icon: Building2 },
  { href: "/admin/plans", label: "Plans", icon: Layers },
  { href: "/admin/monitoring", label: "Monitoring", icon: Activity },
  { href: "/admin/inquiries", label: "Inquiries", icon: Inbox },
  { href: "/admin/announcements", label: "Announcements", icon: Megaphone },
  { href: "/admin/settings", label: "Settings", icon: Settings },
  { href: "/admin/audit", label: "Audit log", icon: ScrollText },
];

const isActiveRoute = (pathname: string, href: string) => (href === "/admin" ? pathname === "/admin" : pathname.startsWith(href));

/** The tab row under the header, from tablet width up. */
export function AdminTabs() {
  const pathname = usePathname();
  return (
    <nav aria-label="Admin" className="-mx-1 hidden gap-0.5 overflow-x-auto px-1 text-[13.5px] md:flex">
      {ADMIN_NAV.map((item) => {
        const isActive = isActiveRoute(pathname, item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={isActive ? "page" : undefined}
            className={cn("relative shrink-0 rounded-full px-3.5 py-1.5 font-medium transition-colors", isActive ? "text-[#1d1a16]" : "text-white/60 hover:text-white")}
          >
            {isActive ? (
              <motion.span layoutId="admin-nav-active" className="absolute inset-0 rounded-full bg-[#f3efe7]" transition={{ type: "spring", bounce: 0.12, duration: 0.38 }} />
            ) : null}
            <span className="relative">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

/** On phones the sections move into a side bar, styled like the workspace sidebar. */
export function AdminMenu() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);
  const linkClass = (isActive: boolean) =>
    cn(
      "group relative flex h-10 items-center gap-3 rounded-[10px] px-2.5 text-[14px] transition-colors duration-150",
      isActive ? "font-medium text-foreground" : "text-foreground/70 hover:bg-foreground/4.5 hover:text-foreground",
    );
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="ml-auto text-white/75 hover:bg-white/10 hover:text-white md:hidden" aria-label="Open admin menu">
          <Menu />
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-[18rem] border-sidebar-border bg-sidebar p-0">
        <SheetHeader className="flex-row items-center gap-2.5 px-4 pt-4 pb-3">
          <SheetTitle className="sr-only">Admin menu</SheetTitle>
          <Logo href="/admin" />
          <span className="rounded-full bg-sun px-2 py-0.5 text-[10px] font-semibold text-[#1d1a16]">Admin</span>
        </SheetHeader>
        <div className="flex flex-1 flex-col overflow-y-auto px-3 pb-6">
          <nav aria-label="Admin" className="grid gap-0.5">
            {ADMIN_NAV.map((item) => {
              const isActive = isActiveRoute(pathname, item.href);
              const Icon = item.icon;
              return (
                <Link key={item.href} href={item.href} onClick={close} aria-current={isActive ? "page" : undefined} className={linkClass(isActive)}>
                  {isActive ? (
                    <motion.span
                      layoutId="admin-sheet-active"
                      className="absolute inset-0 rounded-[10px] bg-sidebar-accent shadow-[var(--shadow-hairline),0_1px_3px_rgb(0_0_0/0.06)]"
                      transition={{ type: "spring", bounce: 0.12, duration: 0.38 }}
                    />
                  ) : null}
                  <Icon className={cn("relative size-4.5 shrink-0", isActive ? "text-sun-ink" : "text-foreground/55 group-hover:text-foreground/80")} aria-hidden="true" />
                  <span className="relative">{item.label}</span>
                </Link>
              );
            })}
          </nav>
          <div className="mt-auto grid gap-0.5 border-t border-sidebar-border pt-3">
            <Link href="/app/account" onClick={close} className={linkClass(false)}>
              <UserRound className="size-4.5 shrink-0 text-foreground/55" aria-hidden="true" /> Account &amp; security
            </Link>
            <Link href="/app/dashboard" onClick={close} className={linkClass(false)}>
              <ArrowLeft className="size-4.5 shrink-0 text-foreground/55" aria-hidden="true" /> Back to app
            </Link>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { ArrowUpRight, Menu } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/features", label: "Features" },
  { href: "/solutions", label: "Solutions" },
  { href: "/industries", label: "Industries" },
  { href: "/pricing", label: "Pricing" },
  { href: "/about", label: "About" },
  { href: "/contact", label: "Contact" },
];

function useHasScrolled(threshold = 8) {
  const [hasScrolled, setHasScrolled] = useState(false);
  useEffect(() => {
    const update = () => setHasScrolled(window.scrollY > threshold);
    update();
    window.addEventListener("scroll", update, { passive: true });
    return () => window.removeEventListener("scroll", update);
  }, [threshold]);
  return hasScrolled;
}

export function SiteHeader() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const hasScrolled = useHasScrolled();
  return (
    <header
      className={cn(
        "sticky top-0 z-40 transition-[background-color,box-shadow] duration-300",
        hasScrolled ? "material shadow-[0_1px_0_var(--border)]" : "bg-transparent",
      )}
    >
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-8 px-6">
        <Logo />
        <nav aria-label="Main navigation" className="hidden items-center gap-0.5 md:flex">
          {NAV.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={isActive ? "page" : undefined}
                className={cn(
                  "relative rounded-full px-3.5 py-2 text-sm font-medium transition-colors duration-200 hover:bg-foreground/5 hover:text-foreground",
                  isActive ? "text-foreground" : "text-muted-foreground",
                )}
              >
                {item.label}
                {isActive ? <span className="absolute bottom-0.5 left-1/2 size-1 -translate-x-1/2 rounded-full bg-sun" aria-hidden="true" /> : null}
              </Link>
            );
          })}
        </nav>
        <div className="ml-auto hidden items-center gap-1.5 md:flex">
          <ThemeToggle />
          <Button asChild variant="ghost">
            <Link href="/login">Sign in</Link>
          </Button>
          <Button asChild>
            <Link href="/register">Start free trial</Link>
          </Button>
        </div>
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" className="ml-auto md:hidden" aria-label="Open menu">
              <Menu />
            </Button>
          </SheetTrigger>
          <SheetContent side="right" className="w-80 bg-background">
            <SheetHeader>
              <SheetTitle className="sr-only">Menu</SheetTitle>
              <Logo />
            </SheetHeader>
            <nav aria-label="Mobile navigation" className="grid px-4">
              {NAV.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setOpen(false)}
                  className="border-b py-3.5 font-display text-3xl tracking-[-0.01em] transition-colors hover:text-sun-ink"
                >
                  {item.label}
                </Link>
              ))}
              <div className="mt-8 grid gap-2">
                <Button asChild size="lg">
                  <Link href="/register">Start free trial</Link>
                </Button>
                <Button asChild size="lg" variant="outline">
                  <Link href="/login">Sign in</Link>
                </Button>
                <ThemeToggle className="mt-2 justify-self-center" />
              </div>
            </nav>
          </SheetContent>
        </Sheet>
      </div>
    </header>
  );
}

const FOOTER_COLUMNS = [
  {
    title: "Product",
    links: [
      { href: "/features", label: "Features" },
      { href: "/solutions", label: "Solutions" },
      { href: "/industries", label: "Industries" },
      { href: "/pricing", label: "Pricing" },
    ],
  },
  {
    title: "Company",
    links: [
      { href: "/about", label: "About" },
      { href: "/contact", label: "Contact" },
      { href: "https://sunleonrouterenterprise.com", label: "Sunleon Router Enterprise" },
    ],
  },
  {
    title: "Legal",
    links: [
      { href: "/privacy", label: "Privacy Policy" },
      { href: "/terms", label: "Terms of Service" },
    ],
  },
];

export function SiteFooter() {
  return (
    <footer className="overflow-hidden border-t">
      <div className="mx-auto grid max-w-7xl gap-12 px-6 pt-16 pb-10 md:grid-cols-[1.5fr_repeat(3,1fr)]">
        <div className="grid content-start gap-4">
          <Logo />
          <p className="max-w-xs text-sm leading-relaxed text-muted-foreground">
            Customer messaging for businesses in Ghana and beyond. On WhatsApp and Instagram, grounded in your own records,
            and always under your control.
          </p>
        </div>
        {FOOTER_COLUMNS.map((column) => (
          <div key={column.title}>
            <p className="text-sm font-semibold">{column.title}</p>
            <ul className="mt-4 grid gap-2.5">
              {column.links.map((link) => {
                const isExternal = link.href.startsWith("http");
                return (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
                      {...(isExternal ? { target: "_blank", rel: "noopener noreferrer" } : {})}
                    >
                      {link.label}
                      {isExternal ? <ArrowUpRight className="size-3.5" aria-hidden="true" /> : null}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>
      <div className="mx-auto flex max-w-7xl flex-col gap-2 px-6 pb-6 text-xs text-muted-foreground sm:flex-row sm:justify-between">
        <p>© {new Date().getFullYear()} Sunleon Router Enterprise. All rights reserved.</p>
        <p>Made in Accra, Ghana</p>
      </div>
      <p
        aria-hidden="true"
        className="pointer-events-none mb-[-0.24em] text-center font-display text-[25vw] leading-[0.8] tracking-[-0.04em] text-foreground/6 select-none"
      >
        Sunleon
      </p>
    </footer>
  );
}

import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { LogoMark } from "@/components/brand/logo";
import { NotFoundScene } from "@/components/brand/not-found-scene";
import { BubbleReveal } from "@/components/marketing/bubble-reveal";
import { SiteFooter, SiteHeader } from "@/components/marketing/site-chrome";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "Page not found", robots: { index: false, follow: true } };

const ELSEWHERE = [
  { href: "/", label: "Homepage" },
  { href: "/features", label: "How it works" },
  { href: "/pricing", label: "Pricing" },
  { href: "/contact", label: "Talk to us" },
];

export default function NotFound() {
  return (
    <div className="flex min-h-svh flex-col">
      <SiteHeader />
      <main className="flex-1">
        <section className="mx-auto max-w-6xl px-6 pt-8 pb-20 lg:pt-12 lg:pb-28">
          <NotFoundScene />

          <div className="mt-12 grid gap-12 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)] lg:gap-16">
            <div>
              <p className="font-mono text-sm text-sun-ink">404 · Page not found</p>
              <h1 className="mt-3 font-display text-5xl leading-[1.02] font-normal tracking-[-0.015em] sm:text-6xl">
                This page went <span className="sunset-text italic">unanswered.</span>
              </h1>
              <p className="mt-5 max-w-xl text-[17px] leading-relaxed text-muted-foreground">
                That almost never happens here. SUNLEON AI replies to customers on WhatsApp and Instagram within seconds, at
                any hour. This address just doesn&apos;t lead anywhere, and we won&apos;t make up a page to fill the gap, in the
                same way Sunleon never invents a price or a stock level.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Button asChild size="lg" className="sunrise-cta h-12 px-6">
                  <Link href="/">
                    Back to the homepage <ArrowRight />
                  </Link>
                </Button>
                <Button asChild size="lg" variant="outline" className="h-12 px-6">
                  <Link href="/contact">Tell us what you were looking for</Link>
                </Button>
              </div>
            </div>

            {/* The same question a customer might send, answered the way the assistant answers it: honestly. */}
            <div className="rounded-[1.75rem] border bg-muted/60 p-5 sm:p-6 lg:self-start">
              <div className="flex items-center gap-2.5 border-b pb-4">
                <LogoMark className="size-8" />
                <div>
                  <p className="text-sm font-semibold">Sunleon assistant</p>
                  <p className="text-xs text-muted-foreground">Replies within seconds</p>
                </div>
              </div>
              <div className="mt-5 grid gap-3">
                <BubbleReveal className="ml-auto rounded-br-[6px] rounded-bl-[18px] bg-[#d9fdd3] text-[#1d1a16]">
                  Hi! Is this page still available?
                </BubbleReveal>
                <BubbleReveal delay={0.35}>
                  I checked everywhere, and it doesn&apos;t exist. I&apos;d rather tell you that than guess. Here&apos;s where you
                  can go instead:
                </BubbleReveal>
                <nav aria-label="Other pages">
                  <ul className="flex flex-wrap gap-2">
                    {ELSEWHERE.map((page) => (
                      <li key={page.href}>
                        <Link
                          href={page.href}
                          className="pressable inline-flex items-center gap-1.5 rounded-full border bg-card px-3.5 py-1.5 text-sm font-medium transition-colors hover:border-sun/60 hover:text-sun-ink"
                        >
                          <span aria-hidden="true" className="size-1.5 rounded-full bg-sun" />
                          {page.label}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </nav>
              </div>
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}

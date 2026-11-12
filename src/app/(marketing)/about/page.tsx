import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { RouteDrawing, ValueDrawing, type ValueDrawingName } from "@/components/marketing/about-drawing";
import { CtaBand, PageHero, PANEL_HOVER, PenUnderlined, TONE_WASH } from "@/components/marketing/marketing-blocks";
import { pageMetadata } from "@/config/seo";
import { TONES } from "@/config/tones";
import { cn } from "@/lib/utils";

export const metadata: Metadata = pageMetadata("/about");

const VALUES: Array<{ id: ValueDrawingName; tone: string; title: string; body: string }> = [
  {
    id: "truth",
    tone: TONES.mint,
    title: "Truth over convenience",
    body: "Sunleon never invents a price, a stock level or a payment. If it doesn't know, it says so and asks your team.",
  },
  {
    id: "control",
    tone: TONES.sky,
    title: "Owners stay in control",
    body: "You decide what it may do alone. Every action is visible, and anything big waits for a person.",
  },
  { id: "local", tone: TONES.gold, title: "Built for where you are", body: "Ghana cedis, Paystack, WhatsApp-first customers and local data protection from day one." },
];

export default function AboutPage() {
  return (
    <>
      <PageHero
        eyebrow="About"
        title={
          <>
            We built the helper we wanted{" "}
            <span className="italic">
              for our own <PenUnderlined>businesses.</PenUnderlined>
            </span>
          </>
        }
      >
        SUNLEON AI is made by Sunleon Router Enterprise, a Ghanaian technology company helping businesses serve customers
        faster without losing the personal touch.
      </PageHero>
      <section className="mx-auto max-w-7xl px-6 py-20 lg:py-28">
        <div className="grid items-center gap-12 lg:grid-cols-[minmax(0,1fr)_20rem] lg:gap-20">
          <p className="font-display text-3xl leading-[1.18] tracking-[-0.01em] sm:text-[2.6rem]">
            Across Ghana, sales happen in WhatsApp chats and Instagram messages. Owners answer the same questions late into the
            night, and customers drift away when replies are slow.{" "}
            <span className="text-muted-foreground">
              We started Sunleon so every business, from a one-chair salon in Kumasi to a retailer with branches across Accra,
              can answer quickly and correctly at any hour.
            </span>
          </p>
          <RouteDrawing className="mx-auto w-full max-w-72 text-foreground lg:max-w-none" />
        </div>
        <ol className="mt-20 grid gap-5 md:grid-cols-3">
          {VALUES.map((value, index) => (
            <li key={value.id} className={cn("group", value.tone)}>
              <div className={cn(PANEL_HOVER, TONE_WASH, "h-full p-6 pb-7")}>
                <ValueDrawing
                  value={value.id}
                  delay={index * 0.08}
                  className="h-24 w-auto self-start origin-bottom text-foreground motion-safe:group-hover:animate-[wiggle_0.55s_ease-in-out]"
                />
                <span className="mt-6 font-mono text-xs text-foreground/55">{String(index + 1).padStart(2, "0")}</span>
                <h2 className="mt-1 font-display text-3xl font-normal tracking-[-0.01em]">{value.title}</h2>
                <p className="mt-3 text-[15px] leading-relaxed text-foreground/75">{value.body}</p>
              </div>
            </li>
          ))}
        </ol>
        <p className="mt-14 flex flex-wrap items-center justify-between gap-4 border-t pt-8 text-[15px] text-muted-foreground">
          <span>
            Made by <span className="text-foreground">Sunleon Router Enterprise</span> in Accra, Ghana.
          </span>
          <Link href="/contact" className="link-underline inline-flex items-center gap-1.5 font-medium text-foreground">
            Say hello <ArrowRight aria-hidden="true" className="size-4" />
          </Link>
        </p>
      </section>
      <CtaBand title="Let's get your replies sorted." />
    </>
  );
}

import type { Metadata } from "next";
import { CtaBand, PageHero } from "@/components/marketing/marketing-blocks";
import { pageMetadata } from "@/config/seo";

export const metadata: Metadata = pageMetadata("/about");

const VALUES = [
  { title: "Truth over convenience", body: "Sunleon never invents a price, a stock level or a payment. If it doesn't know, it says so and asks your team." },
  { title: "Owners stay in control", body: "You decide what it may do alone. Every action is visible, and anything big waits for a person." },
  { title: "Built for where you are", body: "Ghana cedis, Paystack, WhatsApp-first customers and local data protection from day one." },
];

export default function AboutPage() {
  return (
    <>
      <PageHero eyebrow="About" title={<>We built the helper we wanted <span className="italic">for our own businesses.</span></>}>
        SUNLEON AI is made by Sunleon Router Enterprise, a Ghanaian technology company helping businesses serve customers
        faster without losing the personal touch.
      </PageHero>
      <section className="mx-auto max-w-7xl px-6 py-20 lg:py-28">
        <p className="max-w-5xl font-display text-3xl leading-[1.18] tracking-[-0.01em] sm:text-[2.6rem]">
          Across Ghana, sales happen in WhatsApp chats and Instagram messages. Owners answer the same questions late into the
          night, and customers drift away when replies are slow.{" "}
          <span className="text-muted-foreground">
            We started Sunleon so every business, from a one-chair salon in Kumasi to a retailer with branches across Accra,
            can answer quickly and correctly at any hour.
          </span>
        </p>
        <ol className="mt-20 grid gap-10 border-t pt-10 md:grid-cols-3">
          {VALUES.map((value, index) => (
            <li key={value.title}>
              <span className="font-mono text-sm text-sun-ink">{String(index + 1).padStart(2, "0")}</span>
              <h2 className="mt-3 font-display text-3xl font-normal tracking-[-0.01em]">{value.title}</h2>
              <p className="mt-3 text-[15px] leading-relaxed text-muted-foreground">{value.body}</p>
            </li>
          ))}
        </ol>
      </section>
      <CtaBand title="Let's get your replies sorted." />
    </>
  );
}

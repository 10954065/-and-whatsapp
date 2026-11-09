import type { Metadata } from "next";
import { CtaBand, PageHero } from "@/components/marketing/marketing-blocks";

export const metadata: Metadata = { title: "About" };

const VALUES = [
  { title: "Truth over convenience", body: "Our AI never invents a price, a stock level or a payment. If it doesn't know, it says so and asks your team." },
  { title: "Owners stay in control", body: "Autonomy is earned and bounded. You set the limits; every action is visible and reversible." },
  { title: "Built for where you are", body: "Ghana cedis, Paystack, WhatsApp-first customers and local data protection from day one." },
];

export default function AboutPage() {
  return (
    <>
      <PageHero eyebrow="About" title="We build the AI employee we wanted for our own businesses.">
        SUNLEON AI is a product of Sunleon Router Enterprise, a Ghanaian technology company helping businesses serve
        customers faster without losing the personal touch.
      </PageHero>
      <section className="mx-auto grid max-w-6xl gap-12 px-6 py-20 lg:grid-cols-[1fr_1.2fr]">
        <div>
          <h2 className="text-3xl font-bold">Why we exist</h2>
          <p className="mt-4 leading-7 text-muted-foreground">
            Across Ghana, sales happen in WhatsApp chats and Instagram DMs. Owners answer the same questions late into
            the night, and customers leave when replies are slow. We started SUNLEON AI so every business, from a
            single-stylist salon in Kumasi to a multi-branch retailer in Accra, can respond instantly and accurately,
            around the clock.
          </p>
        </div>
        <div className="grid gap-4">
          {VALUES.map((value) => (
            <article key={value.title} className="rounded-2xl border bg-card p-6">
              <h3 className="font-semibold">{value.title}</h3>
              <p className="mt-1.5 text-sm text-muted-foreground">{value.body}</p>
            </article>
          ))}
        </div>
      </section>
      <CtaBand title="Let's put an AI employee to work for you." />
    </>
  );
}

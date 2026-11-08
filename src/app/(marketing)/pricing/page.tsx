import type { Metadata } from "next";
import Link from "next/link";
import { Check } from "lucide-react";
import { CtaBand, PageHero } from "@/components/marketing/marketing-blocks";
import { Button } from "@/components/ui/button";
import { prisma } from "@/lib/db/prisma";
import { formatMoney, formatNumber } from "@/lib/format";
import { logger } from "@/lib/monitoring/logger";

export const metadata: Metadata = { title: "Pricing" };
export const revalidate = 3600;

interface PlanLimits {
  aiMessagesPerMonth?: number;
  channels?: number;
  staffSeats?: number;
}

async function loadPlans() {
  try {
    return await prisma.subscriptionPlan.findMany({
      where: { isActive: true, isPublic: true },
      orderBy: { sortOrder: "asc" },
    });
  } catch (error) {
    logger.warn("pricing.plans_unavailable", { error });
    return [];
  }
}

export default async function PricingPage() {
  const plans = await loadPlans();
  return (
    <>
      <PageHero eyebrow="Pricing" title="Simple plans in Ghana cedis.">
        Every plan starts with a free trial. Upgrade, downgrade or cancel at any time — your data is never deleted when
        a subscription ends.
      </PageHero>
      <section className="mx-auto max-w-7xl px-6 py-20">
        {plans.length === 0 ? (
          <p className="mx-auto max-w-lg rounded-2xl border bg-card p-8 text-center text-muted-foreground">
            Plans are being finalised.{" "}
            <Link href="/contact" className="font-semibold text-primary hover:underline">
              Contact us
            </Link>{" "}
            for a quote.
          </p>
        ) : (
          <div className="grid gap-6 lg:grid-cols-3">
            {plans.map((plan, index) => {
              const limits = plan.limits as PlanLimits;
              const featured = index === 1;
              return (
                <article
                  key={plan.id}
                  className={`relative flex flex-col rounded-3xl border p-8 ${featured ? "border-primary/40 bg-linear-to-b from-violet/10 to-card shadow-[0_30px_60px_-30px_var(--violet)]" : "bg-card"}`}
                >
                  {featured ? (
                    <span className="absolute -top-3 left-8 rounded-full bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground">
                      Most popular
                    </span>
                  ) : null}
                  <h2 className="text-xl font-bold">{plan.name}</h2>
                  <p className="mt-1 text-sm text-muted-foreground">{plan.description}</p>
                  <p className="mt-6 flex items-baseline gap-1">
                    <span className="font-heading text-4xl font-extrabold">{formatMoney(plan.priceMonthlyMinor, plan.currency)}</span>
                    <span className="text-sm text-muted-foreground">/ month</span>
                  </p>
                  <p className="text-xs text-muted-foreground">
                    or {formatMoney(plan.priceYearlyMinor, plan.currency)} billed yearly
                  </p>
                  <ul className="mt-6 grid gap-2.5 text-sm">
                    {limits.aiMessagesPerMonth ? (
                      <li className="flex gap-2">
                        <Check className="size-4 text-primary" /> {formatNumber(limits.aiMessagesPerMonth)} AI messages / month
                      </li>
                    ) : null}
                    {limits.staffSeats ? (
                      <li className="flex gap-2">
                        <Check className="size-4 text-primary" /> {limits.staffSeats} team seats
                      </li>
                    ) : null}
                    {plan.features.map((feature) => (
                      <li key={feature} className="flex gap-2">
                        <Check className="size-4 shrink-0 text-primary" /> {feature}
                      </li>
                    ))}
                  </ul>
                  <Button asChild className="mt-8" variant={featured ? "default" : "outline"} size="lg">
                    <Link href="/register">Start {plan.trialDays}-day free trial</Link>
                  </Button>
                </article>
              );
            })}
          </div>
        )}
        <p className="mt-10 text-center text-xs text-muted-foreground">
          Prices include platform usage within plan limits. WhatsApp template-message fees charged by Meta and Paystack
          transaction fees are billed by those providers.
        </p>
      </section>
      <CtaBand />
    </>
  );
}

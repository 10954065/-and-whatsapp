import type { Metadata } from "next";
import Link from "next/link";
import { Check } from "lucide-react";
import { MetaFeeNotice } from "@/components/integrations/meta-fees";
import { CtaBand, PageHero } from "@/components/marketing/marketing-blocks";
import { Button } from "@/components/ui/button";
import { pageMetadata } from "@/config/seo";
import { prisma } from "@/lib/db/prisma";
import { formatMoney, formatNumber } from "@/lib/format";
import { logger } from "@/lib/monitoring/logger";
import { cn } from "@/lib/utils";

export const metadata: Metadata = pageMetadata("/pricing");
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
      <PageHero eyebrow="Pricing" title={<>Simple plans, <span className="italic">in Ghana cedis.</span></>}>
        Every plan starts with a free trial. Change plans or stop at any time, and your data is never deleted when a
        subscription ends.
      </PageHero>
      <section className="mx-auto max-w-7xl px-6 py-20 lg:py-24">
        {plans.length === 0 ? (
          <p className="surface mx-auto max-w-lg rounded-3xl p-8 text-center text-muted-foreground">
            Plans are being finalised.{" "}
            <Link href="/contact" className="link-underline font-medium text-foreground">
              Contact us
            </Link>{" "}
            for a quote.
          </p>
        ) : (
          <div className="grid items-start gap-5 lg:grid-cols-3">
            {plans.map((plan, index) => {
              const limits = plan.limits as PlanLimits;
              const isFeatured = index === 1;
              return (
                <article
                  key={plan.id}
                  className={cn(
                    "relative flex flex-col rounded-[2rem] p-8 sm:p-9",
                    isFeatured ? "grain bg-[#1d1a16] text-[#f3efe7] shadow-[var(--shadow-lifted)] lg:-mt-4 lg:pb-12" : "surface",
                  )}
                >
                  <div className="flex items-center justify-between">
                    <h2 className="text-lg font-semibold">{plan.name}</h2>
                    {isFeatured ? <span className="rounded-full bg-sun px-3 py-1 text-xs font-semibold text-[#1d1a16]">Most chosen</span> : null}
                  </div>
                  <p className={cn("mt-1.5 min-h-10 text-sm", isFeatured ? "text-white/60" : "text-muted-foreground")}>{plan.description}</p>
                  <p className="mt-8 flex items-baseline gap-2">
                    <span className="font-display text-6xl leading-none tracking-[-0.02em]">{formatMoney(plan.priceMonthlyMinor, plan.currency)}</span>
                    <span className={cn("text-sm", isFeatured ? "text-white/60" : "text-muted-foreground")}>a month</span>
                  </p>
                  <p className={cn("mt-2 text-xs", isFeatured ? "text-white/50" : "text-muted-foreground")}>
                    or {formatMoney(plan.priceYearlyMinor, plan.currency)} paid yearly
                  </p>
                  <ul className={cn("mt-8 grid gap-3 border-t pt-6 text-sm", isFeatured && "border-white/10")}>
                    {limits.aiMessagesPerMonth ? (
                      <li className="flex gap-2.5">
                        <Check className="size-4 shrink-0 text-sun" aria-hidden="true" /> {formatNumber(limits.aiMessagesPerMonth)} assistant replies a month
                      </li>
                    ) : null}
                    {limits.staffSeats ? (
                      <li className="flex gap-2.5">
                        <Check className="size-4 shrink-0 text-sun" aria-hidden="true" /> {limits.staffSeats} team seats
                      </li>
                    ) : null}
                    {plan.features.map((feature) => (
                      <li key={feature} className="flex gap-2.5">
                        <Check className="size-4 shrink-0 text-sun" aria-hidden="true" /> {feature}
                      </li>
                    ))}
                  </ul>
                  <Button
                    asChild
                    size="lg"
                    variant={isFeatured ? "default" : "outline"}
                    className={cn("mt-9", isFeatured && "bg-sun text-[#1d1a16] hover:bg-sun/90 dark:bg-sun dark:text-[#1d1a16]")}
                  >
                    <Link href="/register">Start {plan.trialDays}-day free trial</Link>
                  </Button>
                </article>
              );
            })}
          </div>
        )}
        <section
          id="whatsapp-fees"
          aria-labelledby="whatsapp-fees-heading"
          className="surface mx-auto mt-16 max-w-3xl scroll-mt-24 rounded-[2rem] p-8 sm:p-10"
        >
          <h2 id="whatsapp-fees-heading" className="font-display text-3xl leading-tight tracking-[-0.01em]">
            WhatsApp fees from Meta
          </h2>
          <MetaFeeNotice className="mt-4" />
        </section>
        <p className="mx-auto mt-10 max-w-2xl text-center text-xs leading-relaxed text-muted-foreground">
          Prices include platform usage within plan limits. Paystack transaction fees are billed by Paystack.
        </p>
      </section>
      <CtaBand />
    </>
  );
}

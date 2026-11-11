import type { Metadata } from "next";
import Link from "next/link";
import { Check } from "lucide-react";
import { PlanDeck, type DeckPlan } from "@/components/billing/plan-card";
import { allowanceLine, cardFinish, freeMonthsLabel, yearlySavingMinor } from "@/components/billing/plan-card-format";
import { MetaFeeNotice } from "@/components/integrations/meta-fees";
import { CtaBand, PageHero } from "@/components/marketing/marketing-blocks";
import { Button } from "@/components/ui/button";
import { pageMetadata } from "@/config/seo";
import { prisma } from "@/lib/db/prisma";
import { formatMoney, formatNumber } from "@/lib/format";
import { logger } from "@/lib/monitoring/logger";

export const metadata: Metadata = pageMetadata("/pricing");
export const revalidate = 3600;

interface PlanLimits {
  aiMessagesPerMonth?: number;
  channels?: number;
  staffSeats?: number;
}

type PublicPlan = Awaited<ReturnType<typeof loadPlans>>[number];

const FEATURED_INDEX = 1;

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

function PlanDetails({ plan, isFeatured }: { plan: PublicPlan; isFeatured: boolean }) {
  const limits = plan.limits as PlanLimits;
  const included = [
    limits.aiMessagesPerMonth ? `${formatNumber(limits.aiMessagesPerMonth)} assistant replies a month` : null,
    limits.staffSeats ? `${limits.staffSeats} team seats` : null,
    ...plan.features,
  ].filter((item): item is string => Boolean(item));
  return (
    <div className="mt-9 flex flex-1 flex-col px-1">
      <p className="min-h-10 text-sm text-muted-foreground">{plan.description}</p>
      <ul className="mt-5 grid gap-3 border-t pt-5 text-sm">
        {included.map((item) => (
          <li key={item} className="flex gap-2.5">
            <Check className="size-4 shrink-0 text-sun" aria-hidden="true" /> {item}
          </li>
        ))}
      </ul>
      <Button asChild size="lg" variant={isFeatured ? "default" : "outline"} className="pressable mt-8">
        <Link href="/register">Start {plan.trialDays}-day free trial</Link>
      </Button>
    </div>
  );
}

function toDeckPlan(plan: PublicPlan, index: number): DeckPlan {
  const isFeatured = index === FEATURED_INDEX;
  const saving = yearlySavingMinor(plan.priceMonthlyMinor, plan.priceYearlyMinor);
  return {
    id: plan.id,
    front: {
      finish: cardFinish(index),
      headline: formatMoney(plan.priceMonthlyMinor, plan.currency),
      headlineNote: "a month",
      allowance: allowanceLine(plan.limits),
      holderLabel: "Plan",
      holder: plan.name,
      headingLevel: 2,
      tag: isFeatured ? "Recommended" : undefined,
    },
    back: {
      headline: formatMoney(plan.priceYearlyMinor, plan.currency),
      headlineNote: "a year",
      note: saving ? `Saves ${formatMoney(saving, plan.currency)} against monthly` : undefined,
      signature: plan.name,
      headingLevel: 2,
      finePrint: "One payment covers a full year. Nothing renews automatically.",
    },
    details: <PlanDetails plan={plan} isFeatured={isFeatured} />,
  };
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
          <PlanDeck plans={plans.map(toDeckPlan)} bonusLabel={freeMonthsLabel(plans)} isCentered gridClassName="mx-auto max-w-md lg:max-w-none lg:grid-cols-3 lg:gap-x-8" />
        )}
        <section
          id="whatsapp-fees"
          aria-labelledby="whatsapp-fees-heading"
          className="surface mx-auto mt-20 max-w-3xl scroll-mt-24 rounded-[2rem] p-8 sm:p-10"
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

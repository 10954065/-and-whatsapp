import type { Metadata } from "next";
import Link from "next/link";
import { CheckCircle2, Circle, SkipForward } from "lucide-react";
import { PageHeader } from "@/components/app/page-primitives";
import { Button } from "@/components/ui/button";
import { requireTenant } from "@/lib/auth/tenant";
import { cn } from "@/lib/utils";
import { skipSetupStepAction } from "@/modules/onboarding/setup.actions";
import { getSetupProgress, markOnboardingCompleteIfReady } from "@/modules/onboarding/setup.service";

const RING = 2 * Math.PI * 27;

export const metadata: Metadata = { title: "Setup guide" };

export default async function SetupPage() {
  const context = await requireTenant();
  const progress = await getSetupProgress(context.businessId);
  if (progress.isComplete) await markOnboardingCompleteIfReady(context.businessId);
  const percent = Math.round((progress.finished / progress.total) * 100);
  const canEdit = context.can("business.update");

  return (
    <>
      <PageHeader
        eyebrow="Setup guide"
        title={progress.isComplete ? "You're all set up" : "Let's get your assistant ready"}
        description="Your progress is saved automatically. Come back any time."
      />
      <div className="surface mb-8 flex items-center gap-5 rounded-[1.5rem] p-5 sm:p-6">
        <svg viewBox="0 0 64 64" className="size-16 shrink-0 -rotate-90" aria-hidden="true">
          <circle cx="32" cy="32" r="27" fill="none" strokeWidth="6" className="stroke-foreground/[0.08]" />
          <circle
            cx="32"
            cy="32"
            r="27"
            fill="none"
            strokeWidth="6"
            strokeLinecap="round"
            className="stroke-sun"
            strokeDasharray={RING}
            strokeDashoffset={RING * (1 - percent / 100)}
          />
        </svg>
        <div className="flex-1">
          <p className="text-[15px] font-semibold">
            {progress.finished} of {progress.total} steps complete
          </p>
          <p className="text-sm text-muted-foreground">{progress.isComplete ? "Everything is in place." : "Most businesses finish in under an hour."}</p>
        </div>
        <span className="text-[1.75rem] font-semibold tracking-[-0.03em] tabular-nums" aria-label={`${percent} percent`}>
          {percent}%
        </span>
      </div>
      <ol className="surface divide-y overflow-hidden rounded-[1.5rem]">
        <li className="flex items-start gap-4 px-5 py-4">
          <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-success" aria-hidden="true" />
          <div>
            <p className="font-medium">Create your workspace</p>
            <p className="text-sm text-muted-foreground">{context.business.name} is ready.</p>
          </div>
        </li>
        {progress.steps.map((step) => (
          <li key={step.id} className={cn("flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center", step.status === "todo" && "bg-sun-soft/35")}>
            <div className="flex flex-1 items-start gap-4">
              {step.status === "done" ? (
                <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-success" aria-hidden="true" />
              ) : step.status === "skipped" ? (
                <SkipForward className="mt-0.5 size-5 shrink-0 text-muted-foreground" aria-hidden="true" />
              ) : (
                <Circle className="mt-0.5 size-5 shrink-0 text-sun-ink" aria-hidden="true" />
              )}
              <div>
                <p className={cn("font-medium", step.status !== "todo" && "text-foreground/70")}>
                  {step.title} {step.isOptional ? <span className="text-xs font-normal text-muted-foreground">· optional</span> : null}
                </p>
                <p className="text-sm text-muted-foreground">{step.description}</p>
              </div>
            </div>
            {step.status !== "done" ? (
              <div className="flex gap-2 pl-9 sm:shrink-0 sm:pl-0">
                {step.isOptional && step.status === "todo" && canEdit ? (
                  <form action={skipSetupStepAction}>
                    <input type="hidden" name="stepId" value={step.id} />
                    <Button type="submit" variant="ghost" size="sm">
                      Skip
                    </Button>
                  </form>
                ) : null}
                <Button asChild size="sm" variant={step.status === "todo" ? "default" : "outline"}>
                  <Link href={step.href}>{step.actionLabel}</Link>
                </Button>
              </div>
            ) : null}
          </li>
        ))}
      </ol>
    </>
  );
}

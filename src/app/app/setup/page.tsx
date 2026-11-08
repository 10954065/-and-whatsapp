import type { Metadata } from "next";
import Link from "next/link";
import { CheckCircle2, Circle, SkipForward } from "lucide-react";
import { PageHeader } from "@/components/app/page-primitives";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { requireTenant } from "@/lib/auth/tenant";
import { cn } from "@/lib/utils";
import { skipSetupStepAction } from "@/modules/onboarding/setup.actions";
import { getSetupProgress, markOnboardingCompleteIfReady } from "@/modules/onboarding/setup.service";

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
        title={progress.isComplete ? "You're all set up" : "Let's get your AI employee ready"}
        description="Your progress is saved automatically. Come back any time."
      />
      <div className="mb-6 rounded-2xl border bg-card p-6">
        <div className="flex items-center justify-between text-sm">
          <span className="font-medium">
            {progress.finished} of {progress.total} steps complete
          </span>
          <span className="text-muted-foreground">{percent}%</span>
        </div>
        <Progress value={percent} className="mt-3" aria-label="Setup progress" />
      </div>
      <ol className="grid gap-3">
        <li className="flex items-start gap-4 rounded-2xl border bg-card p-5">
          <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-success" aria-hidden="true" />
          <div>
            <p className="font-semibold">Create your workspace</p>
            <p className="text-sm text-muted-foreground">{context.business.name} is ready.</p>
          </div>
        </li>
        {progress.steps.map((step) => (
          <li
            key={step.id}
            className={cn("flex flex-col gap-4 rounded-2xl border bg-card p-5 sm:flex-row sm:items-center", step.status === "todo" && "border-primary/25")}
          >
            <div className="flex flex-1 items-start gap-4">
              {step.status === "done" ? (
                <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-success" aria-hidden="true" />
              ) : step.status === "skipped" ? (
                <SkipForward className="mt-0.5 size-5 shrink-0 text-muted-foreground" aria-hidden="true" />
              ) : (
                <Circle className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden="true" />
              )}
              <div>
                <p className="font-semibold">
                  {step.title} {step.isOptional ? <span className="text-xs font-normal text-muted-foreground">· optional</span> : null}
                </p>
                <p className="text-sm text-muted-foreground">{step.description}</p>
              </div>
            </div>
            {step.status !== "done" ? (
              <div className="flex gap-2 sm:shrink-0">
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

import type { Metadata } from "next";
import { Bot, CircleDollarSign, Gauge, ShieldAlert } from "lucide-react";
import { AgentConfigForm, AgentStatusControls, TestConsole } from "@/components/ai/agent-forms";
import { AccessDenied, PageHeader, StatCard } from "@/components/app/page-primitives";
import { Badge } from "@/components/ui/badge";
import { prisma } from "@/lib/db/prisma";
import { requireTenant } from "@/lib/auth/tenant";
import { getOrCreateAgent } from "@/modules/ai/agent.service";
import { isAnthropicConfigured } from "@/modules/ai/client";
import { formatUsd } from "@/modules/ai/pricing";
import { ALWAYS_ALLOWED_TOOLS, listTools } from "@/modules/ai/tools/registry";
import { dayPeriod, getAiSpend, getPlanLimits, getUsage, monthPeriod } from "@/modules/billing/usage";

export const metadata: Metadata = { title: "AI employee" };

export default async function AiAgentsPage() {
  const context = await requireTenant();
  if (!context.can("ai.read")) return <AccessDenied what="the AI employee" />;
  const now = new Date();
  const [agent, spend, limits, messagesToday, messagesMonth, recentRuns] = await Promise.all([
    getOrCreateAgent(context.businessId),
    getAiSpend(context.businessId, now),
    getPlanLimits(context.businessId),
    getUsage(context.businessId, "AI_MESSAGE", dayPeriod(now)),
    getUsage(context.businessId, "AI_MESSAGE", monthPeriod(now)),
    prisma.aiRun.count({ where: { businessId: context.businessId, trigger: "TEST_CONSOLE", status: "SUCCEEDED" } }),
  ]);
  const canManage = context.can("ai.manage");
  const providerConfigured = isAnthropicConfigured();
  const tools = listTools().map((tool) => ({
    name: tool.name,
    label: tool.label,
    isWrite: tool.isWrite,
    isLocked: ALWAYS_ALLOWED_TOOLS.has(tool.name),
  }));

  const statusBadge = agent.emergencyStop ? (
    <Badge variant="destructive">Emergency stop</Badge>
  ) : agent.enabled ? (
    <Badge className="bg-success/15 text-success">Active</Badge>
  ) : (
    <Badge variant="secondary">Not active</Badge>
  );

  return (
    <>
      <PageHeader
        eyebrow="AI employee"
        title={agent.name}
        description={agent.roleDescription ?? "Your AI employee answers customers using your business knowledge and the rules below."}
        actions={<AgentStatusControls enabled={agent.enabled} emergencyStop={agent.emergencyStop} canManage={canManage} />}
      />
      {!providerConfigured ? (
        <p className="mb-6 flex items-center gap-2 rounded-xl border border-warning/40 bg-warning/10 px-4 py-3 text-sm">
          <ShieldAlert className="size-4 text-warning" aria-hidden="true" /> The platform&apos;s Anthropic API key is not configured, so the AI cannot reply yet.
        </p>
      ) : null}
      <section className="mb-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Status" value={statusBadge} icon={Bot} tone="violet" hint={`${recentRuns} successful test${recentRuns === 1 ? "" : "s"}`} />
        <StatCard label="AI replies today" value={`${messagesToday} / ${agent.dailyMessageLimit}`} icon={Gauge} tone="azure" />
        <StatCard label="AI replies this month" value={`${messagesMonth} / ${limits.aiMessagesPerMonth}`} icon={Gauge} hint="Plan allowance" />
        <StatCard
          label="Estimated AI cost this month"
          value={formatUsd(spend.monthMicros)}
          icon={CircleDollarSign}
          tone="success"
          hint={`Today ${formatUsd(spend.todayMicros)} of ${formatUsd(agent.dailySpendLimitMicros)}`}
        />
      </section>
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        <section className="rounded-2xl border bg-card p-6 sm:p-8">
          <h2 className="mb-6 text-lg font-semibold">Behaviour and limits</h2>
          <AgentConfigForm
            disabled={!canManage}
            tools={tools}
            values={{
              name: agent.name,
              roleDescription: agent.roleDescription,
              tone: agent.tone,
              language: agent.language,
              greeting: agent.greeting,
              customInstructions: agent.customInstructions,
              escalationInstructions: agent.escalationInstructions,
              escalationKeywords: agent.escalationKeywords,
              enabledChannels: agent.enabledChannels,
              permittedTools: agent.permittedTools,
              approvalRequiredTools: agent.approvalRequiredTools,
              businessHoursOnly: agent.businessHoursOnly,
              outOfHoursMessage: agent.outOfHoursMessage,
              maxDiscountPercent: agent.maxDiscountPercent,
              dailyMessageLimit: agent.dailyMessageLimit,
              dailySpendLimitUsd: agent.dailySpendLimitMicros / 1_000_000,
              monthlySpendLimitUsd: agent.monthlySpendLimitMicros / 1_000_000,
              modelTierOverride: agent.modelTierOverride,
            }}
          />
        </section>
        <section className="xl:sticky xl:top-20 xl:self-start">
          <h2 className="mb-3 text-lg font-semibold">Test console</h2>
          <TestConsole isProviderConfigured={providerConfigured} />
        </section>
      </div>
    </>
  );
}

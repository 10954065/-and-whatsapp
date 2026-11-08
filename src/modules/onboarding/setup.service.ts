import { prisma } from "@/lib/db/prisma";
import { withTenantTx } from "@/lib/db/tenant";
import type { TenantActor } from "@/lib/auth/tenant";
import { fail } from "@/lib/monitoring/errors";

export interface SetupSignals {
  hasDescription: boolean;
  hasContact: boolean;
  hasHours: boolean;
  memberCount: number;
  pendingInvitations: number;
  knowledgeSources: number;
  connectedChannels: number;
  agentConfigured: boolean;
  aiTestRuns: number;
  agentEnabled: boolean;
}

export interface SetupStep {
  id: string;
  title: string;
  description: string;
  href: string;
  actionLabel: string;
  /** Optional steps can be skipped; skipping is remembered in onboardingState. */
  isOptional: boolean;
  isDone: (signals: SetupSignals) => boolean;
}

/**
 * Guided setup steps. Each later phase registers its step here once its page exists,
 * so the guide never links to something that is not built.
 */
export const SETUP_STEPS: SetupStep[] = [
  {
    id: "profile",
    title: "Describe your business",
    description: "Add a short description and how customers can reach you. Your AI employee uses this in every conversation.",
    href: "/app/settings#profile",
    actionLabel: "Edit profile",
    isOptional: false,
    isDone: (signals) => signals.hasDescription && signals.hasContact,
  },
  {
    id: "hours",
    title: "Set your opening hours",
    description: "So the AI can tell customers when you're open and follow your out-of-hours rules.",
    href: "/app/settings#hours",
    actionLabel: "Set hours",
    isOptional: false,
    isDone: (signals) => signals.hasHours,
  },
  {
    id: "knowledge",
    title: "Teach your AI employee",
    description: "Add FAQs, policies, price lists or documents. The AI only answers from what you provide.",
    href: "/app/knowledge",
    actionLabel: "Add knowledge",
    isOptional: false,
    isDone: (signals) => signals.knowledgeSources > 0,
  },
  {
    id: "channel",
    title: "Connect WhatsApp or Instagram",
    description: "Link your official business account so customer messages reach your inbox. You can start with the test channel.",
    href: "/app/integrations",
    actionLabel: "Connect a channel",
    isOptional: true,
    isDone: (signals) => signals.connectedChannels > 0,
  },
  {
    id: "ai",
    title: "Configure your AI employee",
    description: "Choose its name, tone, what it may do on its own and your spending limits.",
    href: "/app/ai-agents",
    actionLabel: "Configure",
    isOptional: false,
    isDone: (signals) => signals.agentConfigured,
  },
  {
    id: "test",
    title: "Test your AI employee",
    description: "Chat with it in the private test console. Nothing is sent to customers.",
    href: "/app/ai-agents",
    actionLabel: "Open test console",
    isOptional: false,
    isDone: (signals) => signals.aiTestRuns > 0,
  },
  {
    id: "activate",
    title: "Activate your AI employee",
    description: "Turn it on once you're happy with the test replies. You can pause it any time.",
    href: "/app/ai-agents",
    actionLabel: "Activate",
    isOptional: false,
    isDone: (signals) => signals.agentEnabled,
  },
  {
    id: "team",
    title: "Invite your team",
    description: "Give colleagues their own sign-in and the right permissions.",
    href: "/app/team",
    actionLabel: "Invite people",
    isOptional: true,
    isDone: (signals) => signals.memberCount > 1 || signals.pendingInvitations > 0,
  },
];

interface OnboardingState {
  steps?: string[];
  skipped?: string[];
}

export async function getSetupSignals(businessId: string): Promise<SetupSignals> {
  const [business, memberCount, pendingInvitations, knowledgeSources, connectedChannels, agent, aiTestRuns] =
    await Promise.all([
      prisma.business.findUniqueOrThrow({
        where: { id: businessId },
        select: { description: true, phone: true, email: true, businessHours: true },
      }),
      prisma.businessMembership.count({ where: { businessId, status: "ACTIVE" } }),
      prisma.invitation.count({ where: { businessId, status: "PENDING", expiresAt: { gt: new Date() } } }),
      prisma.knowledgeSource.count({ where: { businessId, status: "READY", deletedAt: null } }),
      prisma.integration.count({ where: { businessId, status: "CONNECTED", channel: { not: "SANDBOX" } } }),
      prisma.aiAgent.findUnique({ where: { businessId }, select: { enabled: true, createdAt: true, updatedAt: true } }),
      prisma.aiRun.count({ where: { businessId, trigger: "TEST_CONSOLE", status: "SUCCEEDED" } }),
    ]);
  return {
    hasDescription: Boolean(business.description && business.description.length >= 20),
    hasContact: Boolean(business.phone || business.email),
    hasHours: business.businessHours !== null,
    memberCount,
    pendingInvitations,
    knowledgeSources,
    connectedChannels,
    // The agent row is created on first view; "configured" means its settings were saved.
    agentConfigured: Boolean(agent && agent.updatedAt.getTime() - agent.createdAt.getTime() > 1_000),
    aiTestRuns,
    agentEnabled: Boolean(agent?.enabled),
  };
}

export async function getSetupProgress(businessId: string) {
  const [signals, business] = await Promise.all([
    getSetupSignals(businessId),
    prisma.business.findUniqueOrThrow({ where: { id: businessId }, select: { onboardingState: true } }),
  ]);
  const state = (business.onboardingState ?? {}) as OnboardingState;
  const skipped = new Set(state.skipped ?? []);
  const steps = SETUP_STEPS.map((step) => {
    const status: "done" | "skipped" | "todo" = step.isDone(signals) ? "done" : skipped.has(step.id) ? "skipped" : "todo";
    return { id: step.id, title: step.title, description: step.description, href: step.href, actionLabel: step.actionLabel, isOptional: step.isOptional, status };
  });
  const finished = steps.filter((step) => step.status !== "todo").length;
  return { steps, finished, total: steps.length, isComplete: finished === steps.length };
}

export async function skipSetupStep(actor: TenantActor, stepId: string): Promise<void> {
  const step = SETUP_STEPS.find((entry) => entry.id === stepId);
  if (!step) throw fail.notFound("Setup step");
  if (!step.isOptional) throw fail.validation("This step can't be skipped.");
  await withTenantTx(actor.businessId, async (tx) => {
    const business = await tx.business.findUniqueOrThrow({ where: { id: actor.businessId }, select: { onboardingState: true } });
    const state = (business.onboardingState ?? {}) as OnboardingState;
    const skipped = Array.from(new Set([...(state.skipped ?? []), stepId]));
    await tx.business.update({ where: { id: actor.businessId }, data: { onboardingState: { ...state, skipped } } });
  });
}

/** Stamps onboardingCompletedAt the first time every step is done or skipped. */
export async function markOnboardingCompleteIfReady(businessId: string): Promise<boolean> {
  const progress = await getSetupProgress(businessId);
  if (!progress.isComplete) return false;
  await prisma.business.updateMany({
    where: { id: businessId, onboardingCompletedAt: null },
    data: { onboardingCompletedAt: new Date() },
  });
  return true;
}

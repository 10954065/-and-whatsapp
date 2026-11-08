import { prisma } from "@/lib/db/prisma";
import { randomToken } from "@/lib/security/crypto";
import { recordAudit } from "@/modules/administration/audit.service";
import type { CreateBusinessInput } from "@/modules/businesses/business.schemas";

const MAX_BUSINESSES_PER_USER = 10;

export function slugify(name: string): string {
  return (
    name
      .normalize("NFKD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40) || "business"
  );
}

async function uniqueSlug(name: string): Promise<string> {
  const base = slugify(name);
  const taken = await prisma.business.findUnique({ where: { slug: base }, select: { id: true } });
  if (!taken) return base;
  return `${base}-${randomToken(4).toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 5)}`;
}

/**
 * Creates a workspace with the creator as OWNER, default settings and — when a public
 * Starter plan exists — a trial subscription. All rows are created atomically.
 */
export async function createBusiness(
  userId: string,
  input: CreateBusinessInput,
  meta: { ipAddress: string | null },
): Promise<{ businessId: string }> {
  const owned = await prisma.businessMembership.count({ where: { userId, role: "OWNER" } });
  if (owned >= MAX_BUSINESSES_PER_USER) {
    throw new Error(`A user can own at most ${MAX_BUSINESSES_PER_USER} workspaces.`);
  }

  const slug = await uniqueSlug(input.name);
  const trialPlan = await prisma.subscriptionPlan.findFirst({
    where: { isActive: true, isPublic: true },
    orderBy: { sortOrder: "asc" },
  });

  const business = await prisma.$transaction(async (tx) => {
    const created = await tx.business.create({
      data: {
        name: input.name,
        slug,
        industry: input.industry,
        country: input.country,
        city: input.city,
        timezone: input.timezone,
        currency: input.currency,
        onboardingState: { steps: ["workspace"] },
        settings: { create: {} },
        memberships: { create: { userId, role: "OWNER" } },
      },
      select: { id: true },
    });

    if (trialPlan) {
      const now = new Date();
      const trialEnds = new Date(now.getTime() + trialPlan.trialDays * 86_400_000);
      await tx.subscription.create({
        data: {
          businessId: created.id,
          planId: trialPlan.id,
          status: "TRIALING",
          trialEndsAt: trialEnds,
          currentPeriodStart: now,
          currentPeriodEnd: trialEnds,
        },
      });
    }

    await recordAudit(
      {
        businessId: created.id,
        actorType: "USER",
        actorId: userId,
        action: "business.created",
        entityType: "Business",
        entityId: created.id,
        metadata: { industry: input.industry, trialPlan: trialPlan?.code ?? null },
        ipAddress: meta.ipAddress,
      },
      tx,
    );
    return created;
  });

  return { businessId: business.id };
}

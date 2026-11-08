import "dotenv/config";
import { prisma } from "../src/lib/db/prisma";

/**
 * Initial subscription plans. Prices are starting values in pesewas (GHS minor units);
 * Sunleon administrators change them in Admin → Plans — nothing in the app hardcodes them.
 */
const PLANS = [
  {
    code: "STARTER",
    name: "Starter",
    description: "For small businesses getting their first AI employee online.",
    priceMonthlyMinor: 29_900,
    priceYearlyMinor: 299_000,
    sortOrder: 1,
    limits: {
      aiMessagesPerMonth: 1_500,
      aiConversationsPerMonth: 300,
      channels: 1,
      staffSeats: 2,
      knowledgeStorageMb: 50,
      workflowExecutionsPerMonth: 500,
    },
    features: ["1 channel (WhatsApp or Instagram)", "Unified inbox", "Knowledge base", "Orders & bookings", "Email support"],
  },
  {
    code: "BUSINESS",
    name: "Business",
    description: "For growing teams selling and serving across channels.",
    priceMonthlyMinor: 79_900,
    priceYearlyMinor: 799_000,
    sortOrder: 2,
    limits: {
      aiMessagesPerMonth: 6_000,
      aiConversationsPerMonth: 1_500,
      channels: 2,
      staffSeats: 10,
      knowledgeStorageMb: 500,
      workflowExecutionsPerMonth: 5_000,
    },
    features: ["WhatsApp and Instagram", "Automation studio", "Team roles & approvals", "Analytics", "Priority support"],
  },
  {
    code: "ENTERPRISE",
    name: "Enterprise",
    description: "For multi-branch businesses with high message volumes.",
    priceMonthlyMinor: 249_900,
    priceYearlyMinor: 2_499_000,
    sortOrder: 3,
    limits: {
      aiMessagesPerMonth: 30_000,
      aiConversationsPerMonth: 8_000,
      channels: 5,
      staffSeats: 50,
      knowledgeStorageMb: 5_000,
      workflowExecutionsPerMonth: 50_000,
    },
    features: ["Up to 5 channel accounts", "Advanced AI tier", "Custom onboarding", "Audit exports", "Dedicated success manager"],
  },
];

async function seedPlans(): Promise<void> {
  for (const plan of PLANS) {
    await prisma.subscriptionPlan.upsert({
      where: { code: plan.code },
      // Never overwrite prices an administrator has already edited.
      update: {},
      create: { ...plan, currency: "GHS", trialDays: 14 },
    });
  }
}

async function promoteBootstrapAdmins(): Promise<void> {
  const emails = (process.env.PLATFORM_ADMIN_EMAILS ?? "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
  if (emails.length === 0) return;
  const result = await prisma.user.updateMany({
    where: { email: { in: emails }, emailVerifiedAt: { not: null } },
    data: { platformRole: "SUPER_ADMIN" },
  });
  console.info(`Promoted ${result.count} verified platform administrator(s).`);
}

async function main(): Promise<void> {
  await seedPlans();
  await promoteBootstrapAdmins();
  console.info("Seed complete.");
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());

import { beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db/prisma";
import { withTenantTx } from "@/lib/db/tenant";
import { createBusiness } from "@/modules/businesses/business.service";
import { createBusinessFor, createUser } from "./helpers";

describe("createBusiness", () => {
  beforeAll(async () => {
    await prisma.subscriptionPlan.upsert({
      where: { code: "TEST_STARTER" },
      update: { sortOrder: -100, isActive: true, isPublic: true },
      create: {
        code: "TEST_STARTER",
        name: "Test Starter",
        priceMonthlyMinor: 100,
        priceYearlyMinor: 1000,
        limits: {},
        sortOrder: -100,
        trialDays: 14,
      },
    });
  });

  it("creates the workspace, OWNER membership, settings and a trial", async () => {
    const user = await createUser();
    const { businessId } = await createBusiness(
      user.id,
      { name: "Adwoa's Kitchen", industry: "RESTAURANT", country: "GH", city: "Accra", timezone: "Africa/Accra", currency: "GHS" },
      { ipAddress: null },
    );
    const business = await prisma.business.findUniqueOrThrow({
      where: { id: businessId },
      include: { memberships: true, settings: true, subscription: true },
    });
    expect(business.slug).toMatch(/^adwoa-s-kitchen/);
    expect(business.memberships).toEqual([expect.objectContaining({ userId: user.id, role: "OWNER", status: "ACTIVE" })]);
    expect(business.settings).not.toBeNull();
    expect(business.subscription?.status).toBe("TRIALING");
    const audit = await prisma.auditLog.findFirst({ where: { businessId, action: "business.created" } });
    expect(audit?.actorId).toBe(user.id);
  });
});

describe("row-level security (withTenantTx)", () => {
  let businessA: string;
  let businessB: string;

  beforeAll(async () => {
    const ownerA = await createUser();
    const ownerB = await createUser();
    businessA = (await createBusinessFor(ownerA.id, "Tenant A")).id;
    businessB = (await createBusinessFor(ownerB.id, "Tenant B")).id;
    await prisma.customer.createMany({
      data: [
        { businessId: businessA, displayName: "Customer of A" },
        { businessId: businessB, displayName: "Customer of B" },
      ],
    });
  });

  it("only returns the current tenant's rows even without a businessId filter", async () => {
    const visible = await withTenantTx(businessA, (tx) => tx.customer.findMany());
    expect(visible.length).toBeGreaterThan(0);
    expect(visible.every((customer) => customer.businessId === businessA)).toBe(true);
  });

  it("hides other businesses from the tenant", async () => {
    const businesses = await withTenantTx(businessA, (tx) => tx.business.findMany({ select: { id: true } }));
    expect(businesses).toEqual([{ id: businessA }]);
  });

  it("refuses to write a row into another tenant", async () => {
    await expect(
      withTenantTx(businessA, (tx) => tx.customer.create({ data: { businessId: businessB, displayName: "Injected" } })),
    ).rejects.toThrow();
    expect(await prisma.customer.count({ where: { businessId: businessB, displayName: "Injected" } })).toBe(0);
  });

  it("cannot update another tenant's rows", async () => {
    const result = await withTenantTx(businessA, (tx) =>
      tx.customer.updateMany({ where: { businessId: businessB }, data: { displayName: "Hijacked" } }),
    );
    expect(result.count).toBe(0);
  });

  it("cannot read credential tables at all", async () => {
    await expect(withTenantTx(businessA, (tx) => tx.session.findMany())).rejects.toThrow();
  });

  it("system (owner-role) queries still see every tenant", async () => {
    const count = await prisma.customer.count({ where: { businessId: { in: [businessA, businessB] } } });
    expect(count).toBeGreaterThanOrEqual(2);
  });
});

import { beforeEach, describe, expect, it, vi } from "vitest";
import type { EmailMessage } from "@/lib/email";

const mail = vi.hoisted(() => ({ sent: [] as EmailMessage[] }));
vi.mock("@/lib/email", () => ({
  sendEmail: vi.fn(async (message: EmailMessage) => {
    mail.sent.push(message);
    return true;
  }),
}));

import type { MemberRole } from "@/generated/prisma/enums";
import type { TenantActor } from "@/lib/auth/tenant";
import { prisma } from "@/lib/db/prisma";
import { updateBusinessHours, updateBusinessProfile } from "@/modules/businesses/settings.service";
import { getSetupProgress, skipSetupStep } from "@/modules/onboarding/setup.service";
import { acceptInvitation, changeMemberRole, inviteMember, removeMember } from "@/modules/team/team.service";
import { createBusinessFor, createUser, uniqueEmail } from "./helpers";

async function setupWorkspace() {
  const owner = await createUser();
  const business = await createBusinessFor(owner.id, "Kofi Electronics");
  const actor = (role: MemberRole, userId = owner.id, emailVerified = true): TenantActor => ({
    userId,
    userName: "Owner",
    emailVerified,
    businessId: business.id,
    businessName: business.name,
    role,
    ipAddress: null,
  });
  return { owner, business, actor };
}

function invitationToken(): string {
  const match = mail.sent.at(-1)?.text.match(/\/invite\/([A-Za-z0-9_-]+)/);
  if (!match) throw new Error("No invitation link in the last email");
  return match[1];
}

beforeEach(() => {
  mail.sent.length = 0;
});

describe("team invitations", () => {
  it("requires a verified inviter email", async () => {
    const { actor } = await setupWorkspace();
    await expect(inviteMember(actor("OWNER", undefined, false), { email: uniqueEmail(), role: "STAFF" })).rejects.toThrow(
      /Confirm your email/,
    );
  });

  it("never lets an admin invite another admin or owner", async () => {
    const { actor } = await setupWorkspace();
    await expect(inviteMember(actor("ADMIN"), { email: uniqueEmail(), role: "ADMIN" })).rejects.toThrow(/can't assign/);
    await expect(inviteMember(actor("OWNER"), { email: uniqueEmail(), role: "OWNER" })).rejects.toThrow(/can't assign/);
  });

  it("only lets the invited email accept, exactly once", async () => {
    const { actor, business } = await setupWorkspace();
    const inviteeEmail = uniqueEmail("invitee");
    await inviteMember(actor("OWNER"), { email: inviteeEmail, role: "MANAGER" });
    const token = invitationToken();

    const stranger = await createUser();
    await expect(acceptInvitation(stranger, token)).rejects.toThrow(/was sent to/);

    const invitee = await createUser({ email: inviteeEmail, verified: false });
    await expect(acceptInvitation(invitee, token)).resolves.toEqual({ businessId: business.id });
    const membership = await prisma.businessMembership.findUniqueOrThrow({
      where: { businessId_userId: { businessId: business.id, userId: invitee.id } },
    });
    expect(membership.role).toBe("MANAGER");
    expect((await prisma.user.findUniqueOrThrow({ where: { id: invitee.id } })).emailVerifiedAt).not.toBeNull();
    await expect(acceptInvitation(invitee, token)).rejects.toThrow(/no longer valid/);
  });

  it("rejects inviting someone who is already a member", async () => {
    const { actor, owner } = await setupWorkspace();
    await expect(inviteMember(actor("OWNER"), { email: owner.email, role: "STAFF" })).rejects.toThrow(/already a member/);
  });
});

describe("member management", () => {
  it("enforces role ceilings and blocks self-management", async () => {
    const { actor, business, owner } = await setupWorkspace();
    const admin = await createUser();
    const staff = await createUser();
    const adminMembership = await prisma.businessMembership.create({ data: { businessId: business.id, userId: admin.id, role: "ADMIN" } });
    const staffMembership = await prisma.businessMembership.create({ data: { businessId: business.id, userId: staff.id, role: "STAFF" } });
    const ownerMembership = await prisma.businessMembership.findUniqueOrThrow({
      where: { businessId_userId: { businessId: business.id, userId: owner.id } },
    });

    await expect(changeMemberRole(actor("ADMIN", admin.id), ownerMembership.id, "STAFF")).rejects.toThrow(/can't manage/);
    await expect(changeMemberRole(actor("ADMIN", admin.id), adminMembership.id, "STAFF")).rejects.toThrow(/your own/);
    await expect(changeMemberRole(actor("ADMIN", admin.id), staffMembership.id, "ADMIN")).rejects.toThrow(/can't assign/);

    await changeMemberRole(actor("ADMIN", admin.id), staffMembership.id, "MANAGER");
    expect((await prisma.businessMembership.findUniqueOrThrow({ where: { id: staffMembership.id } })).role).toBe("MANAGER");

    await removeMember(actor("OWNER"), staffMembership.id);
    expect(await prisma.businessMembership.findUnique({ where: { id: staffMembership.id } })).toBeNull();
  });

  it("cannot manage memberships of another business", async () => {
    const first = await setupWorkspace();
    const second = await setupWorkspace();
    const outsider = await createUser();
    const foreign = await prisma.businessMembership.create({ data: { businessId: second.business.id, userId: outsider.id, role: "STAFF" } });
    await expect(removeMember(first.actor("OWNER"), foreign.id)).rejects.toThrow(/not found/);
  });
});

describe("guided setup", () => {
  it("derives progress from real data and remembers skipped optional steps", async () => {
    const { actor, business } = await setupWorkspace();
    let progress = await getSetupProgress(business.id);
    expect(progress.steps.map((step) => step.id)).toEqual(["profile", "template", "hours", "knowledge", "channel", "ai", "test", "activate", "team"]);
    expect(progress.steps.every((step) => step.status === "todo")).toBe(true);

    await updateBusinessProfile(actor("OWNER"), {
      name: business.name,
      industry: "RETAIL",
      description: "Phones, laptops and accessories with same-day delivery in Accra.",
      phone: "+233200000000",
      email: null,
      website: null,
      address: null,
      city: "Accra",
      country: "GH",
      timezone: "Africa/Accra",
      currency: "GHS",
    });
    await updateBusinessHours(actor("OWNER"), {
      mon: [{ start: "08:00", end: "17:00" }],
      tue: [],
      wed: [],
      thu: [],
      fri: [],
      sat: [],
      sun: [],
    });
    await expect(skipSetupStep(actor("OWNER"), "profile")).rejects.toThrow(/can't be skipped/);
    await skipSetupStep(actor("OWNER"), "team");

    progress = await getSetupProgress(business.id);
    expect(progress.steps.map((step) => step.status)).toEqual(["done", "todo", "done", "todo", "todo", "todo", "todo", "todo", "skipped"]);
    expect(progress.isComplete).toBe(false);
  });
});

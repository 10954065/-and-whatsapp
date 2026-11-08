"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { ActionResult } from "@/lib/monitoring/errors";
import { parseInput, runAction } from "@/lib/http/action";
import { requireUserForAction } from "@/lib/auth/current";
import { getRequestMeta } from "@/lib/auth/request";
import { requireTenantAction, setActiveBusiness, toActor } from "@/lib/auth/tenant";
import { tokenSchema } from "@/modules/auth/auth.schemas";
import {
  acceptInvitation,
  changeMemberRole,
  changeRoleSchema,
  idSchema,
  inviteMember,
  inviteSchema,
  removeMember,
  revokeInvitation,
} from "@/modules/team/team.service";

async function teamActor() {
  const context = await requireTenantAction("team.manage");
  return toActor(context, (await getRequestMeta()).ipAddress);
}

export async function inviteMemberAction(_previous: ActionResult | null, formData: FormData): Promise<ActionResult> {
  return runAction(
    async () => {
      await inviteMember(await teamActor(), parseInput(inviteSchema, formData));
      revalidatePath("/app/team");
    },
    { source: "team.invite", successMessage: "Invitation sent." },
  );
}

export async function revokeInvitationAction(_previous: ActionResult | null, formData: FormData): Promise<ActionResult> {
  return runAction(
    async () => {
      await revokeInvitation(await teamActor(), parseInput(idSchema, formData).id);
      revalidatePath("/app/team");
    },
    { source: "team.revoke", successMessage: "Invitation revoked." },
  );
}

export async function changeRoleAction(_previous: ActionResult | null, formData: FormData): Promise<ActionResult> {
  return runAction(
    async () => {
      const input = parseInput(changeRoleSchema, formData);
      await changeMemberRole(await teamActor(), input.membershipId, input.role);
      revalidatePath("/app/team");
    },
    { source: "team.change_role", successMessage: "Role updated." },
  );
}

export async function removeMemberAction(_previous: ActionResult | null, formData: FormData): Promise<ActionResult> {
  return runAction(
    async () => {
      await removeMember(await teamActor(), parseInput(idSchema, formData).id);
      revalidatePath("/app/team");
    },
    { source: "team.remove", successMessage: "Member removed." },
  );
}

export async function acceptInvitationAction(_previous: ActionResult | null, formData: FormData): Promise<ActionResult> {
  return runAction(
    async () => {
      const session = await requireUserForAction();
      const { token } = parseInput(tokenSchema, formData);
      const { businessId } = await acceptInvitation(session.user, token);
      await setActiveBusiness(session.user.id, businessId);
      redirect("/app/dashboard");
    },
    { source: "team.accept" },
  );
}

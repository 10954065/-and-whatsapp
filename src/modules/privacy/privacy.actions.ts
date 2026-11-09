"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { ActionResult } from "@/lib/monitoring/errors";
import { parseInput, runAction } from "@/lib/http/action";
import { requireUserForAction } from "@/lib/auth/current";
import { getRequestMeta } from "@/lib/auth/request";
import { clearSessionCookie } from "@/lib/auth/session";
import { requireTenantAction, toActor } from "@/lib/auth/tenant";
import { accountDeletionSchema, cancelWorkspaceDeletion, deleteUserAccount, deletionRequestSchema, requestWorkspaceDeletion } from "@/modules/privacy/privacy.service";

async function ownerActor() {
  const context = await requireTenantAction("business.delete");
  return toActor(context, (await getRequestMeta()).ipAddress);
}

export async function requestWorkspaceDeletionAction(_previous: ActionResult<unknown> | null, formData: FormData): Promise<ActionResult<unknown>> {
  return runAction(
    async () => {
      await requestWorkspaceDeletion(await ownerActor(), parseInput(deletionRequestSchema, formData));
      revalidatePath("/app", "layout");
    },
    { source: "privacy.request_deletion", successMessage: "Deletion scheduled. You can cancel it until the date shown." },
  );
}

export async function cancelWorkspaceDeletionAction(): Promise<ActionResult<unknown>> {
  return runAction(
    async () => {
      await cancelWorkspaceDeletion(await ownerActor());
      revalidatePath("/app", "layout");
    },
    { source: "privacy.cancel_deletion", successMessage: "Deletion cancelled. Your workspace stays." },
  );
}

export async function deleteAccountAction(_previous: ActionResult<unknown> | null, formData: FormData): Promise<ActionResult<unknown>> {
  return runAction(
    async () => {
      const session = await requireUserForAction();
      await deleteUserAccount(session.user.id, parseInput(accountDeletionSchema, formData), (await getRequestMeta()).ipAddress);
      await clearSessionCookie();
      redirect("/login?deleted=1");
    },
    { source: "privacy.delete_account" },
  );
}

"use client";

import { useEffect } from "react";
import { toast } from "sonner";
import { Field, FormAlert, SubmitButton, fieldErrors } from "@/components/forms/form-controls";
import { SelectField } from "@/components/onboarding/create-business-form";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useActionForm } from "@/hooks/use-action-form";
import type { ActionResult } from "@/lib/monitoring/errors";
import {
  acceptInvitationAction,
  changeRoleAction,
  inviteMemberAction,
  removeMemberAction,
  revokeInvitationAction,
} from "@/modules/team/team.actions";

function useResultToast(state: ActionResult<unknown> | null) {
  useEffect(() => {
    if (!state) return;
    if (state.ok && state.message) toast.success(state.message);
    if (!state.ok) toast.error(state.error);
  }, [state]);
}

export function InviteMemberForm({ roles }: { roles: { value: string; label: string }[] }) {
  const { state, onSubmit, isPending } = useActionForm(inviteMemberAction);
  return (
    <form onSubmit={onSubmit} className="grid gap-4" noValidate>
      <FormAlert state={state} />
      <div className="grid gap-4 sm:grid-cols-[1fr_12rem_auto] sm:items-end">
        <Field label="Email address" name="email" type="email" required errors={fieldErrors(state, "email")} />
        <SelectField label="Role" name="role" defaultValue={roles.at(-2)?.value ?? "STAFF"} options={roles} errors={fieldErrors(state, "role")} />
        <SubmitButton isPending={isPending} pendingLabel="Sending…">
          Send invitation
        </SubmitButton>
      </div>
    </form>
  );
}

export function RoleSelect({ membershipId, role, roles }: { membershipId: string; role: string; roles: { value: string; label: string }[] }) {
  const { state, onSubmit, isPending } = useActionForm(changeRoleAction);
  useResultToast(state);
  return (
    <form onSubmit={onSubmit} className="flex items-center gap-2">
      <input type="hidden" name="membershipId" value={membershipId} />
      <Select name="role" defaultValue={role}>
        <SelectTrigger className="h-8 w-36" aria-label="Role">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {roles.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <SubmitButton size="sm" variant="outline" isPending={isPending}>
        Save
      </SubmitButton>
    </form>
  );
}

export function RemoveMemberButton({ membershipId, name }: { membershipId: string; name: string }) {
  const { state, onSubmit, isPending } = useActionForm(removeMemberAction);
  useResultToast(state);
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive">
          Remove
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Remove {name}?</AlertDialogTitle>
          <AlertDialogDescription>
            They lose access to this workspace immediately. Conversations and records they worked on are kept.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <form onSubmit={onSubmit}>
          <input type="hidden" name="id" value={membershipId} />
          <AlertDialogFooter>
            <AlertDialogCancel type="button">Cancel</AlertDialogCancel>
            <AlertDialogAction asChild>
              <Button type="submit" variant="destructive" disabled={isPending}>
                Remove member
              </Button>
            </AlertDialogAction>
          </AlertDialogFooter>
        </form>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export function RevokeInvitationButton({ invitationId }: { invitationId: string }) {
  const { state, onSubmit, isPending } = useActionForm(revokeInvitationAction);
  useResultToast(state);
  return (
    <form onSubmit={onSubmit}>
      <input type="hidden" name="id" value={invitationId} />
      <SubmitButton size="sm" variant="ghost" isPending={isPending}>
        Revoke
      </SubmitButton>
    </form>
  );
}

export function AcceptInvitationForm({ token, businessName }: { token: string; businessName: string }) {
  const { state, onSubmit, isPending } = useActionForm(acceptInvitationAction);
  return (
    <form onSubmit={onSubmit} className="grid gap-4">
      <FormAlert state={state} />
      <input type="hidden" name="token" value={token} />
      <SubmitButton size="lg" className="h-10 w-full" isPending={isPending} pendingLabel="Joining…">
        Join {businessName}
      </SubmitButton>
    </form>
  );
}

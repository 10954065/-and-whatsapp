"use client";

import { useActionState, startTransition } from "react";
import { ShieldCheck } from "lucide-react";
import { Field, FormAlert, SubmitButton, fieldErrors } from "@/components/forms/form-controls";
import { Button } from "@/components/ui/button";
import { useActionForm } from "@/hooks/use-action-form";
import {
  beginMfaAction,
  changePasswordAction,
  confirmMfaAction,
  disableMfaAction,
} from "@/modules/auth/auth.actions";

export function ChangePasswordForm() {
  const { state, onSubmit, isPending } = useActionForm(changePasswordAction);
  return (
    <form onSubmit={onSubmit} className="grid max-w-md gap-4" noValidate>
      <FormAlert state={state} />
      <Field
        label="Current password"
        name="currentPassword"
        type="password"
        autoComplete="current-password"
        required
        errors={fieldErrors(state, "currentPassword")}
      />
      <Field
        label="New password"
        name="newPassword"
        type="password"
        autoComplete="new-password"
        required
        hint="At least 10 characters, with a number or symbol."
        errors={fieldErrors(state, "newPassword")}
      />
      <Field
        label="Confirm new password"
        name="confirmPassword"
        type="password"
        autoComplete="new-password"
        required
        errors={fieldErrors(state, "confirmPassword")}
      />
      <div>
        <SubmitButton isPending={isPending} pendingLabel="Updating…">
          Update password
        </SubmitButton>
      </div>
    </form>
  );
}

export function MfaSetup() {
  const [setup, beginSetup, isStarting] = useActionState(beginMfaAction, null);
  const confirm = useActionForm(confirmMfaAction);

  if (confirm.state?.ok) {
    return (
      <div className="grid max-w-lg gap-4">
        <FormAlert state={confirm.state} />
        <div className="rounded-xl border bg-muted/40 p-4">
          <p className="text-sm font-semibold">Save your recovery codes</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Each code works once if you lose access to your authenticator. They will not be shown again.
          </p>
          <ul className="mt-3 grid grid-cols-2 gap-2 font-mono text-sm">
            {confirm.state.data.recoveryCodes.map((code) => (
              <li key={code} className="rounded-md bg-background px-2 py-1 text-center">
                {code}
              </li>
            ))}
          </ul>
        </div>
      </div>
    );
  }

  if (!setup?.ok) {
    return (
      <div className="grid max-w-lg gap-3">
        <FormAlert state={setup} />
        <p className="text-sm text-muted-foreground">
          Protect your account with a time-based code from an authenticator app such as Google Authenticator or 1Password.
        </p>
        <div>
          <Button
            type="button"
            onClick={() => startTransition(() => beginSetup(new FormData()))}
            disabled={isStarting}
          >
            <ShieldCheck /> {isStarting ? "Preparing…" : "Set up two-factor authentication"}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="grid max-w-lg gap-5 sm:grid-cols-[auto_1fr]">
      {/* A data: URL generated on the server; next/image is unnecessary here. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={setup.data.qrDataUrl}
        alt="QR code for your authenticator app"
        width={176}
        height={176}
        className="rounded-xl border bg-white p-2"
      />
      <form onSubmit={confirm.onSubmit} className="grid content-start gap-3" noValidate>
        <p className="text-sm text-muted-foreground">
          Scan the QR code, or enter this key manually:
          <code className="mt-1 block rounded bg-muted px-2 py-1 font-mono text-xs break-all text-foreground">
            {setup.data.secret}
          </code>
        </p>
        <FormAlert state={confirm.state} />
        <Field
          label="6-digit code"
          name="code"
          inputMode="numeric"
          autoComplete="one-time-code"
          required
          errors={fieldErrors(confirm.state, "code")}
        />
        <div>
          <SubmitButton isPending={confirm.isPending} pendingLabel="Verifying…">
            Turn on
          </SubmitButton>
        </div>
      </form>
    </div>
  );
}

export function DisableMfaForm() {
  const { state, onSubmit, isPending } = useActionForm(disableMfaAction);
  return (
    <form onSubmit={onSubmit} className="grid max-w-md gap-4" noValidate>
      <FormAlert state={state} />
      {state?.ok ? null : (
        <>
          <Field
            label="Confirm with your password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            errors={fieldErrors(state, "password")}
          />
          <div>
            <SubmitButton variant="destructive" isPending={isPending} pendingLabel="Turning off…">
              Turn off two-factor authentication
            </SubmitButton>
          </div>
        </>
      )}
    </form>
  );
}

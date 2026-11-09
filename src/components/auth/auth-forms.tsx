"use client";

import Link from "next/link";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Field, FormAlert, SubmitButton, fieldErrors } from "@/components/forms/form-controls";
import { useActionForm } from "@/hooks/use-action-form";
import {
  forgotPasswordAction,
  loginAction,
  registerAction,
  resendVerificationAction,
  resetPasswordAction,
  verifyEmailAction,
  verifyMfaAction,
} from "@/modules/auth/auth.actions";

export function LoginForm({ next }: { next?: string }) {
  const { state, onSubmit, isPending } = useActionForm(loginAction);
  return (
    <form onSubmit={onSubmit} className="grid gap-4" noValidate>
      <FormAlert state={state} />
      <Field
        label="Email"
        name="email"
        type="email"
        autoComplete="email"
        required
        errors={fieldErrors(state, "email")}
      />
      <Field
        label="Password"
        name="password"
        type="password"
        autoComplete="current-password"
        required
        errors={fieldErrors(state, "password")}
      />
      <input type="hidden" name="next" value={next ?? ""} />
      <div className="-mt-1 flex justify-end">
        <Link href="/forgot-password" className="text-sm font-medium text-foreground link-underline">
          Forgot password?
        </Link>
      </div>
      <SubmitButton size="lg" className="h-10 w-full" isPending={isPending} pendingLabel="Signing in…">
        Sign in
      </SubmitButton>
    </form>
  );
}

export function RegisterForm({ next }: { next?: string }) {
  const { state, onSubmit, isPending } = useActionForm(registerAction);
  return (
    <form onSubmit={onSubmit} className="grid gap-4" noValidate>
      <FormAlert state={state} />
      <input type="hidden" name="next" value={next ?? ""} />
      <Field label="Full name" name="name" autoComplete="name" required errors={fieldErrors(state, "name")} />
      <Field
        label="Work email"
        name="email"
        type="email"
        autoComplete="email"
        required
        errors={fieldErrors(state, "email")}
      />
      <Field
        label="Password"
        name="password"
        type="password"
        autoComplete="new-password"
        required
        hint="At least 10 characters, with a number or symbol."
        errors={fieldErrors(state, "password")}
      />
      <div className="grid gap-1.5">
        <div className="flex items-start gap-2.5">
          <Checkbox id="acceptTerms" name="acceptTerms" value="on" aria-invalid={Boolean(fieldErrors(state, "acceptTerms")) || undefined} />
          <Label htmlFor="acceptTerms" className="text-sm leading-5 font-normal text-muted-foreground">
            <span>
              I agree to the{" "}
              <Link href="/terms" className="font-medium text-foreground link-underline">
                Terms of Service
              </Link>{" "}
              and{" "}
              <Link href="/privacy" className="font-medium text-foreground link-underline">
                Privacy Policy
              </Link>
              .
            </span>
          </Label>
        </div>
        {fieldErrors(state, "acceptTerms") ? (
          <p className="text-xs font-medium text-destructive">{fieldErrors(state, "acceptTerms")?.join(" ")}</p>
        ) : null}
      </div>
      <SubmitButton size="lg" className="h-10 w-full" isPending={isPending} pendingLabel="Creating account…">
        Create account
      </SubmitButton>
    </form>
  );
}

export function ForgotPasswordForm() {
  const { state, onSubmit, isPending } = useActionForm(forgotPasswordAction);
  return (
    <form onSubmit={onSubmit} className="grid gap-4" noValidate>
      <FormAlert state={state} />
      <Field
        label="Email"
        name="email"
        type="email"
        autoComplete="email"
        required
        errors={fieldErrors(state, "email")}
      />
      <SubmitButton size="lg" className="h-10 w-full" isPending={isPending} pendingLabel="Sending…">
        Email me a reset link
      </SubmitButton>
    </form>
  );
}

export function ResetPasswordForm({ token }: { token: string }) {
  const { state, onSubmit, isPending } = useActionForm(resetPasswordAction);
  return (
    <form onSubmit={onSubmit} className="grid gap-4" noValidate>
      <FormAlert state={state} />
      <input type="hidden" name="token" value={token} />
      <Field
        label="New password"
        name="password"
        type="password"
        autoComplete="new-password"
        required
        hint="At least 10 characters, with a number or symbol."
        errors={fieldErrors(state, "password")}
      />
      <Field
        label="Confirm new password"
        name="confirmPassword"
        type="password"
        autoComplete="new-password"
        required
        errors={fieldErrors(state, "confirmPassword")}
      />
      <SubmitButton size="lg" className="h-10 w-full" isPending={isPending} pendingLabel="Saving…">
        Set new password
      </SubmitButton>
    </form>
  );
}

export function MfaForm({ next }: { next?: string }) {
  const { state, onSubmit, isPending } = useActionForm(verifyMfaAction);
  return (
    <form onSubmit={onSubmit} className="grid gap-4" noValidate>
      <FormAlert state={state} />
      <Field
        label="Authentication code"
        name="code"
        inputMode="numeric"
        autoComplete="one-time-code"
        autoFocus
        required
        hint="Enter the 6-digit code from your authenticator app, or a recovery code."
        errors={fieldErrors(state, "code")}
      />
      <input type="hidden" name="next" value={next ?? ""} />
      <SubmitButton size="lg" className="h-10 w-full" isPending={isPending} pendingLabel="Verifying…">
        Verify
      </SubmitButton>
    </form>
  );
}

export function VerifyEmailForm({ token }: { token: string }) {
  const { state, onSubmit, isPending } = useActionForm(verifyEmailAction);
  return (
    <form onSubmit={onSubmit} className="grid gap-4">
      <FormAlert state={state} />
      <input type="hidden" name="token" value={token} />
      <SubmitButton size="lg" className="h-10 w-full" isPending={isPending} pendingLabel="Confirming…">
        Confirm my email address
      </SubmitButton>
    </form>
  );
}

export function ResendVerificationForm() {
  const { state, onSubmit, isPending } = useActionForm(resendVerificationAction);
  return (
    <form onSubmit={onSubmit} className="grid gap-3">
      <FormAlert state={state} />
      <SubmitButton variant="outline" isPending={isPending} pendingLabel="Sending…">
        Resend verification email
      </SubmitButton>
    </form>
  );
}

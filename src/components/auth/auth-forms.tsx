"use client";

import { useState, useTransition, type ChangeEvent, type FormEvent } from "react";
import Link from "next/link";
import { useAnimate, useReducedMotion } from "motion/react";
import { useAuthStage } from "@/components/auth/auth-stage";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Field, FormAlert, SubmitButton, fieldErrors } from "@/components/forms/form-controls";
import { useActionForm } from "@/hooks/use-action-form";
import type { ActionResult } from "@/lib/monitoring/errors";
import type { AuthDestination } from "@/modules/auth/auth.schemas";
import {
  forgotPasswordAction,
  loginAction,
  registerAction,
  resendVerificationAction,
  resetPasswordAction,
  verifyEmailAction,
  verifyMfaAction,
} from "@/modules/auth/auth.actions";

type AuthAction = (previous: ActionResult<AuthDestination> | null, formData: FormData) => Promise<ActionResult<AuthDestination>>;

const LOOK_FULL_AT = 26;
const SHAKE_X = [0, -9, 8, -6, 5, -2, 0];

/** Eye direction for a text field: left when empty, right once about a line has been typed. */
function lookFor(value: string): number {
  return (Math.min(value.length, LOOK_FULL_AT) / LOOK_FULL_AT) * 2 - 1;
}

/** A rough 0 to 1 score for the sun's glow; the server's password rules are what count. */
function passwordStrength(value: string): number {
  if (!value) return 0;
  const length = Math.min(value.length / 12, 1) * 0.6;
  const variety = (/[\d\W_]/.test(value) ? 0.2 : 0) + (/[a-z]/.test(value) && /[A-Z]/.test(value) ? 0.2 : 0);
  return length + variety;
}

/**
 * Submits a sign-in or sign-up form and tells the stage how it went: the sun waits while the
 * request runs, turns sad and the form shakes when it is refused, and the sunrise plays on success.
 */
function useStagedAuthForm(action: AuthAction) {
  const stage = useAuthStage();
  const reduceMotion = useReducedMotion();
  const [state, setState] = useState<ActionResult<AuthDestination> | null>(null);
  const [isPending, startTransition] = useTransition();
  const [formRef, animate] = useAnimate<HTMLFormElement>();

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    stage.setPending(true);
    startTransition(async () => {
      let result: ActionResult<AuthDestination>;
      try {
        result = await action(null, formData);
      } catch {
        result = { ok: false, error: "Something went wrong. Please try again.", code: "INTERNAL" };
      }
      stage.setPending(false);
      setState(result);
      if (result.ok) {
        stage.celebrate(result.data.redirectTo, !result.data.celebrate);
        return;
      }
      stage.fail();
      if (!reduceMotion && formRef.current) void animate(formRef.current, { x: SHAKE_X }, { duration: 0.42, ease: "easeOut" });
    });
  };

  const watch = {
    onFocus: (event: ChangeEvent<HTMLInputElement>) => stage.attend("text", lookFor(event.target.value)),
    onChange: (event: ChangeEvent<HTMLInputElement>) => stage.attend("text", lookFor(event.target.value)),
    onBlur: () => stage.attend(null),
  };
  const lookAway = { onFocus: () => stage.attend("secret"), onBlur: () => stage.attend(null) };

  // The button stays busy through the sunrise, so a second click cannot start another sign-in.
  return { state, onSubmit, isBusy: isPending || stage.mood === "happy", formRef, watch, lookAway, setStrength: stage.setStrength };
}

export function LoginForm({ next }: { next?: string }) {
  const { state, onSubmit, isBusy, formRef, watch, lookAway } = useStagedAuthForm(loginAction);
  return (
    <form ref={formRef} onSubmit={onSubmit} className="grid gap-4" noValidate>
      <FormAlert state={state} />
      <Field
        label="Email"
        name="email"
        type="email"
        autoComplete="email"
        required
        errors={fieldErrors(state, "email")}
        {...watch}
      />
      <Field
        label="Password"
        name="password"
        type="password"
        autoComplete="current-password"
        required
        errors={fieldErrors(state, "password")}
        {...lookAway}
      />
      <input type="hidden" name="next" value={next ?? ""} />
      <div className="-mt-1 flex justify-end">
        <Link href="/forgot-password" className="text-sm font-medium text-foreground link-underline">
          Forgot password?
        </Link>
      </div>
      <SubmitButton size="lg" className="sunrise-cta h-10 w-full" isPending={isBusy} pendingLabel="Signing in…">
        Sign in
      </SubmitButton>
    </form>
  );
}

export function RegisterForm({ next }: { next?: string }) {
  const { state, onSubmit, isBusy, formRef, watch, lookAway, setStrength } = useStagedAuthForm(registerAction);
  return (
    <form ref={formRef} onSubmit={onSubmit} className="grid gap-4" noValidate>
      <FormAlert state={state} />
      <input type="hidden" name="next" value={next ?? ""} />
      <Field label="Full name" name="name" autoComplete="name" required errors={fieldErrors(state, "name")} {...watch} />
      <Field
        label="Work email"
        name="email"
        type="email"
        autoComplete="email"
        required
        errors={fieldErrors(state, "email")}
        {...watch}
      />
      <Field
        label="Password"
        name="password"
        type="password"
        autoComplete="new-password"
        required
        hint="At least 10 characters, with a number or symbol."
        errors={fieldErrors(state, "password")}
        {...lookAway}
        onChange={(event: ChangeEvent<HTMLInputElement>) => setStrength(passwordStrength(event.target.value))}
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
      <SubmitButton size="lg" className="sunrise-cta h-10 w-full" isPending={isBusy} pendingLabel="Creating account…">
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
      <SubmitButton size="lg" className="sunrise-cta h-10 w-full" isPending={isPending} pendingLabel="Sending…">
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
      <SubmitButton size="lg" className="sunrise-cta h-10 w-full" isPending={isPending} pendingLabel="Saving…">
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
      <SubmitButton size="lg" className="sunrise-cta h-10 w-full" isPending={isPending} pendingLabel="Verifying…">
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
      <SubmitButton size="lg" className="sunrise-cta h-10 w-full" isPending={isPending} pendingLabel="Confirming…">
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

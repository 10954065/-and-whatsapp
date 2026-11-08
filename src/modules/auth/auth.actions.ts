"use server";

import { redirect } from "next/navigation";
import type { ActionResult } from "@/lib/monitoring/errors";
import { fail } from "@/lib/monitoring/errors";
import { parseInput, runAction, safeRedirectPath } from "@/lib/http/action";
import { getRequestMeta } from "@/lib/auth/request";
import { requireUserForAction } from "@/lib/auth/current";
import {
  clearSessionCookie,
  createSession,
  invalidateSession,
  markSessionMfaVerified,
  setSessionCookie,
} from "@/lib/auth/session";
import { getCurrentSession } from "@/lib/auth/current";
import { enforceRateLimit, RATE_LIMITS } from "@/lib/security/rate-limit";
import {
  authenticate,
  changePassword,
  registerUser,
  requestPasswordReset,
  resendVerificationEmail,
  resetPassword,
  verifyEmail,
} from "@/modules/auth/auth.service";
import { beginMfaEnrollment, confirmMfaEnrollment, disableMfa, verifyMfaChallenge } from "@/modules/auth/mfa.service";
import {
  changePasswordSchema,
  disableMfaSchema,
  forgotPasswordSchema,
  loginSchema,
  mfaCodeSchema,
  registerSchema,
  resetPasswordSchema,
  tokenSchema,
} from "@/modules/auth/auth.schemas";

type FormAction<T = void> = (previous: ActionResult<T> | null, formData: FormData) => Promise<ActionResult<T>>;

export const registerAction: FormAction = async (_previous, formData) =>
  runAction(
    async () => {
      const input = parseInput(registerSchema, formData);
      const meta = await getRequestMeta();
      const { userId } = await registerUser(input, meta);
      const { token } = await createSession(userId, { ...meta, mfaVerified: true });
      await setSessionCookie(token);
      redirect(safeRedirectPath(input.next, "/onboarding"));
    },
    { source: "auth.register" },
  );

export const loginAction: FormAction = async (_previous, formData) =>
  runAction(
    async () => {
      const input = parseInput(loginSchema, formData);
      const meta = await getRequestMeta();
      const { userId, requiresMfa } = await authenticate(input, meta);
      const { token } = await createSession(userId, { ...meta, mfaVerified: !requiresMfa });
      await setSessionCookie(token);
      const destination = safeRedirectPath(input.next, "/app/dashboard");
      redirect(requiresMfa ? `/login/mfa?next=${encodeURIComponent(destination)}` : destination);
    },
    { source: "auth.login" },
  );

export async function logoutAction(): Promise<void> {
  const session = await getCurrentSession();
  if (session) await invalidateSession(session.sessionId);
  await clearSessionCookie();
  redirect("/login");
}

export const forgotPasswordAction: FormAction = async (_previous, formData) =>
  runAction(
    async () => {
      const { email } = parseInput(forgotPasswordSchema, formData);
      await requestPasswordReset(email, await getRequestMeta());
    },
    {
      source: "auth.forgot_password",
      successMessage: "If an account exists for that email, we've sent a password reset link.",
    },
  );

export const resetPasswordAction: FormAction = async (_previous, formData) =>
  runAction(
    async () => {
      const input = parseInput(resetPasswordSchema, formData);
      await resetPassword(input.token, input.password, await getRequestMeta());
      redirect("/login?reset=1");
    },
    { source: "auth.reset_password" },
  );

export const verifyEmailAction: FormAction = async (_previous, formData) =>
  runAction(
    async () => {
      const { token } = parseInput(tokenSchema, formData);
      await verifyEmail(token);
      const session = await getCurrentSession();
      redirect(session ? "/app/dashboard?verified=1" : "/login?verified=1");
    },
    { source: "auth.verify_email" },
  );

export const resendVerificationAction: FormAction = async () =>
  runAction(
    async () => {
      const session = await requireUserForAction();
      await resendVerificationEmail(session.user.id);
    },
    { source: "auth.resend_verification", successMessage: "Verification email sent. Check your inbox." },
  );

export const verifyMfaAction: FormAction = async (_previous, formData) =>
  runAction(
    async () => {
      const session = await requireUserForAction({ allowPendingMfa: true });
      const { code } = parseInput(mfaCodeSchema, formData);
      await enforceRateLimit(RATE_LIMITS.mfa, session.sessionId);
      if (!(await verifyMfaChallenge(session.user.id, code))) {
        throw fail.validation("That code is not valid.", { code: ["Invalid or expired code."] });
      }
      await markSessionMfaVerified(session.sessionId);
      redirect(safeRedirectPath(formData.get("next"), "/app/dashboard"));
    },
    { source: "auth.verify_mfa" },
  );

export const beginMfaAction: FormAction<{ secret: string; qrDataUrl: string }> = async () =>
  runAction(
    async () => {
      const session = await requireUserForAction();
      const { secret, qrDataUrl } = await beginMfaEnrollment(session.user.id);
      return { secret, qrDataUrl };
    },
    { source: "auth.mfa_begin" },
  );

export const confirmMfaAction: FormAction<{ recoveryCodes: string[] }> = async (_previous, formData) =>
  runAction(
    async () => {
      const session = await requireUserForAction();
      const { code } = parseInput(mfaCodeSchema, formData);
      const result = await confirmMfaEnrollment(session.user.id, code);
      await markSessionMfaVerified(session.sessionId);
      return result;
    },
    { source: "auth.mfa_confirm", successMessage: "Two-factor authentication is on." },
  );

export const disableMfaAction: FormAction = async (_previous, formData) =>
  runAction(
    async () => {
      const session = await requireUserForAction();
      const { password } = parseInput(disableMfaSchema, formData);
      await disableMfa(session.user.id, password);
    },
    { source: "auth.mfa_disable", successMessage: "Two-factor authentication is off." },
  );

export const changePasswordAction: FormAction = async (_previous, formData) =>
  runAction(
    async () => {
      const session = await requireUserForAction();
      const input = parseInput(changePasswordSchema, formData);
      await changePassword(session.user.id, input.currentPassword, input.newPassword, session.sessionId);
    },
    { source: "auth.change_password", successMessage: "Password updated. Other devices were signed out." },
  );

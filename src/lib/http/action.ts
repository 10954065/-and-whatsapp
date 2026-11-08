import { unstable_rethrow } from "next/navigation";
import { ZodError, type ZodType } from "zod";
import { fail, isAppError, zodFieldErrors, type ActionResult } from "@/lib/monitoring/errors";
import { reportError } from "@/lib/monitoring/report";

/**
 * Wraps a Server Action body: returns a typed result for expected failures, reports
 * unexpected ones, and lets Next.js control-flow errors (redirect, notFound) through.
 */
export async function runAction<T>(
  fn: () => Promise<T>,
  options: { source: string; successMessage?: string },
): Promise<ActionResult<T>> {
  try {
    const data = await fn();
    return { ok: true, data, message: options.successMessage };
  } catch (error) {
    unstable_rethrow(error);
    if (isAppError(error)) {
      return { ok: false, error: error.message, code: error.code, fieldErrors: error.fieldErrors };
    }
    if (error instanceof ZodError) {
      return {
        ok: false,
        error: "Please check the highlighted fields.",
        code: "VALIDATION",
        fieldErrors: zodFieldErrors(error),
      };
    }
    await reportError(error, { source: options.source });
    return { ok: false, error: "Something went wrong. Please try again.", code: "INTERNAL" };
  }
}

/** FormData → plain object. Repeated keys become arrays; files are ignored. */
export function formDataToObject(formData: FormData): Record<string, string | string[]> {
  const output: Record<string, string | string[]> = {};
  for (const [key, value] of formData.entries()) {
    if (typeof value !== "string" || key.startsWith("$ACTION")) continue;
    const existing = output[key];
    if (existing === undefined) output[key] = value;
    else output[key] = Array.isArray(existing) ? [...existing, value] : [existing, value];
  }
  return output;
}

/** Validates input, throwing a VALIDATION AppError with per-field messages. */
export function parseInput<T>(schema: ZodType<T>, input: FormData | unknown): T {
  const raw = input instanceof FormData ? formDataToObject(input) : input;
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    throw fail.validation("Please check the highlighted fields.", zodFieldErrors(parsed.error));
  }
  return parsed.data;
}

/** Only allow same-site relative redirect targets ("/app/inbox", never "//evil.com"). */
export function safeRedirectPath(value: unknown, fallback: string): string {
  if (typeof value !== "string") return fallback;
  if (!value.startsWith("/") || value.startsWith("//") || value.includes("\\")) return fallback;
  return value;
}

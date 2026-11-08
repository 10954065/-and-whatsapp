import { ZodError } from "zod";

export type AppErrorCode =
  | "VALIDATION"
  | "UNAUTHENTICATED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "CONFLICT"
  | "RATE_LIMITED"
  | "LIMIT_EXCEEDED"
  | "PRECONDITION"
  | "PROVIDER"
  | "INTERNAL";

const STATUS_BY_CODE: Record<AppErrorCode, number> = {
  VALIDATION: 400,
  UNAUTHENTICATED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  RATE_LIMITED: 429,
  LIMIT_EXCEEDED: 402,
  PRECONDITION: 412,
  PROVIDER: 502,
  INTERNAL: 500,
};

export type FieldErrors = Record<string, string[]>;

/** An expected failure whose message is safe to show to the user. */
export class AppError extends Error {
  readonly code: AppErrorCode;
  readonly status: number;
  readonly fieldErrors?: FieldErrors;

  constructor(code: AppErrorCode, message: string, options: { fieldErrors?: FieldErrors; cause?: unknown } = {}) {
    super(message, { cause: options.cause });
    this.name = "AppError";
    this.code = code;
    this.status = STATUS_BY_CODE[code];
    this.fieldErrors = options.fieldErrors;
  }
}

export const fail = {
  validation: (message: string, fieldErrors?: FieldErrors) => new AppError("VALIDATION", message, { fieldErrors }),
  unauthenticated: () => new AppError("UNAUTHENTICATED", "Please sign in to continue."),
  forbidden: (message = "You do not have permission to do that.") => new AppError("FORBIDDEN", message),
  notFound: (entity = "Record") => new AppError("NOT_FOUND", `${entity} not found.`),
  conflict: (message: string) => new AppError("CONFLICT", message),
  rateLimited: (retryAfterSeconds: number) =>
    new AppError("RATE_LIMITED", `Too many attempts. Try again in ${Math.max(1, Math.ceil(retryAfterSeconds / 60))} minute(s).`),
  limitExceeded: (message: string) => new AppError("LIMIT_EXCEEDED", message),
  precondition: (message: string) => new AppError("PRECONDITION", message),
  provider: (message: string, cause?: unknown) => new AppError("PROVIDER", message, { cause }),
};

export type ActionResult<T = void> =
  | { ok: true; data: T; message?: string }
  | { ok: false; error: string; code: AppErrorCode; fieldErrors?: FieldErrors };

export function zodFieldErrors(error: ZodError): FieldErrors {
  const fieldErrors: FieldErrors = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "_form";
    (fieldErrors[key] ??= []).push(issue.message);
  }
  return fieldErrors;
}

export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}

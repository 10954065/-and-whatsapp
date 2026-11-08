type LogLevel = "debug" | "info" | "warn" | "error";
type LogContext = Record<string, unknown>;

const SENSITIVE_KEY = /(pass(word)?|secret|token|authorization|cookie|api[-_]?key|credential|signature|otp|code_verifier)/i;
const MAX_DEPTH = 5;
const MAX_STRING = 2_000;

/** Removes secrets from structured log context before it leaves the process. */
export function redact(value: unknown, depth = 0): unknown {
  if (depth > MAX_DEPTH) return "[truncated]";
  if (value === null || value === undefined) return value;
  if (typeof value === "string") return value.length > MAX_STRING ? `${value.slice(0, MAX_STRING)}…` : value;
  if (typeof value !== "object") return value;
  if (value instanceof Error) {
    return { name: value.name, message: value.message, stack: value.stack?.split("\n").slice(0, 8).join("\n") };
  }
  if (Array.isArray(value)) return value.slice(0, 50).map((item) => redact(item, depth + 1));
  const output: Record<string, unknown> = {};
  for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
    output[key] = SENSITIVE_KEY.test(key) ? "[redacted]" : redact(entry, depth + 1);
  }
  return output;
}

function write(level: LogLevel, message: string, context: LogContext = {}): void {
  if (level === "debug" && process.env.LOG_LEVEL !== "debug") return;
  const line = JSON.stringify({
    level,
    msg: message,
    time: new Date().toISOString(),
    ...(redact(context) as LogContext),
  });
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.info(line);
}

export interface Logger {
  debug(message: string, context?: LogContext): void;
  info(message: string, context?: LogContext): void;
  warn(message: string, context?: LogContext): void;
  error(message: string, context?: LogContext): void;
  child(bindings: LogContext): Logger;
}

function createLogger(bindings: LogContext = {}): Logger {
  return {
    debug: (message, context) => write("debug", message, { ...bindings, ...context }),
    info: (message, context) => write("info", message, { ...bindings, ...context }),
    warn: (message, context) => write("warn", message, { ...bindings, ...context }),
    error: (message, context) => write("error", message, { ...bindings, ...context }),
    child: (extra) => createLogger({ ...bindings, ...extra }),
  };
}

export const logger = createLogger();

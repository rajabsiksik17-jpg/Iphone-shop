import "server-only";
import { db } from "./db";

type Level = "debug" | "info" | "warn" | "error";

const SENSITIVE = /pass(word)?|secret|token|apikey|api_key|authorization|cookie|otp/i;

/** Recursively mask values whose keys look sensitive before they hit storage. */
export function redact(value: unknown, depth = 0): unknown {
  if (depth > 5 || value === null || typeof value !== "object") return value;
  if (value instanceof Error) return { name: value.name, message: value.message };
  if (Array.isArray(value)) return value.map((v) => redact(v, depth + 1));
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([k, v]) => [k, SENSITIVE.test(k) ? "[redacted]" : redact(v, depth + 1)]),
  );
}

function write(level: Level, source: string, message: string, context?: Record<string, unknown>) {
  const safe = context ? (redact(context) as Record<string, unknown>) : undefined;
  // Context is serialised into the line itself: some log sinks render objects as "{}".
  const line = `[${new Date().toISOString()}] ${level.toUpperCase()} ${source}: ${message}${safe ? ` ${JSON.stringify(safe)}` : ""}`;
  (level === "error" ? console.error : level === "warn" ? console.warn : console.log)(line);
  // Persist warnings and errors so admins can trace failures from the dashboard.
  if (level === "warn" || level === "error") {
    db.systemLog
      .create({ data: { level, source, message: message.slice(0, 2000), context: (safe ?? {}) as object } })
      .catch(() => {});
  }
}

export const logger = {
  debug: (source: string, message: string, context?: Record<string, unknown>) => {
    if (process.env.NODE_ENV !== "production") write("debug", source, message, context);
  },
  info: (source: string, message: string, context?: Record<string, unknown>) => write("info", source, message, context),
  warn: (source: string, message: string, context?: Record<string, unknown>) => write("warn", source, message, context),
  error: (source: string, message: string, context?: Record<string, unknown>) => write("error", source, message, context),
};

export function errorMessage(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

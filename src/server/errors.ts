import { z } from "zod";

/**
 * Errors carry a stable machine `code` that the UI maps to a friendly,
 * translated message. Technical details stay in server logs.
 */
export class AppError extends Error {
  constructor(
    public code: string,
    public status = 400,
    public details?: Record<string, unknown>,
  ) {
    super(code);
  }
}

export const Errors = {
  unauthorized: () => new AppError("unauthorized", 401),
  forbidden: () => new AppError("forbidden", 403),
  notFound: (what = "resource") => new AppError("not_found", 404, { what }),
  rateLimited: (retryAfterSec: number) => new AppError("rate_limited", 429, { retryAfterSec }),
  invalid: (fieldErrors?: Record<string, string[]>) => new AppError("validation", 422, { fieldErrors }),
  conflict: (code = "conflict") => new AppError(code, 409),
};

export type FieldErrors = Record<string, string[]>;

export type ActionResult<T = undefined> =
  | { ok: true; data: T; message?: string }
  | { ok: false; error: string; fieldErrors?: FieldErrors; retryAfterSec?: number; meta?: Record<string, unknown> };

export function zodFieldErrors(error: z.ZodError): FieldErrors {
  const out: FieldErrors = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "_";
    (out[key] ??= []).push(issue.message);
  }
  return out;
}

/** Convert any thrown value into a safe ActionResult. */
export function toActionError(e: unknown): Extract<ActionResult, { ok: false }> {
  if (e instanceof AppError) {
    return {
      ok: false,
      error: e.code,
      fieldErrors: e.details?.fieldErrors as FieldErrors | undefined,
      retryAfterSec: e.details?.retryAfterSec as number | undefined,
      meta: e.details ? Object.fromEntries(Object.entries(e.details).filter(([k]) => k !== "fieldErrors")) : undefined,
    };
  }
  if (e instanceof z.ZodError) return { ok: false, error: "validation", fieldErrors: zodFieldErrors(e) };
  // Next.js uses thrown errors for redirect()/notFound(); let them propagate.
  if (e && typeof e === "object" && "digest" in e && typeof (e as { digest: unknown }).digest === "string") {
    const digest = (e as { digest: string }).digest;
    if (digest.startsWith("NEXT_REDIRECT") || digest.startsWith("NEXT_HTTP_ERROR") || digest === "NEXT_NOT_FOUND") throw e;
  }
  console.error("[action] unexpected error", e);
  return { ok: false, error: "server_error" };
}

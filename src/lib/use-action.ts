"use client";

import { useCallback } from "react";
import { useTranslations } from "next-intl";
import type { ActionResult } from "@/server/errors";

/** Map an ActionResult error code to a friendly, translated message. */
export function useErrorMessage() {
  const t = useTranslations("errors");
  return useCallback(
    (result: Extract<ActionResult<unknown>, { ok: false }> | { error: string; retryAfterSec?: number }) => {
      if (result.error === "rate_limited") return t("rate_limited", { seconds: result.retryAfterSec ?? 30 });
      return t.has(result.error as never) ? t(result.error as never) : t("generic");
    },
    [t],
  );
}

/** Translate a field error code (e.g. "invalid_phone", "tooShort", or a raw Zod message). */
export function useFieldError() {
  const t = useTranslations("errors");
  return useCallback(
    (codes?: string[] | null) => {
      if (!codes?.length) return null;
      const c = codes[0];
      if (t.has(c as never)) return t(c as never);
      if (/email/i.test(c)) return t("invalid_email");
      if (/too_small|at least|>=|Too small/i.test(c)) return t("tooShort");
      if (/too_big|at most|Too big/i.test(c)) return t("tooLong");
      if (/required|Invalid input|expected/i.test(c)) return t("required");
      return t("generic");
    },
    [t],
  );
}

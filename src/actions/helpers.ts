import "server-only";
import { z } from "zod";
import { toActionError, type ActionResult } from "@/server/errors";
import { isLocale, type Locale } from "@/i18n/config";

/** Wrap a server action body: never leak exceptions, always return ActionResult. */
export async function run<T>(fn: () => Promise<T>, message?: string): Promise<ActionResult<T>> {
  try {
    return { ok: true, data: await fn(), message };
  } catch (e) {
    return toActionError(e);
  }
}

export const localeSchema = z.string().refine(isLocale).transform((v) => v as Locale);
export const idSchema = z.string().min(1).max(64);

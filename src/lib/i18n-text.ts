import { z } from "zod";
import { defaultLocale, locales, type Locale } from "@/i18n/config";

/** Translatable value stored as `{ en: "...", ar: "..." }`. */
export type LocalizedText = Partial<Record<Locale, string>>;

/**
 * Resolve a localized value with graceful fallback (requested → default →
 * any non-empty) so a missing translation never renders a blank label.
 */
export function t(value: unknown, locale: Locale | string, fallback = ""): string {
  if (typeof value === "string") return value;
  if (!value || typeof value !== "object") return fallback;
  const v = value as Record<string, unknown>;
  const pick = (k: string) => (typeof v[k] === "string" && (v[k] as string).trim() ? (v[k] as string) : undefined);
  return pick(locale) ?? pick(defaultLocale) ?? locales.map(pick).find(Boolean) ?? fallback;
}

export function asLocalized(value: unknown): LocalizedText {
  if (!value || typeof value !== "object") return {};
  const out: LocalizedText = {};
  for (const l of locales) {
    const s = (value as Record<string, unknown>)[l];
    if (typeof s === "string") out[l] = s;
  }
  return out;
}

/** Zod schema for localized text. `required` demands at least one locale. */
export function localized(opts: { required?: boolean; max?: number } = {}) {
  const max = opts.max ?? 10_000;
  const base = z.object(Object.fromEntries(locales.map((l) => [l, z.string().trim().max(max).optional()]))) as z.ZodType<LocalizedText>;
  return opts.required
    ? base.refine((v) => locales.some((l) => (v[l] ?? "").length > 0), { message: "required" })
    : base;
}

/** All locale strings joined — used to build search text. */
export function allLocales(value: unknown): string {
  return locales.map((l) => t(value, l)).filter(Boolean).join(" ");
}

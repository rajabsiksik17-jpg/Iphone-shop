export const locales = ["ar", "en"] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = "ar";

export const localeMeta: Record<Locale, { dir: "rtl" | "ltr"; label: string; short: string; intl: string; og: string }> = {
  ar: { dir: "rtl", label: "العربية", short: "ع", intl: "ar-JO", og: "ar_JO" },
  en: { dir: "ltr", label: "English", short: "EN", intl: "en-US", og: "en_US" },
};

export function isLocale(v: unknown): v is Locale {
  return typeof v === "string" && (locales as readonly string[]).includes(v);
}

export const dirOf = (l: Locale) => localeMeta[l].dir;

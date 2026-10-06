import { defineRouting } from "next-intl/routing";
import { defaultLocale, locales } from "./config";

export const routing = defineRouting({
  locales,
  defaultLocale,
  // Locale is always in the URL (/ar/…, /en/…): unambiguous for crawlers and
  // hreflang, and shareable links keep their language.
  localePrefix: "always",
  localeCookie: { name: "NQ_LOCALE", maxAge: 60 * 60 * 24 * 365 },
});

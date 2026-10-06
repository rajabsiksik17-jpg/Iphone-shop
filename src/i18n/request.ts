import { getRequestConfig } from "next-intl/server";
import { hasLocale } from "next-intl";
import { routing } from "./routing";

export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale;
  const locale = hasLocale(routing.locales, requested) ? requested : routing.defaultLocale;
  const messages = (await import(`../../messages/${locale}`)).default;
  return {
    locale,
    messages,
    timeZone: "Asia/Amman",
    formats: {
      dateTime: {
        short: { day: "numeric", month: "short", year: "numeric" },
        long: { day: "numeric", month: "long", year: "numeric", hour: "numeric", minute: "2-digit" },
      },
    },
    // A missing translation shows the key's last segment instead of crashing.
    getMessageFallback: ({ key }) => key.split(".").pop() ?? key,
    onError: (e) => {
      if (process.env.NODE_ENV !== "production") console.warn("[i18n]", e.message);
    },
  };
});

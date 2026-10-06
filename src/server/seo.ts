import "server-only";
import type { Metadata } from "next";
import { getManySettings } from "./settings/service";
import { publicIntegrationConfig } from "./integrations/service";
import { env } from "./env";
import { t } from "@/lib/i18n-text";
import { isLocale, locales, localeMeta, type Locale } from "@/i18n/config";

export function absolute(path: string) {
  return new URL(path, env().APP_URL).toString();
}

/** Canonical + hreflang alternates for a locale-agnostic path ("/product/x"). */
export function alternates(path: string, locale: Locale, canonicalOverride?: string) {
  const clean = path === "/" ? "" : path;
  return {
    canonical: canonicalOverride || absolute(`/${locale}${clean}`),
    languages: {
      ...Object.fromEntries(locales.map((l) => [localeMeta[l].intl, absolute(`/${l}${clean}`)])),
      "x-default": absolute(`/ar${clean}`),
    },
  };
}

export async function siteMetadata(locale: Locale): Promise<Metadata> {
  if (!isLocale(locale)) return {};
  const [s, integrations] = await Promise.all([getManySettings(["seo", "store"]), publicIntegrationConfig()]);
  const name = t(s.store.name, locale);
  const title = t(s.seo.defaultTitle, locale) || name;
  const description = t(s.seo.defaultDescription, locale);
  const googleToken = (integrations.google_search_console as { verificationToken?: string } | undefined)?.verificationToken || s.seo.googleVerification;
  return {
    metadataBase: new URL(env().APP_URL),
    title: { default: title, template: t(s.seo.titleTemplate, locale) || `%s · ${name}` },
    description,
    applicationName: name,
    alternates: alternates("/", locale),
    openGraph: {
      type: "website",
      siteName: name,
      locale: localeMeta[locale].og,
      alternateLocale: locales.filter((l) => l !== locale).map((l) => localeMeta[l].og),
      title,
      description,
      images: s.seo.ogImageUrl ? [{ url: s.seo.ogImageUrl }] : undefined,
    },
    twitter: { card: "summary_large_image", site: s.seo.twitterHandle || undefined, title, description },
    robots: s.seo.allowIndexing ? { index: true, follow: true, googleBot: { index: true, follow: true, "max-image-preview": "large", "max-snippet": -1 } } : { index: false, follow: false },
    verification: {
      google: googleToken || undefined,
      other: s.seo.bingVerification ? { "msvalidate.01": s.seo.bingVerification } : undefined,
    },
    icons: s.store.faviconUrl ? { icon: s.store.faviconUrl } : undefined,
    formatDetection: { telephone: false },
  };
}

/** Per-page metadata with canonical, hreflang, OG and robots handled consistently. */
export async function pageMetadata(opts: {
  locale: Locale;
  path: string;
  title?: string;
  description?: string;
  image?: string | null;
  noindex?: boolean;
  canonical?: string;
  type?: "website" | "article";
  absoluteTitle?: boolean;
}): Promise<Metadata> {
  const seo = (await getManySettings(["seo"])).seo;
  // Every page gets a description: its own, else the store default (Settings → SEO).
  const description = (opts.description?.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim() || t(seo.defaultDescription, opts.locale)).slice(0, 300) || undefined;
  return {
    ...(opts.title ? { title: opts.absoluteTitle ? { absolute: opts.title } : opts.title } : {}),
    description,
    alternates: alternates(opts.path, opts.locale, opts.canonical),
    openGraph: {
      type: opts.type ?? "website",
      url: absolute(`/${opts.locale}${opts.path === "/" ? "" : opts.path}`),
      ...(opts.title ? { title: opts.title } : {}),
      description,
      images: opts.image ? [{ url: absolute(opts.image) }] : seo.ogImageUrl ? [{ url: seo.ogImageUrl }] : undefined,
    },
    twitter: { card: "summary_large_image", ...(opts.title ? { title: opts.title } : {}), description, images: opts.image ? [absolute(opts.image)] : undefined },
    robots: opts.noindex || !seo.allowIndexing ? { index: false, follow: true } : undefined,
  };
}

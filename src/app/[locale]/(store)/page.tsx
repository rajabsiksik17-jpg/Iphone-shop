import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { getPage } from "@/server/cms/queries";
import { Sections } from "@/components/sections/render";
import { pageMetadata } from "@/server/seo";
import { t } from "@/lib/i18n-text";
import type { Locale } from "@/i18n/config";

export const revalidate = 60;

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const locale = (await params).locale as Locale;
  const page = await getPage("home");
  const seo = (page?.seo ?? {}) as Record<string, unknown>;
  return pageMetadata({ locale, path: "/", title: t(seo.title, locale) || undefined, description: t(seo.description, locale) || undefined, absoluteTitle: Boolean(t(seo.title, locale)) });
}

export default async function HomePage({ params }: { params: Promise<{ locale: string }> }) {
  const locale = (await params).locale as Locale;
  setRequestLocale(locale);
  const page = await getPage("home");
  if (!page) return null;
  return <Sections sections={page.sections} locale={locale} />;
}

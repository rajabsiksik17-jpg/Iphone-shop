import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { getPage } from "@/server/cms/queries";
import { Sections } from "@/components/sections/render";
import { Breadcrumbs } from "@/components/store/breadcrumbs";
import { pageMetadata } from "@/server/seo";
import { getCurrentStaff } from "@/server/auth/session";
import { t } from "@/lib/i18n-text";
import type { Locale } from "@/i18n/config";

export const revalidate = 300;

type Props = { params: Promise<{ locale: string; slug: string }>; searchParams: Promise<{ preview?: string }> };

async function load(slug: string, preview: boolean) {
  if (slug === "home") return null;
  // Draft preview is only for signed-in staff.
  const allowPreview = preview && Boolean(await getCurrentStaff());
  return getPage(slug, { preview: allowPreview });
}

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const { slug } = await params;
  const locale = (await params).locale as Locale;
  const page = await load(slug, Boolean((await searchParams).preview));
  if (!page) return {};
  const seo = (page.seo ?? {}) as Record<string, unknown>;
  return pageMetadata({
    locale,
    path: `/${slug}`,
    title: t(seo.title, locale) || t(page.title, locale),
    description: t(seo.description, locale) || t(page.excerpt, locale) || undefined,
    image: typeof seo.ogImage === "string" ? seo.ogImage : null,
    noindex: seo.noindex === true || page.status !== "PUBLISHED",
    canonical: typeof seo.canonical === "string" && seo.canonical ? seo.canonical : undefined,
  });
}

export default async function CmsPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const locale = (await params).locale as Locale;
  setRequestLocale(locale);
  const page = await load(slug, Boolean((await searchParams).preview));
  if (!page) notFound();
  const title = t(page.title, locale);
  const hasOwnHeading = page.sections[0]?.type === "contact" || page.sections[0]?.type === "image_text";

  return (
    <>
      <div className="container-store pt-6">
        <Breadcrumbs items={[{ label: title, href: `/${slug}` }]} />
        {!hasOwnHeading && (
          <header className="mt-6 max-w-3xl">
            <h1 className="text-4xl font-semibold tracking-tight text-balance md:text-5xl">{title}</h1>
            {page.template === "legal" && <p className="mt-3 text-sm text-muted">{page.updatedAt.toLocaleDateString(locale === "ar" ? "ar-JO" : "en-GB", { dateStyle: "long" })}</p>}
          </header>
        )}
      </div>
      <Sections sections={page.sections} locale={locale} />
    </>
  );
}

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { ChevronDown, FileText, MessageCircle } from "lucide-react";
import { getPage, legalPageLinks } from "@/server/cms/queries";
import { Sections } from "@/components/sections/render";
import { Breadcrumbs } from "@/components/store/breadcrumbs";
import { Link } from "@/i18n/navigation";
import { pageMetadata } from "@/server/seo";
import { getCurrentStaff } from "@/server/auth/session";
import { sanitizeRich } from "@/server/sanitize";
import { localeMeta, type Locale } from "@/i18n/config";
import { t } from "@/lib/i18n-text";
import { withHeadingAnchors, type TocEntry } from "@/lib/toc";
import { cn } from "@/lib/utils";

export const revalidate = 300;

type Props = { params: Promise<{ locale: string; slug: string }>; searchParams: Promise<{ preview?: string }> };
type LoadedPage = NonNullable<Awaited<ReturnType<typeof getPage>>>;

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
  if (page.template === "legal") return <LegalDocument page={page} slug={slug} locale={locale} />;

  const title = t(page.title, locale);
  // Sections that render the page's own <h1> (no extra title above them).
  const hasOwnHeading = ["contact", "image_text", "page_hero"].includes(page.sections[0]?.type ?? "");
  return (
    <>
      <div className="container-store pt-6">
        <Breadcrumbs items={[{ label: title, href: `/${slug}` }]} />
        {!hasOwnHeading && (
          <header className="mt-6 max-w-3xl">
            <h1 className="text-4xl font-semibold tracking-tight text-balance md:text-5xl">{title}</h1>
          </header>
        )}
      </div>
      <Sections sections={page.sections} locale={locale} />
    </>
  );
}

/**
 * Policies and other long-form information pages: readable column, a table of
 * contents built from the headings (sticky on desktop, collapsible on mobile),
 * last-updated date and links to the other policies. Content comes from the
 * page's rich-text sections, so everything stays editable in Admin → Pages.
 */
async function LegalDocument({ page, slug, locale }: { page: LoadedPage; slug: string; locale: Locale }) {
  const tr = await getTranslations("legal");
  const title = t(page.title, locale);
  const intro = t(page.excerpt, locale);
  let count = 0;
  const toc: TocEntry[] = [];
  const blocks = page.sections.map((sec) => {
    if (sec.type !== "rich_text") return { id: sec.id, html: null, section: sec };
    const r = withHeadingAnchors(sanitizeRich(t(sec.data.body, locale)), count);
    count += r.toc.length;
    toc.push(...r.toc);
    return { id: sec.id, html: r.html, section: sec };
  });
  const others = (await legalPageLinks(locale)).filter((p) => p.slug !== slug);
  const updated = page.updatedAt.toLocaleDateString(localeMeta[locale].intl, { dateStyle: "long" });

  const TocList = ({ className }: { className?: string }) => (
    <ol className={cn("space-y-0.5 text-sm", className)}>
      {toc.map((e) => (
        <li key={e.id}>
          <a href={`#${e.id}`} className="block rounded-lg px-3 py-1.5 text-muted transition hover:bg-surface hover:text-fg">
            {e.title}
          </a>
        </li>
      ))}
    </ol>
  );

  return (
    <div className="container-store pb-16 pt-6">
      <Breadcrumbs items={[{ label: title, href: `/${slug}` }]} />
      <header className="mt-6 max-w-3xl">
        <h1 className="text-3xl font-semibold tracking-tight text-balance md:text-5xl">{title}</h1>
        {intro && <p className="mt-3 text-lg text-muted text-pretty">{intro}</p>}
        <p className="mt-3 text-sm text-muted">{tr("lastUpdated", { date: updated })}</p>
      </header>

      <div className={cn("mt-8 grid gap-10", toc.length > 2 && "lg:grid-cols-[minmax(0,1fr)_16rem]")}>
        <div className="min-w-0">
          {toc.length > 2 && (
            <details className="group mb-8 rounded-2xl border border-border lg:hidden">
              <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3 text-sm font-semibold [&::-webkit-details-marker]:hidden">
                {tr("onThisPage")}
                <ChevronDown className="size-4 text-muted transition group-open:rotate-180" />
              </summary>
              <TocList className="border-t border-border p-2" />
            </details>
          )}
          <article className="max-w-3xl">
            {blocks.map((b) =>
              b.html !== null ? (
                <div key={b.id} className="prose-store" dangerouslySetInnerHTML={{ __html: b.html }} />
              ) : (
                <div key={b.id} className="-mx-4 sm:-mx-6">
                  <Sections sections={[b.section]} locale={locale} />
                </div>
              ),
            )}
          </article>

          <div className="mt-12 flex max-w-3xl flex-wrap items-center justify-between gap-4 rounded-2xl bg-surface px-5 py-4">
            <p className="flex items-center gap-2.5 text-sm font-medium">
              <MessageCircle className="size-5 text-accent" /> {tr("questions")}
            </p>
            <Link href="/contact" className="inline-flex h-10 items-center rounded-btn bg-primary px-4 text-sm font-medium text-primary-fg transition hover:bg-primary/90">
              {tr("contact")}
            </Link>
          </div>

          {others.length > 0 && (
            <nav aria-label={tr("related")} className="mt-10 max-w-3xl">
              <h2 className="text-sm font-semibold text-muted">{tr("related")}</h2>
              <ul className="mt-3 grid gap-2 sm:grid-cols-2">
                {others.map((p) => (
                  <li key={p.slug}>
                    <Link href={`/${p.slug}`} className="flex items-center gap-3 rounded-xl border border-border px-4 py-3 text-sm font-medium transition hover:border-fg/25 hover:bg-surface">
                      <FileText className="size-4 shrink-0 text-muted" /> {p.title}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          )}
        </div>

        {toc.length > 2 && (
          <aside className="hidden lg:block">
            <nav aria-label={tr("onThisPage")} className="sticky top-28 max-h-[calc(100dvh-8rem)] overflow-y-auto">
              <p className="mb-2 px-3 text-xs font-semibold uppercase tracking-wide text-muted">{tr("onThisPage")}</p>
              <TocList />
            </nav>
          </aside>
        )}
      </div>
    </div>
  );
}

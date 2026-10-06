import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { ArrowUpRight, Flame, MessageCircle, SearchX, TrendingUp } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { listProducts, parseListingParams } from "@/server/catalog/listing";
import { searchSuggestions, categoryTree } from "@/server/catalog/taxonomy";
import { productCollection } from "@/server/catalog/product";
import { baseCurrency } from "@/server/commerce/currency";
import { ListingView } from "@/components/store/listing/listing-view";
import { ProductGrid } from "@/components/store/product-card";
import { Picture } from "@/components/ui/picture";
import { SearchField } from "@/components/store/search-field";
import { pageMetadata } from "@/server/seo";
import type { Locale } from "@/i18n/config";

type Props = { params: Promise<{ locale: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> };

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const locale = (await params).locale as Locale;
  const q = (await searchParams).q;
  const t = await getTranslations({ locale, namespace: "search" });
  // Result pages are useful to people, not to search engines.
  return pageMetadata({ locale, path: "/search", title: typeof q === "string" && q ? t("resultsFor", { q }) : t("title"), noindex: true });
}

export default async function SearchPage({ params, searchParams }: Props) {
  const locale = (await params).locale as Locale;
  setRequestLocale(locale);
  const sp = await searchParams;
  const t = await getTranslations("search");
  const query = parseListingParams(sp, (await baseCurrency()).decimals);
  const q = query.q?.trim() ?? "";

  const [result, related, popular, tree] = await Promise.all([
    q ? listProducts(query, locale) : null,
    q ? searchSuggestions(q, locale) : null,
    searchSuggestions("", locale),
    categoryTree(locale),
  ]);
  const noResults = Boolean(q && result && result.total === 0 && !Object.keys(sp).some((k) => !["q", "sort", "page"].includes(k)));
  const fallback = !q || noResults ? await productCollection("best_sellers", locale, { limit: 8 }) : [];

  return (
    <div className="container-store pt-6 md:pt-10">
      <header className="mx-auto max-w-3xl text-center">
        <h1 className="text-balance text-3xl font-semibold tracking-tight md:text-4xl">{q ? t("resultsFor", { q }) : t("title")}</h1>
        <SearchField defaultValue={q} className="mt-6" />
        {related && (related.categories.length > 0 || related.brands.length > 0) && (
          <nav aria-label={t("categories")} className="mt-5 flex flex-wrap justify-center gap-2">
            {[...related.categories, ...related.brands].map((l) => (
              <Link key={l.href} href={l.href} className="group flex items-center gap-1.5 rounded-full border border-border px-3.5 py-1.5 text-sm font-medium transition hover:border-fg/30 hover:bg-surface">
                {l.label}
                <ArrowUpRight className="flip-rtl size-3.5 text-muted transition group-hover:text-fg" />
              </Link>
            ))}
          </nav>
        )}
      </header>

      {q && result && !noResults && (
        <div className="mt-10">
          <ListingView result={result} basePath="/search" params={sp} locale={locale} query={q} />
        </div>
      )}

      {(noResults || !q) && (
        <div className="mx-auto mt-10 max-w-5xl">
          {noResults && (
            <section className="rounded-3xl bg-surface px-6 py-10 text-center md:px-12">
              <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-bg shadow-sm">
                <SearchX className="size-6 text-muted" />
              </span>
              <h2 className="mt-5 text-xl font-semibold">{t("noResults", { q })}</h2>
              <p className="mx-auto mt-2 max-w-md text-sm text-muted">{t("noResultsHint")}</p>
              <ul className="mx-auto mt-5 max-w-sm space-y-1.5 text-start text-sm text-fg/80">
                <li>• {t("tipSpelling")}</li>
                <li>• {t("tipFewer")}</li>
                <li>• {t("tipGeneric")}</li>
              </ul>
              <Link href="/contact" className="mt-6 inline-flex items-center gap-2 text-sm font-medium text-accent hover:underline">
                <MessageCircle className="size-4" /> {t("askUs")}
              </Link>
            </section>
          )}

          {popular.popular.length > 0 && (
            <section className="mt-10">
              <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted">
                <TrendingUp className="size-4" /> {t("popular")}
              </h2>
              <div className="mt-3 flex flex-wrap gap-2">
                {popular.popular.map((term) => (
                  <Link key={term} href={`/search?q=${encodeURIComponent(term)}`} className="rounded-full bg-surface px-4 py-2 text-sm font-medium transition hover:bg-border/60">
                    {term}
                  </Link>
                ))}
              </div>
            </section>
          )}

          <section className="mt-10">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">{t("browseCategories")}</h2>
            <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
              {tree.map((c) => (
                <Link key={c.id} href={`/category/${c.fullSlug}`} className="group flex flex-col items-center gap-2 rounded-2xl border border-border p-4 text-center transition hover:border-fg/20 hover:shadow-card">
                  <span className="grid size-16 place-items-center overflow-hidden rounded-full bg-surface">{c.image && <Picture image={c.image} sizes="64px" className="size-full object-cover transition duration-500 group-hover:scale-105" />}</span>
                  <span className="text-sm font-medium">{c.name}</span>
                </Link>
              ))}
            </div>
          </section>

          {fallback.length > 0 && (
            <section className="mt-12">
              <h2 className="mb-5 flex items-center gap-2 text-xl font-semibold tracking-tight">
                <Flame className="size-5 text-accent" /> {t("trending")}
              </h2>
              <ProductGrid products={fallback} />
            </section>
          )}
        </div>
      )}
    </div>
  );
}

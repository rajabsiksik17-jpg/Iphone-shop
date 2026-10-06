import { getTranslations } from "next-intl/server";
import { PackageSearch, ChevronLeft, ChevronRight } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { ProductGrid } from "@/components/store/product-card";
import { EmptyState } from "@/components/ui/misc";
import { JsonLd, itemListJsonLd } from "@/components/seo/json-ld";
import { ActiveFilters, FilterPanel, MobileFilters, SortSelect } from "./filters";
import { SearchTracker } from "./search-tracker";
import { cn } from "@/lib/utils";
import { SORT_KEYS, type ListingResult, type SortKey } from "@/types/catalog";
import type { Locale } from "@/i18n/config";

/** Builds pagination hrefs preserving filters; page 1 has no ?page (canonical). */
function pageHref(basePath: string, params: Record<string, string | string[] | undefined>, page: number) {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (typeof v === "string" && k !== "page" && v) p.set(k, v);
  if (page > 1) p.set("page", String(page));
  const qs = p.toString();
  return `${basePath}${qs ? `?${qs}` : ""}`;
}

export async function Pagination({ basePath, params, page, pageCount }: { basePath: string; params: Record<string, string | string[] | undefined>; page: number; pageCount: number }) {
  const t = await getTranslations("common");
  if (pageCount <= 1) return null;
  const pages = Array.from({ length: pageCount }, (_, i) => i + 1).filter((p) => p === 1 || p === pageCount || Math.abs(p - page) <= 1);
  return (
    <nav className="mt-14 flex items-center justify-center gap-1.5" aria-label={t("pageOf", { page, total: pageCount })}>
      {page > 1 && (
        <Link href={pageHref(basePath, params, page - 1)} rel="prev" className="grid size-10 place-items-center rounded-full border border-border hover:bg-surface" aria-label={t("previous")}>
          <ChevronLeft className="flip-rtl size-4" />
        </Link>
      )}
      {pages.map((p, i) => (
        <span key={p} className="flex items-center gap-1.5">
          {i > 0 && p - pages[i - 1] > 1 && <span className="px-1 text-muted">…</span>}
          <Link href={pageHref(basePath, params, p)} aria-current={p === page ? "page" : undefined} className={cn("tabular grid size-10 place-items-center rounded-full text-sm font-medium transition", p === page ? "bg-primary text-primary-fg" : "hover:bg-surface")}>
            {p}
          </Link>
        </span>
      ))}
      {page < pageCount && (
        <Link href={pageHref(basePath, params, page + 1)} rel="next" className="grid size-10 place-items-center rounded-full border border-border hover:bg-surface" aria-label={t("next")}>
          <ChevronRight className="flip-rtl size-4" />
        </Link>
      )}
    </nav>
  );
}

export async function ListingView({
  result,
  basePath,
  params,
  locale,
  hideBrands,
  query,
}: {
  result: ListingResult;
  basePath: string;
  params: Record<string, string | string[] | undefined>;
  locale: Locale;
  hideBrands?: boolean;
  query?: string;
}) {
  const t = await getTranslations("listing");
  const sort = ((typeof params.sort === "string" && params.sort) || (query ? "relevance" : "featured")) as SortKey;
  const sortOptions = SORT_KEYS.filter((k) => k !== "relevance" || query);
  return (
    <div className="grid grid-cols-1 gap-8 lg:grid-cols-[260px_minmax(0,1fr)] lg:gap-10">
      <aside className="hidden lg:block" aria-label={t("filters")}>
        <div className="sticky top-36 max-h-[calc(100dvh-10rem)] overflow-y-auto pe-2 [scrollbar-width:thin]">
          <FilterPanel facets={result.facets} hideBrands={hideBrands} />
        </div>
      </aside>
      <div className="min-w-0">
        {query && <SearchTracker q={query} results={result.total} />}
        <div className="sticky top-16 z-20 -mx-4 mb-5 flex items-center justify-between gap-3 bg-bg/90 px-4 py-3 backdrop-blur-lg md:static md:mx-0 md:bg-transparent md:px-0 md:py-0 md:backdrop-blur-none">
          <p className="text-sm text-muted">{t("productsCount", { count: result.total })}</p>
          <div className="flex items-center gap-2">
            <MobileFilters facets={result.facets} total={result.total} hideBrands={hideBrands} />
            <SortSelect options={sortOptions} current={sort} />
          </div>
        </div>
        <div className="mb-6">
          <ActiveFilters facets={result.facets} />
        </div>
        {result.items.length ? (
          <div data-listing-grid>
            <JsonLd data={itemListJsonLd(result.items, locale)} />
            <ProductGrid products={result.items} priorityCount={4} className="xl:grid-cols-3 2xl:grid-cols-4" />
            <Pagination basePath={basePath} params={params} page={result.page} pageCount={result.pageCount} />
          </div>
        ) : (
          <EmptyState icon={<PackageSearch />} title={query ? (await getTranslations("search"))("noResults", { q: query }) : t("noProducts")} text={query ? (await getTranslations("search"))("noResultsHint") : t("noProductsHint")} />
        )}
      </div>
    </div>
  );
}

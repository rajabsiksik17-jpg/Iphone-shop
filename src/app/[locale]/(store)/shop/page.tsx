import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { listProducts, parseListingParams, hasRefinements } from "@/server/catalog/listing";
import { baseCurrency } from "@/server/commerce/currency";
import { ListingView } from "@/components/store/listing/listing-view";
import { CategoryRail } from "@/components/store/listing/category-rail";
import { categoryTree } from "@/server/catalog/taxonomy";
import { Breadcrumbs } from "@/components/store/breadcrumbs";
import { pageMetadata } from "@/server/seo";
import type { Locale } from "@/i18n/config";
import { activeStoreType } from "@/server/store-type";

type Props = { params: Promise<{ locale: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> };

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const locale = (await params).locale as Locale;
  const sp = await searchParams;
  const t = await getTranslations({ locale, namespace: "listing" });
  const q = typeof sp.q === "string" ? sp.q : "";
  const query = parseListingParams(sp, (await baseCurrency()).decimals);
  const ts = await getTranslations({ locale, namespace: "search" });
  const type = await activeStoreType(locale);
  return pageMetadata({
    locale,
    path: query.page && query.page > 1 ? `/shop?page=${query.page}` : "/shop",
    title: q ? ts("resultsFor", { q }) : type.products ? t("shopTitleOf", { products: type.products }) : t("shopTitle"),
    description: type.description || t("shopTitle"),
    // Search results & filtered views are not indexed (thin/duplicate content).
    noindex: Boolean(q) || hasRefinements(query),
  });
}

export default async function ShopPage({ params, searchParams }: Props) {
  const locale = (await params).locale as Locale;
  setRequestLocale(locale);
  const sp = await searchParams;
  const t = await getTranslations();
  // Searches have their own page; old /shop?q= links keep working.
  if (typeof sp.q === "string" && sp.q.trim()) redirect({ href: `/search?${new URLSearchParams(sp as Record<string, string>).toString()}`, locale });
  const query = parseListingParams(sp, (await baseCurrency()).decimals);
  const [result, tree, type] = await Promise.all([listProducts(query, locale), categoryTree(locale), activeStoreType(locale)]);
  // Top-level categories as stories (empty ones are skipped; counts include subcategories).
  const stories = tree.filter((c) => c.productCount > 0).map((c) => ({ id: c.id, fullSlug: c.fullSlug, name: c.name, icon: c.icon, image: c.image, count: c.productCount, current: false }));
  return (
    <div className="container-store pb-10 pt-6">
      <Breadcrumbs items={[{ label: t("common.shop"), href: "/shop" }]} />
      <header className="mb-8 mt-6">
        <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">{query.q ? t("search.resultsFor", { q: query.q }) : type.products ? t("listing.shopTitleOf", { products: type.products }) : t("listing.shopTitle")}</h1>
        {!query.q && type.description && <p className="mt-2 max-w-2xl text-muted">{type.description}</p>}
        <CategoryRail items={stories} parent={null} />
      </header>
      <ListingView result={result} basePath="/shop" params={sp} locale={locale} query={query.q} />
    </div>
  );
}

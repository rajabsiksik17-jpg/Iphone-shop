import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { listProducts, parseListingParams, hasRefinements } from "@/server/catalog/listing";
import { baseCurrency } from "@/server/commerce/currency";
import { ListingView } from "@/components/store/listing/listing-view";
import { Breadcrumbs } from "@/components/store/breadcrumbs";
import { pageMetadata } from "@/server/seo";
import type { Locale } from "@/i18n/config";

type Props = { params: Promise<{ locale: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> };

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const locale = (await params).locale as Locale;
  const sp = await searchParams;
  const t = await getTranslations({ locale, namespace: "listing" });
  const q = typeof sp.q === "string" ? sp.q : "";
  const query = parseListingParams(sp, (await baseCurrency()).decimals);
  const ts = await getTranslations({ locale, namespace: "search" });
  return pageMetadata({
    locale,
    path: query.page && query.page > 1 ? `/shop?page=${query.page}` : "/shop",
    title: q ? ts("resultsFor", { q }) : t("shopTitle"),
    description: t("shopDescription"),
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
  const result = await listProducts(query, locale);
  return (
    <div className="container-store pb-10 pt-6">
      <Breadcrumbs items={[{ label: t("common.shop"), href: "/shop" }]} />
      <header className="mb-8 mt-6">
        <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">{query.q ? t("search.resultsFor", { q: query.q }) : t("listing.shopTitle")}</h1>
        {!query.q && <p className="mt-2 max-w-2xl text-muted">{t("listing.shopDescription")}</p>}
      </header>
      <ListingView result={result} basePath="/shop" params={sp} locale={locale} query={query.q} />
    </div>
  );
}

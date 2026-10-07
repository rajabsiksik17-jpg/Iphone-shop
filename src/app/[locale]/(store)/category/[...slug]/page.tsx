import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { getCategoryByFullSlug, categoryRail } from "@/server/catalog/taxonomy";
import { CategoryRail } from "@/components/store/listing/category-rail";
import { listProducts, parseListingParams, hasRefinements } from "@/server/catalog/listing";
import { baseCurrency } from "@/server/commerce/currency";
import { ListingView } from "@/components/store/listing/listing-view";
import { ExploreCategories } from "@/components/store/listing/explore-categories";
import { Breadcrumbs } from "@/components/store/breadcrumbs";
import { pageMetadata } from "@/server/seo";
import type { Locale } from "@/i18n/config";

type Props = { params: Promise<{ locale: string; slug: string[] }>; searchParams: Promise<Record<string, string | string[] | undefined>> };

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const { slug } = await params;
  const locale = (await params).locale as Locale;
  const category = await getCategoryByFullSlug(slug.join("/"), locale);
  if (!category) return {};
  const sp = await searchParams;
  const query = parseListingParams(sp, (await baseCurrency()).decimals);
  const path = `/category/${category.fullSlug}${query.page && query.page > 1 ? `?page=${query.page}` : ""}`;
  return pageMetadata({
    locale,
    path,
    title: category.seo.title || category.name,
    description: category.seo.description || category.description || undefined,
    image: category.seo.ogImage ?? category.banner?.url ?? category.image?.url,
    noindex: category.seo.noindex || hasRefinements(query),
    canonical: category.seo.canonical,
  });
}

export default async function CategoryPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const locale = (await params).locale as Locale;
  setRequestLocale(locale);
  const category = await getCategoryByFullSlug(slug.join("/"), locale);
  if (!category) notFound();
  const sp = await searchParams;
  const query = { ...parseListingParams(sp, (await baseCurrency()).decimals), categoryPath: category.path, categoryId: category.id };
  const [result, rail] = await Promise.all([listProducts(query, locale), categoryRail(category.id, locale)]);

  return (
    <div className="container-store pb-10 pt-6">
      <Breadcrumbs items={category.breadcrumbs} inShop />
      <header className="mb-8 mt-6">
        <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">{category.name}</h1>
        {category.description && <p className="mt-2 max-w-2xl text-muted">{category.description}</p>}
        <CategoryRail {...rail} />
      </header>
      <ListingView result={result} basePath={`/category/${category.fullSlug}`} params={sp} locale={locale} explore={<ExploreCategories locale={locale} currentId={category.id} />} />
    </div>
  );
}

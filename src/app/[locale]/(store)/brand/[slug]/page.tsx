import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { getBrandBySlug } from "@/server/catalog/taxonomy";
import { listProducts, parseListingParams, hasRefinements } from "@/server/catalog/listing";
import { baseCurrency } from "@/server/commerce/currency";
import { ListingView } from "@/components/store/listing/listing-view";
import { Breadcrumbs } from "@/components/store/breadcrumbs";
import { Picture } from "@/components/ui/picture";
import { getTranslations } from "next-intl/server";
import { pageMetadata } from "@/server/seo";
import type { Locale } from "@/i18n/config";

type Props = { params: Promise<{ locale: string; slug: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> };

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const { slug } = await params;
  const locale = (await params).locale as Locale;
  const brand = await getBrandBySlug(slug, locale);
  if (!brand) return {};
  const query = parseListingParams(await searchParams, (await baseCurrency()).decimals);
  return pageMetadata({
    locale,
    path: `/brand/${brand.slug}${query.page && query.page > 1 ? `?page=${query.page}` : ""}`,
    title: brand.seo.title || brand.name,
    description: brand.seo.description || brand.description || undefined,
    image: brand.seo.ogImage ?? brand.banner?.url ?? brand.logo?.url,
    noindex: brand.seo.noindex || hasRefinements(query),
    canonical: brand.seo.canonical,
  });
}

export default async function BrandPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const locale = (await params).locale as Locale;
  setRequestLocale(locale);
  const brand = await getBrandBySlug(slug, locale);
  if (!brand) notFound();
  const sp = await searchParams;
  const t = await getTranslations("common");
  const result = await listProducts({ ...parseListingParams(sp, (await baseCurrency()).decimals), brandId: brand.id, brandSlugs: [] }, locale);

  return (
    <div className="pb-10">
      <section className="relative overflow-hidden bg-[#0b0f17] text-white">
        {brand.banner && <Picture image={brand.banner} sizes="100vw" priority className="absolute inset-0 opacity-60" />}
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
        <div className="container-store relative flex min-h-[260px] items-end gap-5 py-10 md:min-h-[320px]">
          {brand.logo && <Picture image={brand.logo} sizes="96px" fit="contain" className="size-20 shrink-0 rounded-2xl bg-white p-2 shadow-xl md:size-24" />}
          <div>
            <h1 className="text-3xl font-semibold tracking-tight md:text-5xl">{brand.name}</h1>
            {brand.description && <p className="mt-2 max-w-2xl text-white/75">{brand.description}</p>}
          </div>
        </div>
      </section>
      <div className="container-store pt-6">
        <Breadcrumbs items={[{ label: t("brands"), href: "/brands" }, { label: brand.name, href: `/brand/${brand.slug}` }]} className="mb-8" />
        <ListingView result={result} basePath={`/brand/${brand.slug}`} params={sp} locale={locale} hideBrands />
      </div>
    </div>
  );
}

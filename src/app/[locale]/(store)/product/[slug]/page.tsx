import { KeySpecs, SpecsTable } from "@/components/store/product/specs";
import { trustIcons } from "@/components/store/trust-icons";
import { customSvgsFor } from "@/server/icons";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { BadgeCheck, MessageSquare } from "lucide-react";
import { db } from "@/server/db";
import { getProductBySlug, relatedProducts, frequentlyBoughtTogether } from "@/server/catalog/product";
import { getCurrentStaff } from "@/server/auth/session";
import { getManySettings } from "@/server/settings/service";
import { baseCurrency, formatBase } from "@/server/commerce/currency";
import { freeShippingThreshold } from "@/server/commerce/shipping";
import { sanitizeRich } from "@/server/sanitize";
import { pageMetadata } from "@/server/seo";
import { Breadcrumbs } from "@/components/store/breadcrumbs";
import { ProductPurchase } from "@/components/store/product/purchase-panel";
import { BoughtTogether, RecentlyViewed } from "@/components/store/product/extras";
import { WriteReview, ReviewActions } from "@/components/store/product/review-form";
import { ProductRail } from "@/components/sections/product-rail";
import { SectionHeading, EmptyState } from "@/components/ui/misc";
import { Stars } from "@/components/ui/rating";
import { LiteVideo } from "@/components/sections/lite-video";
import { JsonLd, productJsonLd } from "@/components/seo/json-ld";
import { t as tr } from "@/lib/i18n-text";
import type { Locale } from "@/i18n/config";

type Props = { params: Promise<{ locale: string; slug: string }>; searchParams: Promise<{ preview?: string }> };

async function load(slug: string, locale: Locale, preview?: string) {
  const allowPreview = Boolean(preview) && Boolean(await getCurrentStaff());
  return getProductBySlug(slug, locale, { preview: allowPreview });
}

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const { slug } = await params;
  const locale = (await params).locale as Locale;
  const product = await load(slug, locale, (await searchParams).preview);
  if (!product) return {};
  const { seo } = await getManySettings(["seo"]);
  const template = tr(seo.productTitleTemplate, locale) || "%name%";
  const title = product.seo.title || template.replace("%name%", product.name).replace("%brand%", product.brandInfo?.name ?? "").replace(/\s+[—-]\s*$/, "");
  return pageMetadata({
    locale,
    path: `/product/${product.slug}`,
    title,
    description: product.seo.description || product.shortDescription || product.description,
    image: product.seo.ogImage ?? product.images[0]?.url,
    noindex: product.seo.noindex,
    canonical: product.seo.canonical,
  });
}

export default async function ProductPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const locale = (await params).locale as Locale;
  setRequestLocale(locale);
  const product = await load(slug, locale, (await searchParams).preview);
  if (!product) notFound();
  const t = await getTranslations();

  const [related, fbt, reviews, distribution, base, threshold, settings] = await Promise.all([
    relatedProducts(product.id, product.categoryIds, product.brand?.slug ?? null, locale),
    frequentlyBoughtTogether(product.id, locale),
    db.review.findMany({ where: { productId: product.id, status: "APPROVED" }, orderBy: [{ helpfulCount: "desc" }, { createdAt: "desc" }], take: 10 }),
    db.review.groupBy({ by: ["rating"], where: { productId: product.id, status: "APPROVED" }, _count: { _all: true } }),
    baseCurrency(),
    freeShippingThreshold("JO"),
    getManySettings(["store"]),
  ]);
  const shippingNote = threshold ? t("product.freeDelivery", { amount: (await formatBase(threshold, locale)).replace(/\.000(?=\s|$)/, "") }) : null;
  const description = sanitizeRich(product.description);
  const totalReviews = distribution.reduce((s, d) => s + d._count._all, 0);
  const svgs = await customSvgsFor([...product.highlights.map((h) => h.icon), ...product.specs.flatMap((g) => [g.icon, ...g.rows.map((r) => r.icon)])]);

  return (
    <>
      <JsonLd
        data={productJsonLd(product, {
          locale,
          currency: base.code,
          decimals: base.decimals,
          storeName: tr(settings.store.name, locale),
          reviews: reviews.map((r) => ({ author: r.authorName, rating: r.rating, body: r.body, date: r.createdAt.toISOString().slice(0, 10) })),
        })}
      />
      <div className="container-store pt-6">
        <Breadcrumbs items={[...product.breadcrumbs, { label: product.name, href: `/product/${product.slug}` }]} className="mb-6" inShop />
        <ProductPurchase product={product} shippingNote={shippingNote} icons={await trustIcons()} />
      </div>

      {product.highlights.length > 0 && (
        <section aria-label={t("product.keySpecs")} className="container-store mt-12">
          <KeySpecs items={product.highlights} svgs={svgs} />
        </section>
      )}

      {fbt.length > 0 && (
        <div className="container-store mt-16">
          <BoughtTogether main={product} items={fbt} />
        </div>
      )}

      <div className="container-store mt-16 grid grid-cols-1 gap-12 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <div className="min-w-0 space-y-12">
          {description && (
            <section aria-labelledby="desc">
              <h2 id="desc" className="mb-4 text-2xl font-semibold tracking-tight">
                {t("product.description")}
              </h2>
              <div className="prose-store max-w-none" dangerouslySetInnerHTML={{ __html: description }} />
            </section>
          )}
          {product.videoUrl && <LiteVideo url={product.videoUrl} title={product.name} />}
        </div>
        {product.specs.length > 0 && (
          <section aria-labelledby="specs" className="lg:row-span-2">
            <h2 id="specs" className="mb-4 text-2xl font-semibold tracking-tight">
              {t("product.specifications")}
            </h2>
            <SpecsTable groups={product.specs} svgs={svgs} />
          </section>
        )}
      </div>

      <section id="reviews" className="container-store mt-16 scroll-mt-32">
        <div className="grid grid-cols-1 gap-10 lg:grid-cols-[320px_minmax(0,1fr)]">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight">{t("reviews.title")}</h2>
            {totalReviews > 0 && (
              <>
                <div className="mt-4 flex items-end gap-3">
                  <span className="text-5xl font-semibold tracking-tight">{product.rating.toFixed(1)}</span>
                  <div className="pb-1.5">
                    <Stars value={product.rating} size={18} />
                    <p className="mt-1 text-sm text-muted">{t("reviews.basedOn", { count: totalReviews })}</p>
                  </div>
                </div>
                <div className="mt-5 space-y-2">
                  {[5, 4, 3, 2, 1].map((star) => {
                    const n = distribution.find((d) => d.rating === star)?._count._all ?? 0;
                    return (
                      <div key={star} className="flex items-center gap-3 text-sm">
                        <span className="tabular w-3 text-muted">{star}</span>
                        <div className="h-2 flex-1 overflow-hidden rounded-full bg-surface">
                          <div className="h-full rounded-full bg-amber-400" style={{ width: `${totalReviews ? (n / totalReviews) * 100 : 0}%` }} />
                        </div>
                        <span className="tabular w-6 text-end text-xs text-muted">{n}</span>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
            <div className="mt-6">
              <WriteReview productId={product.id} />
            </div>
          </div>
          <div>
            {reviews.length ? (
              <ul className="divide-y divide-border">
                {reviews.map((r) => (
                  <li key={r.id} className="py-6 first:pt-0">
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                      <Stars value={r.rating} />
                      {r.title && <span className="font-semibold">{r.title}</span>}
                    </div>
                    <p className="mt-2 text-[15px] leading-relaxed text-fg/80">{r.body}</p>
                    <div className="mt-3 flex flex-wrap items-center gap-x-3 text-xs text-muted">
                      <span className="font-medium text-fg/80">{r.authorName}</span>
                      <span>{r.createdAt.toLocaleDateString(locale === "ar" ? "ar-SA-u-ca-gregory-nu-latn" : "en-GB", { dateStyle: "medium" })}</span>
                      {r.isVerifiedPurchase && (
                        <span className="flex items-center gap-1 text-success">
                          <BadgeCheck className="size-3.5" /> {t("reviews.verified")}
                        </span>
                      )}
                    </div>
                    {r.adminReply && (
                      <div className="mt-3 rounded-2xl bg-surface p-4 text-sm">
                        <p className="mb-1 text-xs font-semibold text-muted">{t("reviews.storeReply")}</p>
                        {r.adminReply}
                      </div>
                    )}
                    <ReviewActions reviewId={r.id} helpful={r.helpfulCount} />
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState icon={<MessageSquare />} title={t("reviews.none")} text={t("reviews.noneHint")} className="rounded-card border border-dashed border-border py-12" />
            )}
          </div>
        </div>
      </section>

      {related.length > 0 && (
        <section className="container-store mt-20">
          <SectionHeading title={t("product.relatedProducts")} />
          <ProductRail products={related} />
        </section>
      )}
      <RecentlyViewed excludeId={product.id} />
    </>
  );
}

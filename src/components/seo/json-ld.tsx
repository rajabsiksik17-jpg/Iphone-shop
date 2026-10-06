import { absoluteUrl } from "@/lib/utils";
import { t } from "@/lib/i18n-text";
import type { StorefrontShell } from "@/server/storefront";
import type { ProductDetailDTO } from "@/server/catalog/product";
import type { Locale } from "@/i18n/config";

/**
 * Structured data. Output is JSON-stringified with `<` escaped so no content
 * can break out of the script tag.
 */
export function JsonLd({ data }: { data: object | object[] }) {
  const json = JSON.stringify(Array.isArray(data) ? data : data).replace(/</g, "\\u003c");
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: json }} />;
}

const base = () => process.env.APP_URL ?? "http://localhost:3000";

export function organizationJsonLd(shell: StorefrontShell, locale: Locale) {
  const s = shell.settings;
  return {
    "@context": "https://schema.org",
    "@type": "OnlineStore",
    "@id": `${base()}/#organization`,
    name: t(s.store.name, locale),
    url: absoluteUrl(`/${locale}`, base()),
    logo: s.store.logoUrl ? absoluteUrl(s.store.logoUrl, base()) : undefined,
    email: s.contact.email || s.store.email || undefined,
    telephone: s.contact.phone || s.store.phone || undefined,
    address: t(s.contact.address, locale) ? { "@type": "PostalAddress", streetAddress: t(s.contact.address, locale), addressCountry: s.store.defaultCountry } : undefined,
    sameAs: shell.social.map((x) => x.url).filter((u) => /^https?:\/\//.test(u)),
  };
}

export function websiteJsonLd(shell: StorefrontShell, locale: Locale) {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": `${base()}/#website`,
    name: t(shell.settings.store.name, locale),
    url: absoluteUrl(`/${locale}`, base()),
    inLanguage: locale,
    publisher: { "@id": `${base()}/#organization` },
    potentialAction: {
      "@type": "SearchAction",
      target: { "@type": "EntryPoint", urlTemplate: absoluteUrl(`/${locale}/search?q={search_term_string}`, base()) },
      "query-input": "required name=search_term_string",
    },
  };
}

export function breadcrumbJsonLd(items: { label: string; href: string }[], locale: Locale) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((it, i) => ({ "@type": "ListItem", position: i + 1, name: it.label, item: absoluteUrl(`/${locale}${it.href === "/" ? "" : it.href}`, base()) })),
  };
}

/**
 * Product + Offer(s). AggregateRating and Review are included only when real,
 * approved reviews exist — never synthesised.
 */
export function productJsonLd(p: ProductDetailDTO, opts: { locale: Locale; currency: string; decimals: number; reviews: { author: string; rating: number; body: string; date: string }[]; storeName: string }) {
  const major = (minor: number) => (minor / 10 ** opts.decimals).toFixed(opts.decimals);
  const url = absoluteUrl(`/${opts.locale}/product/${p.slug}`, base());
  const availability = (status: string) =>
    status === "OUT_OF_STOCK" ? "https://schema.org/OutOfStock" : status === "BACKORDER" ? "https://schema.org/BackOrder" : status === "PREORDER" ? "https://schema.org/PreOrder" : status === "LOW_STOCK" ? "https://schema.org/LimitedAvailability" : "https://schema.org/InStock";
  const condition = { NEW: "NewCondition", REFURBISHED: "RefurbishedCondition", OPEN_BOX: "UsedCondition", USED: "UsedCondition" }[p.condition] ?? "NewCondition";
  const offerBase = { "@type": "Offer", url, priceCurrency: opts.currency, itemCondition: `https://schema.org/${condition}`, seller: { "@type": "Organization", name: opts.storeName } };
  const offers =
    p.variants.length > 1
      ? {
          "@type": "AggregateOffer",
          priceCurrency: opts.currency,
          lowPrice: major(Math.min(...p.variants.map((v) => v.price.current))),
          highPrice: major(Math.max(...p.variants.map((v) => v.price.current))),
          offerCount: p.variants.length,
          offers: p.variants.slice(0, 50).map((v) => ({ ...offerBase, sku: v.sku ?? undefined, price: major(v.price.current), availability: availability(v.stockStatus), ...(v.price.saleEndsAt ? { priceValidUntil: v.price.saleEndsAt.slice(0, 10) } : {}) })),
        }
      : { ...offerBase, price: major(p.price.current), availability: availability(p.stockStatus), ...(p.price.saleEndsAt ? { priceValidUntil: p.price.saleEndsAt.slice(0, 10) } : {}) };
  return {
    "@context": "https://schema.org",
    "@type": "Product",
    "@id": `${url}#product`,
    name: p.name,
    description: (p.shortDescription || p.description).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 500),
    sku: p.sku ?? undefined,
    gtin: p.barcode ?? undefined,
    mpn: p.modelNumber ?? undefined,
    image: p.images.slice(0, 6).map((i) => absoluteUrl(i.url, base())),
    brand: p.brandInfo ? { "@type": "Brand", name: p.brandInfo.name } : undefined,
    category: p.primaryCategory?.name,
    url,
    offers,
    ...(p.ratingCount > 0
      ? {
          aggregateRating: { "@type": "AggregateRating", ratingValue: p.rating.toFixed(1), reviewCount: p.ratingCount, bestRating: 5, worstRating: 1 },
          review: opts.reviews.slice(0, 5).map((r) => ({ "@type": "Review", author: { "@type": "Person", name: r.author }, reviewRating: { "@type": "Rating", ratingValue: r.rating, bestRating: 5 }, reviewBody: r.body, datePublished: r.date })),
        }
      : {}),
  };
}

export function faqJsonLd(faqs: { question: string; answer: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((f) => ({ "@type": "Question", name: f.question, acceptedAnswer: { "@type": "Answer", text: f.answer } })),
  };
}

export function itemListJsonLd(items: { slug: string }[], locale: Locale) {
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    itemListElement: items.map((it, i) => ({ "@type": "ListItem", position: i + 1, url: absoluteUrl(`/${locale}/product/${it.slug}`, base()) })),
  };
}

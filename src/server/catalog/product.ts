import "server-only";
import { cache } from "react";
import { db, Prisma } from "../db";
import { getSettings } from "../settings/service";
import { t } from "@/lib/i18n-text";
import { resolvePrice, variantPriceSource, stockState } from "@/lib/pricing";
import { cardInclude, imageDTO, priceDTO, badgesFor, toCard } from "./dto";
import { visibleWhere } from "./listing";
import type { ImageDTO, PriceDTO, ProductCardDTO } from "@/types/catalog";

export type VariantDTO = {
  id: string;
  sku: string | null;
  options: Record<string, string>; // attributeKey -> valueSlug
  price: PriceDTO;
  stock: number;
  stockStatus: string;
  imageIndex: number | null;
};

export type OptionGroupDTO = {
  key: string;
  label: string;
  type: string;
  values: { slug: string; label: string; hex: string | null }[];
};

export type SpecRow = { label: string; value: string; icon: string | null };
export type SpecGroupDTO = { key: string; label: string; icon: string | null; rows: SpecRow[] };

export type ProductDetailDTO = ProductCardDTO & {
  sku: string | null;
  barcode: string | null;
  modelNumber: string | null;
  shortDescription: string;
  description: string;
  images: (ImageDTO & { valueSlug: string | null })[];
  videoUrl: string | null;
  options: OptionGroupDTO[];
  variants: VariantDTO[];
  specs: SpecGroupDTO[];
  /** Attributes marked "key spec" in the admin, in display order. */
  highlights: SpecRow[];
  stock: number;
  trackInventory: boolean;
  minQty: number;
  maxQty: number | null;
  warranty: string;
  condition: string;
  weightGrams: number | null;
  breadcrumbs: { label: string; href: string }[];
  categoryIds: string[];
  primaryCategory: { id: string; fullSlug: string; name: string } | null;
  brandInfo: { name: string; slug: string; logo: ImageDTO | null } | null;
  seo: { title?: string; description?: string; canonical?: string; ogImage?: string; noindex?: boolean };
  publishedAt: string | null;
  updatedAt: string;
};

const detailInclude = {
  ...cardInclude,
  brand: { select: { name: true, slug: true, logo: true } },
  images: { orderBy: { position: "asc" }, include: { media: true, value: { select: { slug: true } } } },
  variants: {
    where: { isActive: true },
    orderBy: { position: "asc" },
    include: { options: { include: { attribute: { select: { key: true } }, value: { select: { slug: true } } } }, image: true },
  },
  attributes: {
    orderBy: { position: "asc" },
    include: {
      attribute: { include: { group: true } },
      values: { include: { value: true } },
    },
  },
  categories: { include: { category: true } },
} satisfies Prisma.ProductInclude;

export const getProductBySlug = cache(async (slug: string, locale: string, opts: { preview?: boolean } = {}) => {
  const p = await db.product.findFirst({
    where: { slug, ...(opts.preview ? {} : { AND: [visibleWhere(new Date(), "search")] }) },
    include: detailInclude,
  });
  if (!p) {
    // Hidden-but-linked products (visibility HIDDEN) still 404; products only in search are allowed above.
    return null;
  }
  const store = await getSettings("store");
  const name = t(p.name, locale);
  const card = toCard(p as unknown as Parameters<typeof toCard>[0], locale, store);

  // Images (keep order). Variant-specific images are appended if not already in the gallery.
  const images = p.images.map((i) => ({ ...imageDTO(i.media, locale, name)!, valueSlug: i.value?.slug ?? null }));
  const imageIndexByMedia = new Map(p.images.map((i, idx) => [i.mediaId, idx]));
  for (const v of p.variants) {
    if (v.image && !imageIndexByMedia.has(v.image.id)) {
      imageIndexByMedia.set(v.image.id, images.length);
      images.push({ ...imageDTO(v.image, locale, name)!, valueSlug: null });
    }
  }

  const threshold = p.lowStockThreshold ?? store.lowStockThreshold;
  const variants: VariantDTO[] = p.variants.map((v) => {
    const r = resolvePrice(variantPriceSource(p, v));
    return {
      id: v.id,
      sku: v.sku,
      options: Object.fromEntries(v.options.map((o) => [o.attribute.key, o.value.slug])),
      price: { regular: r.regular, current: r.current, onSale: r.onSale, percent: r.percent, savings: r.savings, min: r.current, max: r.current, saleEndsAt: r.saleEndsAt?.toISOString() ?? null },
      stock: p.trackInventory ? v.stock : 999,
      stockStatus: stockState({ track: p.trackInventory, stock: v.stock, lowThreshold: threshold, allowBackorder: p.allowBackorder }),
      imageIndex: v.imageId ? (imageIndexByMedia.get(v.imageId) ?? null) : null,
    };
  });

  // Option groups only include values that exist on at least one active variant.
  const usedValues = new Map<string, Set<string>>();
  for (const v of variants) for (const [k, s] of Object.entries(v.options)) (usedValues.get(k) ?? usedValues.set(k, new Set()).get(k)!).add(s);
  const options: OptionGroupDTO[] = p.attributes
    .filter((a) => a.usedForVariations && usedValues.has(a.attribute.key))
    .map((a) => ({
      key: a.attribute.key,
      label: t(a.attribute.name, locale),
      type: a.attribute.type,
      values: a.values
        .map((pv) => pv.value)
        .filter((v) => usedValues.get(a.attribute.key)!.has(v.slug))
        .sort((x, y) => x.position - y.position)
        .map((v) => ({ slug: v.slug, label: t(v.label, locale), hex: v.colorHex })),
    }));

  // Specifications grouped by attribute group (Display, Performance, Camera…).
  const groups = new Map<string, SpecGroupDTO & { position: number }>();
  const highlights: (SpecRow & { position: number })[] = [];
  for (const a of p.attributes) {
    if (!a.attribute.isVisible) continue;
    const value =
      a.values.length > 0
        ? a.values.map((v) => t(v.value.label, locale)).join(", ")
        : a.textValue
          ? t(a.textValue, locale)
          : a.numberValue != null
            ? `${a.numberValue}${a.attribute.unit ? ` ${a.attribute.unit}` : ""}`
            : a.boolValue != null
              ? a.boolValue
                ? locale === "ar" ? "نعم" : "Yes"
                : locale === "ar" ? "لا" : "No"
              : "";
    if (!value) continue;
    const gk = a.attribute.group?.key ?? "general";
    const g = groups.get(gk) ?? {
      key: gk,
      label: a.attribute.group ? t(a.attribute.group.name, locale) : locale === "ar" ? "عام" : "General",
      icon: a.attribute.group?.icon ?? null,
      position: a.attribute.group?.position ?? 999,
      rows: [],
    };
    const row = { label: t(a.attribute.name, locale), value, icon: a.attribute.icon };
    g.rows.push(row);
    if (a.attribute.isHighlighted && !a.attribute.isVariantOption) highlights.push({ ...row, position: (a.attribute.group?.position ?? 99) * 1000 + a.attribute.position });
    groups.set(gk, g);
  }
  const specs = [...groups.values()].sort((a, b) => a.position - b.position).map(({ position: _p, ...g }) => g);

  const primary = p.categories.find((c) => c.isPrimary)?.category ?? p.categories[0]?.category ?? null;
  const breadcrumbs: { label: string; href: string }[] = [];
  if (primary) {
    const ancestorIds = primary.path.split("/").filter(Boolean);
    const ancestors = await db.category.findMany({ where: { id: { in: ancestorIds } } });
    for (const id of ancestorIds) {
      const c = ancestors.find((a) => a.id === id);
      if (c) breadcrumbs.push({ label: t(c.name, locale), href: `/category/${c.fullSlug}` });
    }
  }

  const seo = (p.seo ?? {}) as Record<string, Record<string, string> | string | boolean>;
  const detail: ProductDetailDTO = {
    ...card,
    sku: p.sku,
    barcode: p.barcode,
    modelNumber: p.modelNumber,
    shortDescription: t(p.shortDescription, locale),
    description: t(p.description, locale),
    images,
    videoUrl: p.videoUrl,
    options,
    variants,
    specs,
    highlights: highlights.sort((a, b) => a.position - b.position).slice(0, 6).map(({ position: _p, ...h }) => h),
    stock: p.trackInventory ? p.stock : 999,
    trackInventory: p.trackInventory,
    minQty: p.minQty,
    maxQty: p.maxQty,
    warranty: t(p.warranty, locale),
    condition: p.condition,
    weightGrams: p.weightGrams,
    breadcrumbs,
    categoryIds: p.categories.map((c) => c.categoryId),
    primaryCategory: primary ? { id: primary.id, fullSlug: primary.fullSlug, name: t(primary.name, locale) } : null,
    brandInfo: p.brand ? { name: t(p.brand.name, locale), slug: p.brand.slug, logo: imageDTO(p.brand.logo, locale, t(p.brand.name, locale)) } : null,
    seo: {
      title: t(seo.title, locale) || undefined,
      description: t(seo.description, locale) || undefined,
      canonical: typeof seo.canonical === "string" ? seo.canonical : undefined,
      ogImage: typeof seo.ogImage === "string" ? seo.ogImage : undefined,
      noindex: seo.noindex === true,
    },
    publishedAt: p.publishedAt?.toISOString() ?? null,
    updatedAt: p.updatedAt.toISOString(),
  };
  return detail;
});

async function cards(where: Prisma.ProductWhereInput, locale: string, take: number, orderBy: Prisma.ProductOrderByWithRelationInput[] = [{ salesCount: "desc" }]) {
  const store = await getSettings("store");
  const rows = await db.product.findMany({ where: { AND: [visibleWhere(), where] }, include: cardInclude, orderBy, take });
  return rows.map((r) => toCard(r, locale, store));
}

/** Manual relations first, then same-category/brand fallbacks — no spammy filler. */
export async function relatedProducts(productId: string, categoryIds: string[], brandSlug: string | null, locale: string, take = 8) {
  const manual = await db.productRelation.findMany({ where: { productId, type: { in: ["RELATED", "UPSELL"] } }, orderBy: { position: "asc" }, select: { relatedId: true } });
  const manualCards = manual.length ? await cards({ id: { in: manual.map((m) => m.relatedId) } }, locale, take) : [];
  if (manualCards.length >= take) return manualCards;
  const exclude = [productId, ...manualCards.map((c) => c.id)];
  const fill = await cards(
    { id: { notIn: exclude }, OR: [{ categories: { some: { categoryId: { in: categoryIds } } } }, ...(brandSlug ? [{ brand: { slug: brandSlug } }] : [])] },
    locale,
    take - manualCards.length,
  );
  return [...manualCards, ...fill];
}

/**
 * "Frequently bought together": explicit cross-sells, else products that
 * actually co-occur in past orders (real purchase data only).
 */
export async function frequentlyBoughtTogether(productId: string, locale: string, take = 3) {
  const manual = await db.productRelation.findMany({ where: { productId, type: "CROSS_SELL" }, orderBy: { position: "asc" }, select: { relatedId: true } });
  if (manual.length) return cards({ id: { in: manual.map((m) => m.relatedId) } }, locale, take);
  const rows = await db.$queryRaw<{ productId: string; n: bigint }[]>`
    SELECT b."productId", COUNT(*) AS n
    FROM "OrderItem" a JOIN "OrderItem" b ON a."orderId" = b."orderId" AND b."productId" <> a."productId"
    WHERE a."productId" = ${productId} AND b."productId" IS NOT NULL
    GROUP BY b."productId" HAVING COUNT(*) >= 2
    ORDER BY n DESC LIMIT ${take}`;
  if (!rows.length) return [];
  const list = await cards({ id: { in: rows.map((r) => r.productId) } }, locale, take);
  return rows.map((r) => list.find((c) => c.id === r.productId)).filter((c): c is ProductCardDTO => Boolean(c));
}

export type CollectionSource = "featured" | "new" | "best_sellers" | "on_sale" | "top_rated" | "category" | "brand" | "manual";

/** Product collections used by homepage/page-builder sections. */
export async function productCollection(source: CollectionSource, locale: string, opts: { limit?: number; categoryId?: string; brandId?: string; ids?: string[] } = {}) {
  const take = Math.min(opts.limit ?? 8, 24);
  const store = await getSettings("store");
  const recent = new Date(Date.now() - store.newProductDays * 86_400_000);
  switch (source) {
    case "featured":
      return cards({ isFeatured: true }, locale, take, [{ salesCount: "desc" }]);
    case "new":
      return cards({ OR: [{ isNew: true }, { createdAt: { gte: recent } }] }, locale, take, [{ createdAt: "desc" }]);
    case "best_sellers":
      return cards({}, locale, take, [{ isBestSeller: "desc" }, { salesCount: "desc" }]);
    case "on_sale":
      return cards({ onSale: true }, locale, take, [{ discountPercent: "desc" }]);
    case "top_rated":
      return cards({ ratingCount: { gt: 0 } }, locale, take, [{ ratingAvg: "desc" }, { ratingCount: "desc" }]);
    case "category": {
      const c = opts.categoryId ? await db.category.findUnique({ where: { id: opts.categoryId } }) : null;
      return c ? cards({ categories: { some: { category: { path: { startsWith: c.path } } } } }, locale, take) : [];
    }
    case "brand":
      return opts.brandId ? cards({ brandId: opts.brandId }, locale, take) : [];
    case "manual": {
      if (!opts.ids?.length) return [];
      const list = await cards({ id: { in: opts.ids } }, locale, take);
      return opts.ids.map((id) => list.find((c) => c.id === id)).filter((c): c is ProductCardDTO => Boolean(c));
    }
  }
}

export async function productCardsByIds(ids: string[], locale: string) {
  if (!ids.length) return [];
  const list = await cards({ id: { in: ids.slice(0, 24) } }, locale, 24);
  return ids.map((id) => list.find((c) => c.id === id)).filter((c): c is ProductCardDTO => Boolean(c));
}

export { priceDTO, badgesFor };

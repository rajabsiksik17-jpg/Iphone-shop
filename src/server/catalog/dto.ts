import "server-only";
import { t } from "@/lib/i18n-text";
import { resolvePrice, variantPriceSource } from "@/lib/pricing";
import type { BadgeKey, ImageDTO, PriceDTO, ProductCardDTO } from "@/types/catalog";
import type { Prisma } from "@/generated/prisma/client";

type MediaLike = { url: string; alt: unknown; width: number | null; height: number | null; blurDataUrl: string | null; renditions: unknown } | null | undefined;

export function imageDTO(media: MediaLike, locale: string, fallbackAlt = ""): ImageDTO | null {
  if (!media) return null;
  return {
    url: media.url,
    alt: t(media.alt, locale) || fallbackAlt,
    width: media.width,
    height: media.height,
    blur: media.blurDataUrl,
    srcSet: Array.isArray(media.renditions) ? (media.renditions as { w: number; url: string }[]) : [],
  };
}

export const cardInclude = {
  brand: { select: { name: true, slug: true } },
  // The two lead images plus any photo linked to a colour (for swatch previews).
  images: { where: { OR: [{ position: { lt: 2 } }, { valueId: { not: null } }] }, orderBy: { position: "asc" }, take: 12, include: { media: true } },
  variants: {
    where: { isActive: true },
    select: { id: true, price: true, salePrice: true, saleStartsAt: true, saleEndsAt: true, stock: true },
  },
  attributes: {
    where: { attribute: { type: "COLOR" } },
    include: { values: { include: { value: { select: { id: true, label: true, colorHex: true, position: true } } } } },
  },
  categories: { where: { isPrimary: true }, include: { category: { select: { name: true } } }, take: 1 },
} satisfies Prisma.ProductInclude;

export type CardProduct = Prisma.ProductGetPayload<{ include: typeof cardInclude }>;

export function priceDTO(p: CardProduct | (Parameters<typeof resolvePrice>[0] & { type: string; variants?: CardProduct["variants"] }), now = new Date()): PriceDTO {
  if (p.type === "VARIABLE" && p.variants?.length) {
    const prices = p.variants.map((v) => resolvePrice(variantPriceSource(p, v), now));
    const cheapest = prices.reduce((a, b) => (b.current < a.current ? b : a));
    const best = prices.reduce((a, b) => (b.percent > a.percent ? b : a));
    return {
      regular: cheapest.regular,
      current: cheapest.current,
      onSale: prices.some((x) => x.onSale),
      percent: best.percent,
      savings: cheapest.savings,
      min: Math.min(...prices.map((x) => x.current)),
      max: Math.max(...prices.map((x) => x.current)),
      saleEndsAt: cheapest.saleEndsAt?.toISOString() ?? null,
    };
  }
  const r = resolvePrice(p, now);
  return { regular: r.regular, current: r.current, onSale: r.onSale, percent: r.percent, savings: r.savings, min: r.current, max: r.current, saleEndsAt: r.saleEndsAt?.toISOString() ?? null };
}

export function badgesFor(
  p: { isNew: boolean; isBestSeller: boolean; isLimited: boolean; stockStatus: string; createdAt: Date },
  price: PriceDTO,
  newProductDays: number,
): BadgeKey[] {
  const out: BadgeKey[] = [];
  if (p.stockStatus === "OUT_OF_STOCK") out.push("outOfStock");
  if (p.stockStatus === "PREORDER") out.push("preorder");
  if (price.onSale) out.push("sale");
  const isRecent = newProductDays > 0 && Date.now() - p.createdAt.getTime() < newProductDays * 86_400_000;
  if (p.isNew || isRecent) out.push("new");
  if (p.isBestSeller) out.push("bestSeller");
  if (p.isLimited) out.push("limited");
  if (p.stockStatus === "LOW_STOCK") out.push("lowStock");
  return out;
}

export function toCard(p: CardProduct, locale: string, opts: { newProductDays: number }): ProductCardDTO {
  const name = t(p.name, locale);
  const price = priceDTO(p);
  const swatches = p.attributes
    .flatMap((a) => a.values.map((v) => v.value))
    .sort((a, b) => a.position - b.position)
    .filter((v) => v.colorHex)
    .map((v) => ({ label: t(v.label, locale), hex: v.colorHex!, image: imageDTO(p.images.find((i) => i.valueId === v.id)?.media, locale, `${name} — ${t(v.label, locale)}`) }));
  return {
    id: p.id,
    slug: p.slug,
    name,
    brand: p.brand ? { name: t(p.brand.name, locale), slug: p.brand.slug } : null,
    image: imageDTO(p.images[0]?.media, locale, name),
    hoverImage: imageDTO(p.images[1]?.media, locale, name),
    price,
    rating: p.ratingAvg,
    ratingCount: p.ratingCount,
    stockStatus: p.stockStatus,
    badges: badgesFor(p, price, opts.newProductDays),
    isVariable: p.type === "VARIABLE",
    quickAdd: p.type === "SIMPLE" && p.stockStatus !== "OUT_OF_STOCK",
    swatches,
    category: p.categories[0] ? t(p.categories[0].category.name, locale) : null,
  };
}

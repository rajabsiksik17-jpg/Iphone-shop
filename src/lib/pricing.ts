/**
 * Pure pricing rules (no I/O) — shared by server and client and unit-tested.
 * All amounts are integer minor units.
 */
export type PriceSource = {
  price: number;
  salePrice: number | null;
  saleStartsAt: Date | string | null;
  saleEndsAt: Date | string | null;
};

export type ResolvedPrice = {
  regular: number;
  current: number;
  onSale: boolean;
  savings: number;
  percent: number;
  saleEndsAt: Date | null;
};

const toDate = (d: Date | string | null) => (d ? new Date(d) : null);

export function isSaleActive(src: PriceSource, now = new Date()): boolean {
  if (src.salePrice == null || src.salePrice < 0 || src.salePrice >= src.price) return false;
  const start = toDate(src.saleStartsAt);
  const end = toDate(src.saleEndsAt);
  if (start && now < start) return false;
  if (end && now >= end) return false;
  return true;
}

export function resolvePrice(src: PriceSource, now = new Date()): ResolvedPrice {
  const onSale = isSaleActive(src, now);
  const current = onSale ? (src.salePrice as number) : src.price;
  const savings = src.price - current;
  return {
    regular: src.price,
    current,
    onSale,
    savings,
    percent: onSale && src.price > 0 ? Math.floor((savings / src.price) * 100) : 0,
    saleEndsAt: onSale ? toDate(src.saleEndsAt) : null,
  };
}

/** A variant inherits any pricing field it doesn't override from its product. */
export function variantPriceSource(
  product: PriceSource,
  variant: { price: number | null; salePrice: number | null; saleStartsAt?: Date | string | null; saleEndsAt?: Date | string | null },
): PriceSource {
  const overridesPrice = variant.price != null;
  return {
    price: variant.price ?? product.price,
    // If the variant sets its own regular price but no sale, don't inherit a sale that may exceed it.
    salePrice: variant.salePrice ?? (overridesPrice ? null : product.salePrice),
    saleStartsAt: variant.salePrice != null ? (variant.saleStartsAt ?? null) : overridesPrice ? null : product.saleStartsAt,
    saleEndsAt: variant.salePrice != null ? (variant.saleEndsAt ?? null) : overridesPrice ? null : product.saleEndsAt,
  };
}

/** Range over active variants (for "from X" display, sorting and filtering). */
export function priceRange(prices: ResolvedPrice[]) {
  if (!prices.length) return null;
  const currents = prices.map((p) => p.current);
  const min = Math.min(...currents);
  const max = Math.max(...currents);
  const best = prices.reduce((a, b) => (b.percent > a.percent ? b : a));
  return { min, max, maxPercent: best.percent, anyOnSale: prices.some((p) => p.onSale) };
}

export type StockState = "IN_STOCK" | "LOW_STOCK" | "OUT_OF_STOCK" | "BACKORDER" | "PREORDER";

export function stockState(opts: { track: boolean; stock: number; lowThreshold: number; allowBackorder: boolean; preorder?: boolean }): StockState {
  if (opts.preorder) return "PREORDER";
  if (!opts.track) return "IN_STOCK";
  if (opts.stock <= 0) return opts.allowBackorder ? "BACKORDER" : "OUT_OF_STOCK";
  if (opts.lowThreshold > 0 && opts.stock <= opts.lowThreshold) return "LOW_STOCK";
  return "IN_STOCK";
}

export const isPurchasable = (s: StockState) => s !== "OUT_OF_STOCK";

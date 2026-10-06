import "server-only";
import { db, type Tx } from "../db";
import { getSettings } from "../settings/service";
import { allLocales } from "@/lib/i18n-text";
import { priceRange, resolvePrice, stockState, variantPriceSource } from "@/lib/pricing";

/**
 * Recompute denormalised product fields used for fast listing, sorting and
 * search: effective price range, discount, sale flag, aggregate stock/status
 * and the search document. Called after every product/variant/stock change and
 * by the scheduler when sales start or end.
 */
export async function refreshProductDerived(productId: string, tx: Tx = db) {
  const p = await tx.product.findUnique({
    where: { id: productId },
    include: {
      brand: { select: { name: true } },
      variants: { where: { isActive: true }, include: { options: { include: { value: { select: { label: true } } } } } },
      categories: { include: { category: { select: { name: true } } } },
      attributes: { include: { values: { include: { value: { select: { label: true } } } } } },
      tags: { include: { tag: { select: { name: true } } } },
    },
  });
  if (!p) return;
  const store = await getSettings("store");
  const threshold = p.lowStockThreshold ?? store.lowStockThreshold;

  let effectivePrice: number, maxPrice: number, discountPercent: number, onSale: boolean, stock: number, status;
  if (p.type === "VARIABLE" && p.variants.length) {
    const prices = p.variants.map((v) => resolvePrice(variantPriceSource(p, v)));
    const range = priceRange(prices)!;
    effectivePrice = range.min;
    maxPrice = range.max;
    discountPercent = range.maxPercent;
    onSale = range.anyOnSale;
    stock = p.variants.reduce((s, v) => s + Math.max(0, v.stock), 0);
    // Keep each variant's status fresh too.
    for (const v of p.variants) {
      const vs = stockState({ track: p.trackInventory, stock: v.stock, lowThreshold: threshold, allowBackorder: p.allowBackorder });
      if (vs !== v.stockStatus) await tx.productVariant.update({ where: { id: v.id }, data: { stockStatus: vs } });
    }
    const anyBuyable = p.variants.some((v) => !p.trackInventory || v.stock > 0);
    status = !anyBuyable
      ? p.allowBackorder ? "BACKORDER" : "OUT_OF_STOCK"
      : stockState({ track: p.trackInventory, stock, lowThreshold: threshold, allowBackorder: p.allowBackorder });
  } else {
    const r = resolvePrice(p);
    effectivePrice = r.current;
    maxPrice = r.current;
    discountPercent = r.percent;
    onSale = r.onSale;
    stock = p.stock;
    status = stockState({ track: p.trackInventory, stock: p.stock, lowThreshold: threshold, allowBackorder: p.allowBackorder });
  }

  const searchText = [
    allLocales(p.name),
    p.sku,
    p.barcode,
    p.modelNumber,
    p.manufacturer,
    allLocales(p.brand?.name),
    ...p.categories.map((c) => allLocales(c.category.name)),
    ...p.attributes.flatMap((a) => [...a.values.map((v) => allLocales(v.value.label)), allLocales(a.textValue)]),
    ...p.variants.flatMap((v) => [v.sku, ...v.options.map((o) => allLocales(o.value.label))]),
    ...p.tags.map((t) => allLocales(t.tag.name)),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .slice(0, 4000);

  await tx.product.update({
    where: { id: productId },
    data: { effectivePrice, maxPrice, discountPercent, onSale, stockStatus: status, searchText, ...(p.type === "VARIABLE" ? { stock } : {}) },
  });
  return { effectivePrice, onSale, stockStatus: status, stock };
}

/**
 * Scheduler hook: products whose sale window just opened or closed need their
 * denormalised price refreshed. Cheap: only touches products with schedules.
 */
export async function refreshScheduledPrices() {
  const now = new Date();
  const candidates = await db.product.findMany({
    where: {
      OR: [
        { salePrice: { not: null }, OR: [{ saleStartsAt: { not: null } }, { saleEndsAt: { not: null } }] },
        { variants: { some: { salePrice: { not: null }, OR: [{ saleStartsAt: { not: null } }, { saleEndsAt: { not: null } }] } } },
      ],
    },
    select: { id: true, onSale: true, price: true, salePrice: true, saleStartsAt: true, saleEndsAt: true, type: true },
  });
  let updated = 0;
  for (const c of candidates) {
    if (c.type === "SIMPLE" && resolvePrice(c, now).onSale === c.onSale) continue;
    await refreshProductDerived(c.id);
    updated++;
  }
  return updated;
}

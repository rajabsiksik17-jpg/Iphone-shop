import "server-only";
import { db, ANY_PROFILE, type Tx } from "../db";
import { getSettings } from "../settings/service";
import { allLocales } from "@/lib/i18n-text";
import { normalizeText, phoneticKey, romanizeArabic, stemText } from "@/lib/search-text";
import { priceRange, resolvePrice, stockState, variantPriceSource } from "@/lib/pricing";

/**
 * Recompute denormalised product fields used for fast listing, sorting and
 * search: effective price range, discount, sale flag, aggregate stock/status
 * and the search document. Called after every product/variant/stock change and
 * by the scheduler when sales start or end.
 */
export async function refreshProductDerived(productId: string, tx: Tx = db) {
  const p = await tx.product.findUnique({
    where: { id: productId, ...ANY_PROFILE },
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

  const doc = normalizeText(
    [
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
      .join(" "),
  );
  // Arabic stems appended so "ساعة" finds "الساعات الذكية".
  const stems = stemText(doc);
  // Romanized Arabic keeps fuzzy Arabic matching locale-independent (see romanizeArabic).
  const searchText = `${doc} ${stems} ${romanizeArabic(`${doc} ${stems}`)}`.replace(/\s+/g, " ").trim().slice(0, 8000);
  // Ranking fields: the name and brand get their own boosts; phonetic keys
  // cover name, brand, model, categories and tags (the words people type).
  const searchTitle = normalizeText(allLocales(p.name)).slice(0, 500);
  const searchBrand = normalizeText(allLocales(p.brand?.name)).slice(0, 200);
  const searchPhonetic = phoneticKey(
    [allLocales(p.name), allLocales(p.brand?.name), p.modelNumber, ...p.categories.map((c) => allLocales(c.category.name)), ...p.tags.map((t) => allLocales(t.tag.name))]
      .filter(Boolean)
      .join(" "),
  ).slice(0, 1000);

  await tx.product.update({
    where: { id: productId, ...ANY_PROFILE },
    data: { effectivePrice, maxPrice, discountPercent, onSale, stockStatus: status, searchText, searchTitle, searchBrand, searchPhonetic, ...(p.type === "VARIABLE" ? { stock } : {}) },
  });
  return { effectivePrice, onSale, stockStatus: status, stock };
}

/**
 * Scheduler hook: products whose sale window just opened or closed need their
 * denormalised price refreshed. Cheap: only touches products with schedules.
 */
export async function refreshScheduledPrices() {
  const now = new Date();
  // Every store-type profile: a sale may end while its type isn't active.
  const candidates = await db.product.findMany({
    where: {
      ...ANY_PROFILE,
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

import "server-only";
import { normalizeText, phoneticKey, romanizeArabic, stemText } from "@/lib/search-text";
import { db, Prisma } from "../db";
import { getSettings } from "../settings/service";
import { t } from "@/lib/i18n-text";
import type { Facet, ListingQuery, ListingResult, SortKey } from "@/types/catalog";
import { cardInclude, toCard } from "./dto";

export const PAGE_SIZE = 24;

/** Products a shopper may see in browse listings. */
export function visibleWhere(now = new Date(), context: "browse" | "search" = "browse"): Prisma.ProductWhereInput {
  return {
    status: "ACTIVE",
    visibility: { in: context === "search" ? ["VISIBLE", "SEARCH_ONLY"] : ["VISIBLE", "CATALOG_ONLY"] },
    OR: [{ publishedAt: null }, { publishedAt: { lte: now } }],
  };
}

/** Query normalization shared with the index builder (see lib/search-text). */
export function normalizeQuery(q: string) {
  return normalizeText(q).slice(0, 100);
}

const escapeLike = (s: string) => s.replace(/[%_\\]/g, "\\$&");

/**
 * Ranked product search.
 *
 * One query scores every candidate on: exact name, exact brand, name/word
 * prefix, fuzzy name, SKU, phonetic match (Arabic ↔ English transliteration
 * and typos), the full document (categories, specs, tags) and popularity.
 * Candidates come from GIN trigram indexes (LIKE / <% operators), so the
 * whole catalogue is never scanned in application code.
 */
export async function searchProductIds(q: string, limit = 400): Promise<{ id: string; score: number }[]> {
  const term = normalizeQuery(q);
  if (!term) return [];
  const phon = phoneticKey(term);
  const usePhon = phon.replace(/\s/g, "").length >= 2;
  const stem = stemText(term) || term;
  // Romanized Arabic query (matches the romanized copy in the index); falls
  // back to the plain term for Latin-only queries.
  const roman = romanizeArabic(`${term} ${stemText(term)}`) || term;
  const like = `%${escapeLike(term)}%`;
  const prefix = `${escapeLike(term)}%`;
  const wordPrefix = `% ${escapeLike(term)}%`;
  // SKUs compared without punctuation ("APL-IP17" ≡ "apl ip17").
  const skuTerm = term.replace(/[^a-z0-9]+/g, "");
  // Parameterised — never string-concatenate user input into SQL.
  const rows = await db.$transaction(async (tx) => {
    // Lower than the 0.6 default so 1–2 typos in a short word still match.
    await tx.$executeRawUnsafe(`SET LOCAL pg_trgm.word_similarity_threshold = 0.45`);
    return tx.$queryRaw<{ id: string; score: number; textSim: number; phonSim: number; literal: boolean; sku: boolean }[]>`
      WITH c AS (
        SELECT id, "searchTitle", "searchBrand", "searchText", "salesCount", "ratingAvg", "isFeatured",
          regexp_replace(lower(coalesce("sku", '')), '[^a-z0-9]+', '', 'g') AS skuN,
          GREATEST(word_similarity(${term}, "searchText"), word_similarity(${stem}, "searchText"), word_similarity(${roman}, "searchText")) AS "textSim",
          CASE WHEN ${usePhon} THEN word_similarity(${phon}, "searchPhonetic") ELSE 0 END AS "phonSim",
          ("searchText" LIKE ${like}) AS literal
        FROM "Product"
        WHERE "status" = 'ACTIVE'
          AND (
            "searchText" LIKE ${like}
            OR ${term} <% "searchText"
            OR ${stem} <% "searchText"
            OR ${roman} <% "searchText"
            OR (${usePhon} AND ${phon} <% "searchPhonetic")
            OR (${skuTerm} <> '' AND regexp_replace(lower(coalesce("sku", '')), '[^a-z0-9]+', '', 'g') LIKE ${skuTerm + "%"})
          )
      )
      SELECT id, "textSim"::float, "phonSim"::float, literal,
        (${skuTerm} <> '' AND skuN LIKE ${skuTerm + "%"}) AS sku,
        (
            CASE WHEN "searchTitle" = ${term} THEN 100 ELSE 0 END
          + CASE WHEN "searchBrand" <> '' AND "searchBrand" = ${term} THEN 60 ELSE 0 END
          + CASE WHEN "searchTitle" LIKE ${prefix} THEN 45 WHEN "searchTitle" LIKE ${wordPrefix} THEN 35 ELSE 0 END
          + 35 * word_similarity(${term}, "searchTitle")
          + 12 * similarity(${term}, "searchTitle")
          + 20 * word_similarity(${term}, "searchBrand")
          + CASE WHEN ${skuTerm} <> '' AND skuN = ${skuTerm} THEN 90 WHEN ${skuTerm} <> '' AND skuN LIKE ${skuTerm + "%"} THEN 30 ELSE 0 END
          + 30 * "phonSim"
          + 22 * "textSim"
          + CASE WHEN literal THEN 10 ELSE 0 END
          + LEAST(6, ln(1 + "salesCount")) + "ratingAvg" * 0.4 + CASE WHEN "isFeatured" THEN 1 ELSE 0 END
        )::float AS score
      FROM c
      ORDER BY score DESC, "salesCount" DESC
      LIMIT ${limit}`;
  });
  // A product must match on something substantial — a literal substring, a
  // close fuzzy match, a near-exact phonetic match or an SKU prefix — so short
  // or random queries don't return noise.
  const strong = rows.filter((r) => r.literal || r.sku || r.textSim >= 0.5 || r.phonSim >= 0.75);
  if (!strong.length) return [];
  // Drop the long tail of weak matches once there are strong ones.
  const cutoff = Math.max(14, strong[0].score * 0.18);
  return strong.filter((r) => r.score >= cutoff).map((r) => ({ id: r.id, score: r.score }));
}

function baseWhere(query: ListingQuery, searchIds: string[] | null): Prisma.ProductWhereInput {
  const and: Prisma.ProductWhereInput[] = [visibleWhere(new Date(), query.q ? "search" : "browse")];
  if (searchIds) and.push({ id: { in: searchIds } });
  if (query.ids) and.push({ id: { in: query.ids } });
  if (query.categoryPath) and.push({ categories: { some: { category: { path: { startsWith: query.categoryPath }, isActive: true } } } });
  if (query.brandId) and.push({ brandId: query.brandId });
  return { AND: and };
}

function refinedWhere(query: ListingQuery, base: Prisma.ProductWhereInput, skip?: "brand" | "price" | string): Prisma.ProductWhereInput {
  const and: Prisma.ProductWhereInput[] = [base];
  if (skip !== "brand" && query.brandSlugs?.length) and.push({ brand: { slug: { in: query.brandSlugs } } });
  if (skip !== "price") {
    if (query.minPrice != null) and.push({ effectivePrice: { gte: query.minPrice } });
    if (query.maxPrice != null) and.push({ effectivePrice: { lte: query.maxPrice } });
  }
  if (query.inStock) and.push({ stockStatus: { in: ["IN_STOCK", "LOW_STOCK", "BACKORDER", "PREORDER"] } });
  if (query.onSale) and.push({ onSale: true });
  if (query.minRating) and.push({ ratingAvg: { gte: query.minRating } });
  for (const f of query.flags ?? []) {
    if (f === "new") and.push({ isNew: true });
    if (f === "featured") and.push({ isFeatured: true });
    if (f === "bestSeller") and.push({ isBestSeller: true });
  }
  for (const [key, values] of Object.entries(query.attributes ?? {})) {
    if (!values.length || skip === `attr:${key}`) continue;
    and.push({ attributes: { some: { attribute: { key }, values: { some: { value: { slug: { in: values } } } } } } });
  }
  return { AND: and };
}

function orderBy(sort: SortKey): Prisma.ProductOrderByWithRelationInput[] {
  switch (sort) {
    case "newest":
      return [{ createdAt: "desc" }];
    case "oldest":
      return [{ createdAt: "asc" }];
    case "price_asc":
      return [{ effectivePrice: "asc" }];
    case "price_desc":
      return [{ effectivePrice: "desc" }];
    case "rating":
      return [{ ratingAvg: "desc" }, { ratingCount: "desc" }];
    case "best_selling":
      return [{ salesCount: "desc" }];
    case "discount":
      return [{ discountPercent: "desc" }, { effectivePrice: "asc" }];
    default:
      return [{ isFeatured: "desc" }, { salesCount: "desc" }, { createdAt: "desc" }];
  }
}

export async function listProducts(query: ListingQuery, locale: string, opts: { withFacets?: boolean } = {}): Promise<ListingResult> {
  const pageSize = Math.min(query.pageSize ?? PAGE_SIZE, 60);
  const page = Math.max(1, query.page ?? 1);
  const scored = query.q ? await searchProductIds(query.q) : null;
  const searchIds = scored ? scored.map((s) => s.id) : null;
  const base = baseWhere(query, searchIds);
  const where = refinedWhere(query, base);
  const sort: SortKey = query.sort ?? (query.q ? "relevance" : "featured");
  const store = await getSettings("store");

  let items;
  let total: number;
  if (sort === "relevance" && scored) {
    // Relevance order comes from the search ranking; filter in the DB, order in memory.
    const matching = await db.product.findMany({ where, select: { id: true } });
    const allowed = new Set(matching.map((m) => m.id));
    const ordered = scored.filter((s) => allowed.has(s.id)).map((s) => s.id);
    total = ordered.length;
    const pageIds = ordered.slice((page - 1) * pageSize, page * pageSize);
    const rows = await db.product.findMany({ where: { id: { in: pageIds } }, include: cardInclude });
    const byId = new Map(rows.map((r) => [r.id, r]));
    items = pageIds.map((id) => byId.get(id)!).filter(Boolean);
  } else {
    [items, total] = await Promise.all([
      db.product.findMany({ where, include: cardInclude, orderBy: [...orderBy(sort), { id: "asc" }], skip: (page - 1) * pageSize, take: pageSize }),
      db.product.count({ where }),
    ]);
  }

  return {
    items: items.map((p) => toCard(p, locale, store)),
    total,
    page,
    pageSize,
    pageCount: Math.max(1, Math.ceil(total / pageSize)),
    facets: opts.withFacets === false ? emptyFacets() : await facets(query, base, locale),
  };
}

function emptyFacets(): ListingResult["facets"] {
  return { brands: [], categories: [], attributes: [], price: { min: 0, max: 0 }, ratings: [], availability: { inStock: 0, onSale: 0 } };
}

/**
 * Facet counts. Each facet is counted with every *other* active filter
 * applied (but not its own), the standard "disjunctive faceting" behaviour
 * that lets shoppers multi-select within a facet.
 */
async function facets(query: ListingQuery, base: Prisma.ProductWhereInput, locale: string): Promise<ListingResult["facets"]> {
  const [brandGroups, priceAgg, ratingRows, inStock, onSale] = await Promise.all([
    db.product.groupBy({ by: ["brandId"], where: refinedWhere(query, base, "brand"), _count: { _all: true } }),
    db.product.aggregate({ where: refinedWhere(query, base, "price"), _min: { effectivePrice: true }, _max: { maxPrice: true } }),
    Promise.all(
      [4, 3, 2, 1].map(async (stars) => ({
        stars,
        count: await db.product.count({ where: { AND: [refinedWhere({ ...query, minRating: undefined }, base), { ratingAvg: { gte: stars } }] } }),
      })),
    ),
    db.product.count({ where: { AND: [refinedWhere({ ...query, inStock: undefined }, base), { stockStatus: { in: ["IN_STOCK", "LOW_STOCK", "BACKORDER", "PREORDER"] } }] } }),
    db.product.count({ where: { AND: [refinedWhere({ ...query, onSale: undefined }, base), { onSale: true }] } }),
  ]);

  const brandIds = brandGroups.map((b) => b.brandId).filter((x): x is string => Boolean(x));
  const brands = await db.brand.findMany({ where: { id: { in: brandIds }, isActive: true }, orderBy: { position: "asc" } });
  const brandCount = new Map(brandGroups.map((b) => [b.brandId, b._count._all]));

  // Which attributes are filterable here: those assigned to the category
  // (and its ancestors) — so phones get RAM/Storage, cases get Material.
  let attributeIds: string[] | null = null;
  if (query.categoryId) {
    const cat = await db.category.findUnique({ where: { id: query.categoryId }, select: { path: true } });
    const ids = cat?.path.split("/").filter(Boolean) ?? [];
    const assigned = await db.categoryAttribute.findMany({ where: { categoryId: { in: ids } }, select: { attributeId: true } });
    if (assigned.length) attributeIds = assigned.map((a) => a.attributeId);
  }
  const attributes = await db.attribute.findMany({
    where: { isFilterable: true, type: { in: ["SELECT", "MULTISELECT", "COLOR", "BOOLEAN"] }, ...(attributeIds ? { id: { in: attributeIds } } : {}) },
    include: { values: { orderBy: { position: "asc" } } },
    orderBy: { position: "asc" },
  });

  const attrFacets: Facet[] = [];
  for (const attr of attributes) {
    const counts = await db.productAttributeValue.groupBy({
      by: ["valueId"],
      where: { productAttribute: { attributeId: attr.id, product: refinedWhere(query, base, `attr:${attr.key}`) } },
      _count: { _all: true },
    });
    const countMap = new Map(counts.map((c) => [c.valueId, c._count._all]));
    const values = attr.values
      .map((v) => ({ slug: v.slug, label: t(v.label, locale), count: countMap.get(v.id) ?? 0, hex: v.colorHex }))
      .filter((v) => v.count > 0 || query.attributes?.[attr.key]?.includes(v.slug));
    if (values.length) attrFacets.push({ key: attr.key, label: t(attr.name, locale), type: attr.type, unit: attr.unit, values });
  }

  // Sub-categories of the current scope (for drilling down).
  let categories: ListingResult["facets"]["categories"] = [];
  const children = await db.category.findMany({
    where: { isActive: true, parentId: query.categoryId ?? null },
    orderBy: { position: "asc" },
    select: { id: true, slug: true, fullSlug: true, name: true, path: true },
  });
  if (children.length) {
    categories = (
      await Promise.all(
        children.map(async (c) => ({
          slug: c.slug,
          fullSlug: c.fullSlug,
          label: t(c.name, locale),
          count: await db.product.count({ where: { AND: [base, { categories: { some: { category: { path: { startsWith: c.path } } } } }] } }),
        })),
      )
    ).filter((c) => c.count > 0);
  }

  return {
    brands: brands.map((b) => ({ slug: b.slug, label: t(b.name, locale), count: brandCount.get(b.id) ?? 0 })),
    categories,
    attributes: attrFacets,
    price: { min: priceAgg._min.effectivePrice ?? 0, max: priceAgg._max.maxPrice ?? 0 },
    ratings: ratingRows.filter((r) => r.count > 0),
    availability: { inStock, onSale },
  };
}

/** Parse listing filters from URL search params (shared by shop/category/brand/search). */
export function parseListingParams(sp: Record<string, string | string[] | undefined>, baseDecimals: number): ListingQuery {
  const one = (k: string) => (Array.isArray(sp[k]) ? sp[k]?.[0] : sp[k]) as string | undefined;
  const many = (k: string) => (one(k) ?? "").split(",").map((s) => s.trim()).filter(Boolean).slice(0, 30);
  const money = (k: string) => {
    const v = Number(one(k));
    return Number.isFinite(v) && v >= 0 ? Math.round(v * 10 ** baseDecimals) : undefined;
  };
  const attributes: Record<string, string[]> = {};
  for (const [k, v] of Object.entries(sp)) {
    if (k.startsWith("a_") && typeof v === "string") attributes[k.slice(2).slice(0, 60)] = v.split(",").filter(Boolean).slice(0, 30);
  }
  const sort = one("sort") as SortKey | undefined;
  const rating = Number(one("rating"));
  const page = Number(one("page"));
  return {
    q: one("q")?.slice(0, 100) || undefined,
    brandSlugs: many("brand"),
    attributes,
    minPrice: money("min"),
    maxPrice: money("max"),
    inStock: one("stock") === "1" || undefined,
    onSale: one("sale") === "1" || undefined,
    flags: many("flag").filter((f): f is "new" | "featured" | "bestSeller" => ["new", "featured", "bestSeller"].includes(f)),
    minRating: rating >= 1 && rating <= 5 ? rating : undefined,
    sort: sort && ["featured", "newest", "oldest", "price_asc", "price_desc", "rating", "best_selling", "discount", "relevance"].includes(sort) ? sort : undefined,
    page: Number.isInteger(page) && page > 0 && page < 10_000 ? page : 1,
  };
}

/** True when any refinement is active — such URLs are noindexed to avoid duplicate content. */
export function hasRefinements(q: ListingQuery) {
  return Boolean(
    q.brandSlugs?.length || Object.keys(q.attributes ?? {}).length || q.minPrice != null || q.maxPrice != null || q.inStock || q.onSale || q.flags?.length || q.minRating || (q.sort && q.sort !== "featured"),
  );
}

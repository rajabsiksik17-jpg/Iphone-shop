import "server-only";
import { cache } from "react";
import { db } from "../db";
import { t } from "@/lib/i18n-text";
import { toTree, type Tree } from "@/lib/category-tree";
import { imageDTO } from "./dto";
import { normalizeQuery, searchProductIds, visibleWhere } from "./listing";
import { labelScore, normalizeText } from "@/lib/search-text";
import { cardInclude, toCard } from "./dto";
import { getSettings } from "../settings/service";
import type { ImageDTO } from "@/types/catalog";

export type CategoryNode = {
  id: string;
  parentId: string | null;
  slug: string;
  fullSlug: string;
  name: string;
  position: number;
  icon: string | null;
  image: ImageDTO | null;
  isFeatured: boolean;
  /** Visible products in this category or any subcategory (each product counted once). */
  productCount: number;
};

let countsCache: { at: number; map: Map<string, number> } | null = null;
const COUNTS_TTL = 60_000;

/**
 * Product counts per category, rolled up through the materialised path so a
 * parent includes its whole subtree without double-counting products filed in
 * several of its children. One grouped query, cached briefly per process — the
 * menus never load product rows.
 */
export async function categoryProductCounts(): Promise<Map<string, number>> {
  if (countsCache && Date.now() - countsCache.at < COUNTS_TTL) return countsCache.map;
  const rows = await db.$queryRaw<{ id: string; n: number }[]>`
    SELECT c.id, COUNT(DISTINCT p.id)::int AS n
    FROM "Category" c
    JOIN "Category" d ON d.path LIKE c.path || '%'
    JOIN "ProductCategory" pc ON pc."categoryId" = d.id
    JOIN "Product" p ON p.id = pc."productId"
    WHERE p.status = 'ACTIVE'
      AND p.visibility IN ('VISIBLE', 'CATALOG_ONLY')
      AND (p."publishedAt" IS NULL OR p."publishedAt" <= now())
    GROUP BY c.id`;
  const map = new Map(rows.map((r) => [r.id, r.n]));
  countsCache = { at: Date.now(), map };
  return map;
}

/** Drop cached counts (after catalogue changes in admin). */
export function invalidateCategoryCounts() {
  countsCache = null;
}

export const categoryTree = cache(async (locale: string): Promise<Tree<CategoryNode>[]> => {
  const [rows, counts] = await Promise.all([db.category.findMany({ where: { isActive: true }, include: { image: true }, orderBy: { position: "asc" } }), categoryProductCounts()]);
  // Drop subtrees whose ancestor is inactive.
  const activeIds = new Set(rows.map((r) => r.id));
  const visible = rows.filter((r) => r.path.split("/").filter(Boolean).every((id) => activeIds.has(id)));
  return toTree(
    visible.map((r) => ({
      id: r.id,
      parentId: r.parentId,
      slug: r.slug,
      fullSlug: r.fullSlug,
      name: t(r.name, locale),
      position: r.position,
      icon: r.icon,
      image: imageDTO(r.image, locale, t(r.name, locale)),
      isFeatured: r.isFeatured,
      productCount: counts.get(r.id) ?? 0,
    })),
  );
});

export const getCategoryByFullSlug = cache(async (fullSlug: string, locale: string) => {
  const c = await db.category.findUnique({ where: { fullSlug }, include: { banner: true, image: true } });
  if (!c || !c.isActive) return null;
  const ancestorIds = c.path.split("/").filter(Boolean);
  const ancestors = await db.category.findMany({ where: { id: { in: ancestorIds } } });
  if (ancestors.some((a) => !a.isActive)) return null;
  const chain = ancestorIds.map((id) => ancestors.find((a) => a.id === id)!).filter(Boolean);
  const seo = (c.seo ?? {}) as Record<string, unknown>;
  return {
    id: c.id,
    path: c.path,
    slug: c.slug,
    fullSlug: c.fullSlug,
    name: t(c.name, locale),
    description: t(c.description, locale),
    banner: imageDTO(c.banner, locale, t(c.name, locale)),
    image: imageDTO(c.image, locale, t(c.name, locale)),
    breadcrumbs: chain.map((a) => ({ label: t(a.name, locale), href: `/category/${a.fullSlug}` })),
    seo: {
      title: t(seo.title, locale) || undefined,
      description: t(seo.description, locale) || undefined,
      canonical: typeof seo.canonical === "string" ? seo.canonical : undefined,
      ogImage: typeof seo.ogImage === "string" ? seo.ogImage : undefined,
      noindex: seo.noindex === true,
    },
    updatedAt: c.updatedAt,
  };
});

export const listBrands = cache(async (locale: string, opts: { featuredOnly?: boolean } = {}) => {
  const rows = await db.brand.findMany({
    where: { isActive: true, ...(opts.featuredOnly ? { isFeatured: true } : {}) },
    include: { logo: true, _count: { select: { products: { where: visibleWhere() } } } },
    orderBy: [{ position: "asc" }],
  });
  return rows.map((b) => ({
    id: b.id,
    slug: b.slug,
    name: t(b.name, locale),
    logo: imageDTO(b.logo, locale, t(b.name, locale)),
    productCount: b._count.products,
  }));
});

export const getBrandBySlug = cache(async (slug: string, locale: string) => {
  const b = await db.brand.findUnique({ where: { slug }, include: { logo: true, banner: true } });
  if (!b || !b.isActive) return null;
  const seo = (b.seo ?? {}) as Record<string, unknown>;
  return {
    id: b.id,
    slug: b.slug,
    name: t(b.name, locale),
    description: t(b.description, locale),
    website: b.website,
    logo: imageDTO(b.logo, locale, t(b.name, locale)),
    banner: imageDTO(b.banner, locale, t(b.name, locale)),
    seo: {
      title: t(seo.title, locale) || undefined,
      description: t(seo.description, locale) || undefined,
      canonical: typeof seo.canonical === "string" ? seo.canonical : undefined,
      ogImage: typeof seo.ogImage === "string" ? seo.ogImage : undefined,
      noindex: seo.noindex === true,
    },
    updatedAt: b.updatedAt,
  };
});

type Shortcut = { href: string; label: string; image: ImageDTO | null; count?: number };
export type SearchSuggestions = { products: ReturnType<typeof toCard>[]; categories: Shortcut[]; brands: Shortcut[]; popular: string[]; didYouMean: string | null };

// Categories and brands are few: keep them in memory and match with the same
// normalization/phonetic rules as products (typos, Arabic ↔ English).
const g = globalThis as unknown as { __searchLabels?: { at: number; data: Awaited<ReturnType<typeof loadLabels>> }; __suggestCache?: Map<string, { at: number; value: SearchSuggestions }> };
async function loadLabels() {
  const [cats, brands] = await Promise.all([
    db.category.findMany({ where: { isActive: true }, select: { fullSlug: true, name: true, depth: true, image: true, _count: { select: { products: true } } } }),
    db.brand.findMany({ where: { isActive: true }, select: { slug: true, name: true, logo: true, _count: { select: { products: { where: visibleWhere() } } } } }),
  ]);
  return { cats, brands };
}
async function labels() {
  if (!g.__searchLabels || Date.now() - g.__searchLabels.at > 60_000) g.__searchLabels = { at: Date.now(), data: await loadLabels() };
  return g.__searchLabels.data;
}
const bestLabelScore = (q: string, name: unknown) => Math.max(labelScore(q, t(name, "en")), labelScore(q, t(name, "ar")));

/** Instant search: ranked products, fuzzy category/brand shortcuts, popular terms, "did you mean". */
export async function searchSuggestions(q: string, locale: string): Promise<SearchSuggestions> {
  const term = normalizeQuery(q);
  const cache = (g.__suggestCache ??= new Map());
  const key = `${locale}:${term}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < 30_000) return hit.value;

  const [store, l] = await Promise.all([getSettings("store"), labels()]);
  let value: SearchSuggestions;
  if (!term) {
    const popular = await db.searchTerm.findMany({ where: { lastResults: { gt: 0 } }, orderBy: { count: "desc" }, take: 8 });
    // Shown before typing: the main categories and the brands people buy.
    value = {
      products: [],
      categories: l.cats.filter((c) => c.depth === 0 && c._count.products >= 0).slice(0, 8).map((c) => ({ href: `/category/${c.fullSlug}`, label: t(c.name, locale), image: imageDTO(c.image, locale, t(c.name, locale)) })),
      brands: l.brands.filter((b) => b._count.products > 0).sort((a, b) => b._count.products - a._count.products).slice(0, 8).map((b) => ({ href: `/brand/${b.slug}`, label: t(b.name, locale), image: imageDTO(b.logo, locale, t(b.name, locale)), count: b._count.products })),
      popular: popular.map((p) => p.term),
      didYouMean: null,
    };
  } else {
    const ids = await searchProductIds(term, 6);
    const rows = ids.length ? await db.product.findMany({ where: { AND: [visibleWhere(new Date(), "search"), { id: { in: ids.map((i) => i.id) } }] }, include: cardInclude }) : [];
    const order = new Map(ids.map((i, idx) => [i.id, idx]));
    rows.sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));
    const cats = l.cats.map((c) => ({ c, s: bestLabelScore(term, c.name) - c.depth * 0.01 })).filter((x) => x.s >= 0.45).sort((a, b) => b.s - a.s).slice(0, 4);
    const brands = l.brands.map((b) => ({ b, s: bestLabelScore(term, b.name) })).filter((x) => x.s >= 0.45).sort((a, b) => b.s - a.s).slice(0, 4);
    // "Did you mean": when the query isn't literally in any result, offer the
    // closest brand or product name (what the shopper most likely meant).
    const literal = rows.some((r) => normalizeText([t(r.name, "en"), t(r.name, "ar"), t(r.brand?.name, "en"), t(r.brand?.name, "ar")].join(" ")).includes(term));
    let didYouMean: string | null = null;
    if (!literal && rows[0]) {
      // The single word from the top result's name/brand closest to what was typed.
      const words = [t(rows[0].brand?.name, locale), t(rows[0].name, locale)].join(" ").split(/\s+/).filter((w) => w.length >= 3);
      const best = words.map((w) => ({ w, s: labelScore(term, w) })).sort((a, b) => b.s - a.s)[0];
      didYouMean = best && best.s >= 0.45 ? best.w : null;
    }
    value = {
      products: rows.map((r) => toCard(r, locale, store)),
      categories: cats.map(({ c }) => ({ href: `/category/${c.fullSlug}`, label: t(c.name, locale), image: imageDTO(c.image, locale, t(c.name, locale)) })),
      brands: brands.map(({ b }) => ({ href: `/brand/${b.slug}`, label: t(b.name, locale), image: imageDTO(b.logo, locale, t(b.name, locale)), count: b._count.products })),
      popular: [],
      didYouMean,
    };
  }
  if (cache.size > 300) cache.clear();
  cache.set(key, { at: Date.now(), value });
  return value;
}

/** Count searches (aggregated, no personal data) to power "popular searches". */
export async function recordSearch(q: string, results: number) {
  const term = normalizeQuery(q);
  if (term.length < 2) return;
  await db.searchTerm.upsert({
    where: { term },
    create: { term, lastResults: results },
    update: { count: { increment: 1 }, lastResults: results, lastAt: new Date() },
  });
}

export type RailItem = { id: string; fullSlug: string; name: string; icon: string | null; image: ImageDTO | null; count: number; current: boolean };

/**
 * Category "stories" rail: the children of a category, or — for a leaf — its
 * siblings with the current one highlighted, so shoppers can always move
 * sideways without going back up. Empty branches are hidden.
 */
export const categoryRail = cache(async (categoryId: string, locale: string): Promise<{ parent: { name: string; fullSlug: string } | null; items: RailItem[] }> => {
  const current = await db.category.findUnique({ where: { id: categoryId }, select: { id: true, parentId: true } });
  if (!current) return { parent: null, items: [] };
  let rows = await db.category.findMany({ where: { parentId: current.id, isActive: true }, include: { image: true }, orderBy: { position: "asc" } });
  let parent: { name: string; fullSlug: string } | null = null;
  if (!rows.length && current.parentId) {
    rows = await db.category.findMany({ where: { parentId: current.parentId, isActive: true }, include: { image: true }, orderBy: { position: "asc" } });
    const p = await db.category.findUnique({ where: { id: current.parentId }, select: { name: true, fullSlug: true } });
    parent = p ? { name: t(p.name, locale), fullSlug: p.fullSlug } : null;
  }
  const counts = await categoryProductCounts();
  return {
    parent,
    items: rows
      .map((r) => ({ id: r.id, fullSlug: r.fullSlug, name: t(r.name, locale), icon: r.icon, image: imageDTO(r.image, locale, t(r.name, locale)), count: counts.get(r.id) ?? 0, current: r.id === current.id }))
      .filter((r) => r.count > 0 || r.current),
  };
});

/**
 * Categories to suggest when a listing has few or no products: siblings of the
 * current category that have products, falling back to top-level categories.
 */
export const exploreCategories = cache(async (locale: string, currentId?: string): Promise<RailItem[]> => {
  const tree = await categoryTree(locale);
  const flat: { node: Tree<CategoryNode>; parentId: string | null }[] = [];
  const walk = (nodes: Tree<CategoryNode>[]) => nodes.forEach((n) => (flat.push({ node: n, parentId: n.parentId }), walk(n.children)));
  walk(tree);
  const current = currentId ? flat.find((f) => f.node.id === currentId) : undefined;
  const siblings = current ? flat.filter((f) => f.parentId === current.parentId && f.node.id !== currentId) : [];
  const pick = (list: Tree<CategoryNode>[]) => list.filter((n) => n.productCount > 0 && n.id !== currentId && !current?.node.fullSlug.startsWith(n.fullSlug + "/"));
  let items = pick(siblings.map((s) => s.node));
  if (items.length < 3) items = [...items, ...pick(tree).filter((n) => !items.some((i) => i.id === n.id))];
  return items.slice(0, 8).map((n) => ({ id: n.id, fullSlug: n.fullSlug, name: n.name, icon: n.icon, image: n.image, count: n.productCount, current: false }));
});

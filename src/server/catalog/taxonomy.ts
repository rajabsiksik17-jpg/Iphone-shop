import "server-only";
import { cache } from "react";
import { db } from "../db";
import { t } from "@/lib/i18n-text";
import { toTree, type Tree } from "@/lib/category-tree";
import { imageDTO } from "./dto";
import { normalizeQuery, searchProductIds, visibleWhere } from "./listing";
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
};

export const categoryTree = cache(async (locale: string): Promise<Tree<CategoryNode>[]> => {
  const rows = await db.category.findMany({ where: { isActive: true }, include: { image: true }, orderBy: { position: "asc" } });
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

/** Instant search: products + matching categories/brands, plus popular terms. */
export async function searchSuggestions(q: string, locale: string) {
  const term = normalizeQuery(q);
  const store = await getSettings("store");
  if (!term) {
    const popular = await db.searchTerm.findMany({ where: { lastResults: { gt: 0 } }, orderBy: { count: "desc" }, take: 8 });
    return { products: [], categories: [], brands: [], popular: popular.map((p) => p.term) };
  }
  const like = `%${term}%`;
  const [ids, categories, brands] = await Promise.all([
    searchProductIds(term, 6),
    db.$queryRaw<{ fullSlug: string; name: unknown }[]>`
      SELECT "fullSlug", "name" FROM "Category"
      WHERE "isActive" = true AND (lower("name"->>'en') LIKE ${like} OR "name"->>'ar' LIKE ${like} OR "slug" LIKE ${like})
      ORDER BY "depth" ASC LIMIT 4`,
    db.$queryRaw<{ slug: string; name: unknown }[]>`
      SELECT "slug", "name" FROM "Brand"
      WHERE "isActive" = true AND (lower("name"->>'en') LIKE ${like} OR "name"->>'ar' LIKE ${like} OR "slug" LIKE ${like})
      LIMIT 4`,
  ]);
  const rows = ids.length
    ? await db.product.findMany({ where: { AND: [visibleWhere(new Date(), "search"), { id: { in: ids.map((i) => i.id) } }] }, include: cardInclude })
    : [];
  const order = new Map(ids.map((i, idx) => [i.id, idx]));
  rows.sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));
  return {
    products: rows.map((r) => toCard(r, locale, store)),
    categories: categories.map((c) => ({ href: `/category/${c.fullSlug}`, label: t(c.name, locale) })),
    brands: brands.map((b) => ({ href: `/brand/${b.slug}`, label: t(b.name, locale) })),
    popular: [] as string[],
  };
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
  const counts = await Promise.all(rows.map((r) => db.product.count({ where: { ...visibleWhere(), categories: { some: { category: { path: { startsWith: r.path } } } } } })));
  return {
    parent,
    items: rows
      .map((r, i) => ({ id: r.id, fullSlug: r.fullSlug, name: t(r.name, locale), icon: r.icon, image: imageDTO(r.image, locale, t(r.name, locale)), count: counts[i], current: r.id === current.id }))
      .filter((r) => r.count > 0 || r.current),
  };
});

import "server-only";
import { z } from "zod";
import { db } from "../db";
import { AppError, Errors } from "../errors";
import { audit } from "../audit";
import { refreshProductDerived } from "../catalog/derived";
import { localized, t } from "@/lib/i18n-text";
import { slugify } from "@/lib/utils";
import { buildFullSlug, buildPath, depthOf, rebaseSubtree, wouldCreateCycle } from "@/lib/category-tree";
import { sortTree } from "./products";
import type { CurrentStaff } from "../auth/session";

const lt = localized({ max: 5000 });
const seoSchema = z.object({ title: lt, description: lt, canonical: z.union([z.string().url(), z.literal("")]).default(""), ogImage: z.string().max(500).default(""), noindex: z.boolean().default(false) });
const iconSchema = z.string().regex(/^(lucide:[A-Za-z0-9]+|custom:[a-z0-9]+)$/).nullable().optional();

function seoOut(seo: unknown) {
  const s = (seo ?? {}) as Record<string, unknown>;
  return { title: (s.title ?? {}) as Record<string, string>, description: (s.description ?? {}) as Record<string, string>, canonical: (s.canonical as string) ?? "", ogImage: (s.ogImage as string) ?? "", noindex: s.noindex === true };
}
const seoIn = (s: z.infer<typeof seoSchema>) => ({ title: s.title, description: s.description, canonical: s.canonical || undefined, ogImage: s.ogImage || undefined, noindex: s.noindex });

// ──────────────────────────────── Categories ────────────────────────────────

export async function adminCategories(locale: string) {
  const [rows, attributes, counts] = await Promise.all([
    db.category.findMany({ include: { image: { select: { id: true, url: true } }, banner: { select: { id: true, url: true } }, attributes: { orderBy: { position: "asc" }, select: { attributeId: true } } } }),
    db.attribute.findMany({ where: { isFilterable: true }, orderBy: { position: "asc" }, select: { id: true, name: true } }),
    db.productCategory.groupBy({ by: ["categoryId"], _count: { _all: true } }),
  ]);
  const count = new Map(counts.map((c) => [c.categoryId, c._count._all]));
  return {
    rows: sortTree(rows).map((c) => ({
      id: c.id,
      parentId: c.parentId,
      depth: c.depth,
      slug: c.slug,
      fullSlug: c.fullSlug,
      name: c.name as Record<string, string>,
      label: t(c.name, locale),
      description: c.description as Record<string, string>,
      icon: c.icon,
      image: c.image,
      banner: c.banner,
      isActive: c.isActive,
      isFeatured: c.isFeatured,
      position: c.position,
      attributeIds: c.attributes.map((a) => a.attributeId),
      seo: seoOut(c.seo),
      products: count.get(c.id) ?? 0,
      children: rows.filter((r) => r.parentId === c.id).length,
    })),
    attributes: attributes.map((a) => ({ id: a.id, name: t(a.name, locale) })),
  };
}

export const categorySchema = z.object({
  name: localized({ required: true, max: 120 }),
  slug: z.string().max(80).optional(),
  parentId: z.string().nullable(),
  description: lt,
  icon: iconSchema,
  imageId: z.string().nullable().optional(),
  bannerId: z.string().nullable().optional(),
  isActive: z.boolean(),
  isFeatured: z.boolean(),
  attributeIds: z.array(z.string()).max(40),
  seo: seoSchema,
});

export async function saveCategory(id: string | null, raw: unknown, staff: CurrentStaff) {
  const p = categorySchema.parse(raw);
  const slug = slugify(p.slug || p.name.en || p.name.ar || "") || "category";
  const parent = p.parentId ? await db.category.findUnique({ where: { id: p.parentId } }) : null;
  if (p.parentId && !parent) throw Errors.notFound("parent");
  const clash = await db.category.findFirst({ where: { parentId: p.parentId, slug, ...(id ? { id: { not: id } } : {}) } });
  if (clash) throw Errors.invalid({ slug: ["slug_taken"] });

  const base = { name: p.name, description: p.description, icon: p.icon ?? null, imageId: p.imageId ?? null, bannerId: p.bannerId ?? null, isActive: p.isActive, isFeatured: p.isFeatured, seo: seoIn(p.seo) };
  const result = await db.$transaction(async (tx) => {
    let catId: string;
    if (!id) {
      const position = await tx.category.count({ where: { parentId: p.parentId } });
      const tmp = await tx.category.create({ data: { ...base, slug, parentId: p.parentId, fullSlug: `__tmp_${Date.now()}`, path: "/tmp/", position } });
      const path = buildPath(parent?.path ?? null, tmp.id);
      await tx.category.update({ where: { id: tmp.id }, data: { path, depth: depthOf(path), fullSlug: buildFullSlug(parent?.fullSlug ?? null, slug) } });
      catId = tmp.id;
    } else {
      const current = await tx.category.findUniqueOrThrow({ where: { id } });
      if (parent && wouldCreateCycle(current.path, parent.path)) throw new AppError("category_cycle", 422);
      await tx.category.update({ where: { id }, data: { ...base, slug, parentId: p.parentId } });
      const newPath = buildPath(parent?.path ?? null, id);
      const newFull = buildFullSlug(parent?.fullSlug ?? null, slug);
      if (newPath !== current.path || newFull !== current.fullSlug) {
        // Moving/renaming rewrites the whole subtree's path and URLs in one go.
        const subtree = await tx.category.findMany({ where: { path: { startsWith: current.path } }, select: { id: true, path: true, fullSlug: true } });
        for (const u of rebaseSubtree(subtree, current.path, newPath, current.fullSlug, newFull)) {
          await tx.category.update({ where: { id: u.id }, data: { path: u.path, fullSlug: u.fullSlug, depth: u.depth } });
        }
      }
      catId = id;
    }
    await tx.categoryAttribute.deleteMany({ where: { categoryId: catId } });
    if (p.attributeIds.length) await tx.categoryAttribute.createMany({ data: p.attributeIds.map((attributeId, position) => ({ categoryId: catId, attributeId, position })) });
    return catId;
  });
  await audit({ actor: staff, action: id ? "category.updated" : "category.created", entityType: "category", entityId: result, summary: t(p.name, "en") });
  return { id: result };
}

export async function deleteCategory(id: string, staff: CurrentStaff) {
  const children = await db.category.count({ where: { parentId: id } });
  if (children) throw new AppError("category_has_children", 409);
  const productIds = (await db.productCategory.findMany({ where: { categoryId: id }, select: { productId: true } })).map((p) => p.productId);
  const c = await db.category.delete({ where: { id } });
  for (const pid of productIds) await refreshProductDerived(pid);
  await audit({ actor: staff, action: "category.deleted", entityType: "category", entityId: id, summary: t(c.name, "en") });
}

/** Persist a new sibling order (drag & drop). */
export async function reorderCategories(parentId: string | null, ids: string[], staff: CurrentStaff) {
  await db.$transaction(ids.map((id, position) => db.category.updateMany({ where: { id, parentId }, data: { position } })));
  await audit({ actor: staff, action: "category.reordered", entityType: "category", summary: `${ids.length} items` });
}

// ────────────────────────────────── Brands ──────────────────────────────────

export async function adminBrands(locale: string) {
  const rows = await db.brand.findMany({ orderBy: { position: "asc" }, include: { logo: { select: { id: true, url: true } }, banner: { select: { id: true, url: true } }, _count: { select: { products: true } } } });
  return rows.map((b) => ({
    id: b.id,
    slug: b.slug,
    name: b.name as Record<string, string>,
    label: t(b.name, locale),
    description: b.description as Record<string, string>,
    logo: b.logo,
    banner: b.banner,
    website: b.website ?? "",
    isActive: b.isActive,
    isFeatured: b.isFeatured,
    seo: seoOut(b.seo),
    products: b._count.products,
  }));
}

export const brandSchema = z.object({
  name: localized({ required: true, max: 120 }),
  slug: z.string().max(80).optional(),
  description: lt,
  logoId: z.string().nullable().optional(),
  bannerId: z.string().nullable().optional(),
  website: z.union([z.string().url(), z.literal("")]).optional(),
  isActive: z.boolean(),
  isFeatured: z.boolean(),
  seo: seoSchema,
});

export async function saveBrand(id: string | null, raw: unknown, staff: CurrentStaff) {
  const p = brandSchema.parse(raw);
  const slug = slugify(p.slug || p.name.en || p.name.ar || "") || "brand";
  if (await db.brand.findFirst({ where: { slug, ...(id ? { id: { not: id } } : {}) } })) throw Errors.invalid({ slug: ["slug_taken"] });
  const data = { slug, name: p.name, description: p.description, logoId: p.logoId ?? null, bannerId: p.bannerId ?? null, website: p.website || null, isActive: p.isActive, isFeatured: p.isFeatured, seo: seoIn(p.seo) };
  const b = id ? await db.brand.update({ where: { id }, data }) : await db.brand.create({ data: { ...data, position: await db.brand.count() } });
  if (id) for (const pr of await db.product.findMany({ where: { brandId: id }, select: { id: true } })) await refreshProductDerived(pr.id);
  await audit({ actor: staff, action: id ? "brand.updated" : "brand.created", entityType: "brand", entityId: b.id, summary: t(p.name, "en") });
  return { id: b.id };
}

export async function deleteBrand(id: string, staff: CurrentStaff) {
  const b = await db.brand.delete({ where: { id } });
  await audit({ actor: staff, action: "brand.deleted", entityType: "brand", entityId: id, summary: t(b.name, "en") });
}

export async function reorderBrands(ids: string[]) {
  await db.$transaction(ids.map((id, position) => db.brand.update({ where: { id }, data: { position } })));
}

// ──────────────────────────────── Attributes ────────────────────────────────

export async function adminAttributes(locale: string) {
  const [rows, groups, usage] = await Promise.all([
    db.attribute.findMany({ orderBy: { position: "asc" }, include: { values: { orderBy: { position: "asc" } }, group: true } }),
    db.attributeGroup.findMany({ orderBy: { position: "asc" } }),
    db.productAttribute.groupBy({ by: ["attributeId"], _count: { _all: true } }),
  ]);
  const used = new Map(usage.map((u) => [u.attributeId, u._count._all]));
  return {
    rows: rows.map((a) => ({
      id: a.id,
      key: a.key,
      name: a.name as Record<string, string>,
      label: t(a.name, locale),
      type: a.type,
      unit: a.unit ?? "",
      icon: a.icon,
      groupId: a.groupId,
      group: a.group ? t(a.group.name, locale) : null,
      isFilterable: a.isFilterable,
      showOnCard: a.showOnCard,
      isVariantOption: a.isVariantOption,
      isVisible: a.isVisible,
      isHighlighted: a.isHighlighted,
      products: used.get(a.id) ?? 0,
      values: a.values.map((v) => ({ id: v.id, slug: v.slug, label: v.label as Record<string, string>, colorHex: v.colorHex ?? "" })),
    })),
    groups: groups.map((g) => ({ id: g.id, key: g.key, name: g.name as Record<string, string>, label: t(g.name, locale), icon: g.icon })),
  };
}

export const attributeSchema = z.object({
  key: z.string().trim().max(60).optional(),
  name: localized({ required: true, max: 80 }),
  type: z.enum(["SELECT", "MULTISELECT", "COLOR", "TEXT", "NUMBER", "BOOLEAN"]),
  unit: z.string().max(20).optional(),
  icon: iconSchema,
  groupId: z.string().nullable().optional(),
  isFilterable: z.boolean(),
  isVariantOption: z.boolean(),
  isVisible: z.boolean(),
  isHighlighted: z.boolean().default(false),
  showOnCard: z.boolean().default(false),
  values: z
    .array(z.object({ id: z.string().optional(), slug: z.string().max(60).optional(), label: localized({ required: true, max: 80 }), colorHex: z.union([z.string().regex(/^#[0-9a-f]{6}$/i), z.literal("")]).optional() }))
    .max(300),
});

export async function saveAttribute(id: string | null, raw: unknown, staff: CurrentStaff) {
  const p = attributeSchema.parse(raw);
  const key = slugify(p.key || p.name.en || "") || `attr-${Date.now()}`;
  if (await db.attribute.findFirst({ where: { key, ...(id ? { id: { not: id } } : {}) } })) throw Errors.invalid({ key: ["key_taken"] });
  const attrId = await db.$transaction(async (tx) => {
    const data = { key, name: p.name, type: p.type, unit: p.unit || null, icon: p.icon ?? null, groupId: p.groupId || null, isFilterable: p.isFilterable, isVariantOption: p.isVariantOption, isVisible: p.isVisible, isHighlighted: p.isHighlighted, showOnCard: p.showOnCard };
    const a = id ? await tx.attribute.update({ where: { id }, data }) : await tx.attribute.create({ data: { ...data, position: await tx.attribute.count() } });
    const keep = p.values.map((v) => v.id).filter(Boolean) as string[];
    await tx.attributeValue.deleteMany({ where: { attributeId: a.id, id: { notIn: keep } } });
    const slugs = new Set<string>();
    for (const [i, v] of p.values.entries()) {
      let vslug = slugify(v.slug || v.label.en || v.label.ar || "") || `v${i}`;
      while (slugs.has(vslug)) vslug = `${vslug}-${i}`;
      slugs.add(vslug);
      const vd = { slug: vslug, label: v.label, colorHex: v.colorHex || null, position: i };
      if (v.id) await tx.attributeValue.update({ where: { id: v.id }, data: vd });
      else await tx.attributeValue.create({ data: { ...vd, attributeId: a.id } });
    }
    return a.id;
  });
  await audit({ actor: staff, action: id ? "attribute.updated" : "attribute.created", entityType: "attribute", entityId: attrId, summary: t(p.name, "en") });
  return { id: attrId };
}

export async function deleteAttribute(id: string, staff: CurrentStaff) {
  const a = await db.attribute.delete({ where: { id } });
  await audit({ actor: staff, action: "attribute.deleted", entityType: "attribute", entityId: id, summary: t(a.name, "en") });
}

export const groupSchema = z.object({ key: z.string().max(40).optional(), name: localized({ required: true, max: 60 }), icon: iconSchema });

export async function saveAttributeGroup(id: string | null, raw: unknown) {
  const p = groupSchema.parse(raw);
  const key = slugify(p.key || p.name.en || "") || `group-${Date.now()}`;
  const data = { key, name: p.name, icon: p.icon ?? null };
  return id ? db.attributeGroup.update({ where: { id }, data }) : db.attributeGroup.create({ data: { ...data, position: await db.attributeGroup.count() } });
}

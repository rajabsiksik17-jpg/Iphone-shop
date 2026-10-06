import "server-only";
import { z } from "zod";
import { db, Prisma } from "../db";
import { AppError, Errors } from "../errors";
import { audit, diff } from "../audit";
import { refreshProductDerived } from "../catalog/derived";
import { applyStockChange, afterStockChange } from "../catalog/inventory";
import { sanitizeRich } from "../sanitize";
import { localized } from "@/lib/i18n-text";
import { slugify } from "@/lib/utils";
import { t } from "@/lib/i18n-text";
import type { CurrentStaff } from "../auth/session";

export const PRODUCT_PAGE_SIZE = 30;

export type ProductListQuery = { q?: string; status?: string; brand?: string; category?: string; stock?: string; sort?: string; page?: number };

export async function listAdminProducts(q: ProductListQuery, locale: string) {
  const page = Math.max(1, q.page ?? 1);
  const and: Prisma.ProductWhereInput[] = [];
  if (q.q) and.push({ OR: [{ searchText: { contains: q.q.toLowerCase() } }, { sku: { contains: q.q, mode: "insensitive" } }, { variants: { some: { sku: { contains: q.q, mode: "insensitive" } } } }] });
  if (q.status) and.push({ status: q.status as "ACTIVE" });
  if (q.brand) and.push({ brandId: q.brand });
  if (q.category) {
    const c = await db.category.findUnique({ where: { id: q.category }, select: { path: true } });
    if (c) and.push({ categories: { some: { category: { path: { startsWith: c.path } } } } });
  }
  if (q.stock === "low") and.push({ stockStatus: "LOW_STOCK" });
  if (q.stock === "out") and.push({ stockStatus: "OUT_OF_STOCK" });
  if (q.stock === "sale") and.push({ onSale: true });
  const where = and.length ? { AND: and } : {};
  const orderBy: Prisma.ProductOrderByWithRelationInput =
    q.sort === "name" ? { slug: "asc" } : q.sort === "price" ? { effectivePrice: "asc" } : q.sort === "-price" ? { effectivePrice: "desc" } : q.sort === "stock" ? { stock: "asc" } : q.sort === "sales" ? { salesCount: "desc" } : { updatedAt: "desc" };
  const [rows, total, brands, categories, statusCounts] = await Promise.all([
    db.product.findMany({
      where,
      orderBy,
      skip: (page - 1) * PRODUCT_PAGE_SIZE,
      take: PRODUCT_PAGE_SIZE,
      include: { brand: { select: { name: true } }, images: { take: 1, orderBy: { position: "asc" }, include: { media: { select: { url: true } } } }, _count: { select: { variants: true } } },
    }),
    db.product.count({ where }),
    db.brand.findMany({ orderBy: { position: "asc" }, select: { id: true, name: true } }),
    db.category.findMany({ orderBy: [{ path: "asc" }], select: { id: true, name: true, depth: true, path: true, position: true } }),
    db.product.groupBy({ by: ["status"], _count: { _all: true } }),
  ]);
  return {
    rows: rows.map((p) => ({
      id: p.id,
      slug: p.slug,
      name: t(p.name, locale),
      sku: p.sku,
      brand: p.brand ? t(p.brand.name, locale) : null,
      image: p.images[0]?.media.url ?? null,
      price: p.effectivePrice,
      maxPrice: p.maxPrice,
      onSale: p.onSale,
      stock: p.stock,
      trackInventory: p.trackInventory,
      stockStatus: p.stockStatus,
      status: p.status,
      type: p.type,
      variants: p._count.variants,
      isFeatured: p.isFeatured,
      updatedAt: p.updatedAt.toISOString(),
    })),
    total,
    page,
    pageCount: Math.max(1, Math.ceil(total / PRODUCT_PAGE_SIZE)),
    brands: brands.map((b) => ({ id: b.id, name: t(b.name, locale) })),
    categories: sortTree(categories).map((c) => ({ id: c.id, name: t(c.name, locale), depth: c.depth })),
    statusCounts: Object.fromEntries(statusCounts.map((s) => [s.status, s._count._all])) as Record<string, number>,
  };
}

/** Depth-first ordering of a flat category list (by path then position). */
export function sortTree<T extends { id: string; path: string; position: number }>(rows: T[]): T[] {
  const byParent = new Map<string, T[]>();
  for (const r of rows) {
    const ids = r.path.split("/").filter(Boolean);
    const parent = ids.length > 1 ? ids[ids.length - 2] : "";
    (byParent.get(parent) ?? byParent.set(parent, []).get(parent)!).push(r);
  }
  const out: T[] = [];
  const walk = (parent: string) => {
    for (const c of (byParent.get(parent) ?? []).sort((a, b) => a.position - b.position)) {
      out.push(c);
      walk(c.id);
    }
  };
  walk("");
  return out;
}

// ─────────────────────────────── Editor data ────────────────────────────────

export async function productEditorData(id: string | null, locale: string) {
  const [brands, categories, attributes, groups, product] = await Promise.all([
    db.brand.findMany({ orderBy: { position: "asc" }, select: { id: true, name: true } }),
    db.category.findMany({ select: { id: true, name: true, depth: true, path: true, position: true } }),
    db.attribute.findMany({ orderBy: { position: "asc" }, include: { values: { orderBy: { position: "asc" } }, group: true } }),
    db.attributeGroup.findMany({ orderBy: { position: "asc" } }),
    id
      ? db.product.findUnique({
          where: { id },
          include: {
            categories: true,
            tags: { include: { tag: true } },
            images: { orderBy: { position: "asc" }, include: { media: true } },
            attributes: { include: { values: true } },
            variants: { orderBy: { position: "asc" }, include: { options: true, image: { select: { id: true, url: true } } } },
            relations: { orderBy: { position: "asc" }, include: { related: { select: { id: true, name: true, images: { take: 1, include: { media: { select: { url: true } } } } } } } },
          },
        })
      : null,
  ]);
  const lists = {
    brands: brands.map((b) => ({ id: b.id, name: t(b.name, locale) })),
    categories: sortTree(categories).map((c) => ({ id: c.id, name: t(c.name, locale), depth: c.depth })),
    attributes: attributes.map((a) => ({
      id: a.id,
      key: a.key,
      name: t(a.name, locale),
      type: a.type,
      unit: a.unit,
      icon: a.icon,
      group: a.group ? t(a.group.name, locale) : null,
      isVariantOption: a.isVariantOption,
      values: a.values.map((v) => ({ id: v.id, label: t(v.label, locale), colorHex: v.colorHex })),
    })),
    groups: groups.map((g) => ({ id: g.id, name: t(g.name, locale) })),
  };
  if (!product) return { lists, product: null };
  const seo = (product.seo ?? {}) as Record<string, unknown>;
  const rel = (type: string) =>
    product.relations.filter((r) => r.type === type).map((r) => ({ id: r.related.id, name: t(r.related.name, locale), image: r.related.images[0]?.media.url ?? null }));
  return {
    lists,
    product: {
      id: product.id,
      name: product.name as Record<string, string>,
      slug: product.slug,
      sku: product.sku ?? "",
      barcode: product.barcode ?? "",
      modelNumber: product.modelNumber ?? "",
      manufacturer: product.manufacturer ?? "",
      countryOfOrigin: product.countryOfOrigin ?? "",
      condition: product.condition,
      shortDescription: product.shortDescription as Record<string, string>,
      description: product.description as Record<string, string>,
      type: product.type,
      status: product.status,
      visibility: product.visibility,
      publishedAt: product.publishedAt?.toISOString() ?? null,
      brandId: product.brandId,
      categoryIds: product.categories.map((c) => c.categoryId),
      primaryCategoryId: (product.categories.find((c) => c.isPrimary)?.categoryId ?? product.categories[0]?.categoryId ?? null) as string | null,
      tags: product.tags.map((x) => t(x.tag.name, "en") || x.tag.slug),
      price: product.price,
      salePrice: product.salePrice,
      saleStartsAt: product.saleStartsAt?.toISOString() ?? null,
      saleEndsAt: product.saleEndsAt?.toISOString() ?? null,
      costPrice: product.costPrice,
      trackInventory: product.trackInventory,
      stock: product.stock,
      lowStockThreshold: product.lowStockThreshold,
      allowBackorder: product.allowBackorder,
      minQty: product.minQty,
      maxQty: product.maxQty,
      requiresShipping: product.requiresShipping,
      weightGrams: product.weightGrams,
      lengthMm: product.lengthMm,
      widthMm: product.widthMm,
      heightMm: product.heightMm,
      warranty: product.warranty as Record<string, string>,
      videoUrl: product.videoUrl ?? "",
      isFeatured: product.isFeatured,
      isNew: product.isNew,
      isBestSeller: product.isBestSeller,
      isLimited: product.isLimited,
      images: product.images.map((i) => ({ mediaId: i.mediaId, url: i.media.url, valueId: i.valueId, alt: i.alt as Record<string, string> })),
      attributes: product.attributes.map((a) => ({
        attributeId: a.attributeId,
        usedForVariations: a.usedForVariations,
        valueIds: a.values.map((v) => v.valueId),
        textValue: (a.textValue ?? {}) as Record<string, string>,
        numberValue: a.numberValue,
        boolValue: a.boolValue,
      })),
      variants: product.variants.map((v) => ({
        id: v.id,
        sku: v.sku ?? "",
        barcode: v.barcode ?? "",
        price: v.price,
        salePrice: v.salePrice,
        stock: v.stock,
        weightGrams: v.weightGrams,
        imageId: v.imageId,
        imageUrl: v.image?.url ?? null,
        isActive: v.isActive,
        options: Object.fromEntries(v.options.map((o) => [o.attributeId, o.valueId])),
      })),
      relations: { related: rel("RELATED"), upsell: rel("UPSELL"), crossSell: rel("CROSS_SELL") },
      seo: {
        title: (seo.title ?? {}) as Record<string, string>,
        description: (seo.description ?? {}) as Record<string, string>,
        canonical: (seo.canonical as string) ?? "",
        ogImage: (seo.ogImage as string) ?? "",
        noindex: seo.noindex === true,
      },
      updatedAt: product.updatedAt.toISOString(),
    },
  };
}

export type ProductEditorData = Awaited<ReturnType<typeof productEditorData>>;
export type ProductForm = NonNullable<ProductEditorData["product"]>;

// ───────────────────────────────── Saving ───────────────────────────────────

const lt = localized({ max: 50_000 });
const money = z.number().int().min(0).max(1_000_000_000);
const optMoney = money.nullable().optional();
const dateStr = z.string().datetime().nullable().optional();

export const productSchema = z
  .object({
    name: localized({ required: true, max: 200 }),
    slug: z.string().trim().max(120).optional(),
    sku: z.string().trim().max(64).optional(),
    barcode: z.string().trim().max(64).optional(),
    modelNumber: z.string().trim().max(64).optional(),
    manufacturer: z.string().trim().max(120).optional(),
    countryOfOrigin: z.union([z.string().length(2), z.literal("")]).optional(),
    condition: z.enum(["NEW", "REFURBISHED", "OPEN_BOX", "USED"]),
    shortDescription: lt,
    description: lt,
    type: z.enum(["SIMPLE", "VARIABLE"]),
    status: z.enum(["DRAFT", "ACTIVE", "ARCHIVED"]),
    visibility: z.enum(["VISIBLE", "CATALOG_ONLY", "SEARCH_ONLY", "HIDDEN"]),
    publishedAt: dateStr,
    brandId: z.string().nullable().optional(),
    categoryIds: z.array(z.string()).max(30),
    primaryCategoryId: z.string().nullable().optional(),
    tags: z.array(z.string().trim().min(1).max(40)).max(30),
    price: money,
    salePrice: optMoney,
    saleStartsAt: dateStr,
    saleEndsAt: dateStr,
    costPrice: optMoney,
    trackInventory: z.boolean(),
    stock: z.number().int().min(-1_000_000).max(1_000_000),
    lowStockThreshold: z.number().int().min(0).max(100_000).nullable().optional(),
    allowBackorder: z.boolean(),
    minQty: z.number().int().min(1).max(999),
    maxQty: z.number().int().min(1).max(9999).nullable().optional(),
    requiresShipping: z.boolean(),
    weightGrams: z.number().int().min(0).max(1_000_000).nullable().optional(),
    lengthMm: z.number().int().min(0).nullable().optional(),
    widthMm: z.number().int().min(0).nullable().optional(),
    heightMm: z.number().int().min(0).nullable().optional(),
    warranty: lt,
    videoUrl: z.union([z.string().url().max(500), z.literal("")]).optional(),
    isFeatured: z.boolean(),
    isNew: z.boolean(),
    isBestSeller: z.boolean(),
    isLimited: z.boolean(),
    images: z.array(z.object({ mediaId: z.string(), valueId: z.string().nullable().optional(), alt: lt.optional() })).max(30),
    attributes: z
      .array(
        z.object({
          attributeId: z.string(),
          usedForVariations: z.boolean(),
          valueIds: z.array(z.string()).max(50),
          textValue: lt.optional(),
          numberValue: z.number().nullable().optional(),
          boolValue: z.boolean().nullable().optional(),
        }),
      )
      .max(80),
    variants: z
      .array(
        z.object({
          id: z.string().optional(),
          sku: z.string().trim().max(64).optional(),
          barcode: z.string().trim().max(64).optional(),
          price: optMoney,
          salePrice: optMoney,
          stock: z.number().int().min(-1_000_000).max(1_000_000),
          weightGrams: z.number().int().min(0).nullable().optional(),
          imageId: z.string().nullable().optional(),
          isActive: z.boolean(),
          options: z.record(z.string(), z.string()),
        }),
      )
      .max(300),
    relations: z.object({ related: z.array(z.string()).max(24), upsell: z.array(z.string()).max(24), crossSell: z.array(z.string()).max(12) }),
    seo: z.object({ title: lt, description: lt, canonical: z.union([z.string().url(), z.literal("")]), ogImage: z.string().max(500), noindex: z.boolean() }),
  })
  .superRefine((p, ctx) => {
    if (p.salePrice != null && p.salePrice >= p.price) ctx.addIssue({ code: "custom", path: ["salePrice"], message: "sale_not_lower" });
    if (p.saleStartsAt && p.saleEndsAt && p.saleStartsAt >= p.saleEndsAt) ctx.addIssue({ code: "custom", path: ["saleEndsAt"], message: "end_before_start" });
    if (p.type === "VARIABLE" && p.status === "ACTIVE" && !p.variants.some((v) => v.isActive)) ctx.addIssue({ code: "custom", path: ["variants"], message: "variants_required" });
    const combos = new Set<string>();
    for (const [i, v] of p.variants.entries()) {
      const key = Object.entries(v.options).sort().map((e) => e.join("=")).join("&");
      if (combos.has(key)) ctx.addIssue({ code: "custom", path: ["variants", i], message: "duplicate_variant" });
      combos.add(key);
      if (v.salePrice != null && v.salePrice >= (v.price ?? p.price)) ctx.addIssue({ code: "custom", path: ["variants", i, "salePrice"], message: "sale_not_lower" });
    }
  });

export type ProductInput = z.infer<typeof productSchema>;

async function uniqueSlug(base: string, excludeId?: string) {
  const root = slugify(base) || "product";
  let slug = root;
  for (let i = 2; await db.product.findFirst({ where: { slug, ...(excludeId ? { id: { not: excludeId } } : {}) }, select: { id: true } }); i++) slug = `${root}-${i}`;
  return slug;
}

export async function saveProduct(id: string | null, raw: unknown, staff: CurrentStaff) {
  const p = productSchema.parse(raw);
  const existing = id ? await db.product.findUnique({ where: { id }, include: { variants: true } }) : null;
  if (id && !existing) throw Errors.notFound("product");

  const slug = await uniqueSlug(p.slug || p.name.en || p.name.ar || "product", id ?? undefined);
  if (p.sku) {
    const clash = await db.product.findFirst({ where: { sku: p.sku, ...(id ? { id: { not: id } } : {}) }, select: { id: true } });
    if (clash) throw Errors.invalid({ sku: ["sku_taken"] });
  }
  const variantSkus = p.variants.map((v) => v.sku).filter(Boolean) as string[];
  if (new Set(variantSkus).size !== variantSkus.length) throw Errors.invalid({ variants: ["duplicate_sku"] });
  if (variantSkus.length) {
    const clash = await db.productVariant.findFirst({ where: { sku: { in: variantSkus }, ...(id ? { productId: { not: id } } : {}) }, select: { sku: true } });
    if (clash) throw Errors.invalid({ variants: [`sku_taken:${clash.sku}`] });
  }

  const sanitizedDescription = Object.fromEntries(Object.entries(p.description).map(([k, v]) => [k, sanitizeRich(v ?? "")]));
  const data = {
    slug,
    sku: p.sku || null,
    barcode: p.barcode || null,
    modelNumber: p.modelNumber || null,
    manufacturer: p.manufacturer || null,
    countryOfOrigin: p.countryOfOrigin || null,
    condition: p.condition,
    name: p.name,
    shortDescription: p.shortDescription,
    description: sanitizedDescription,
    type: p.type,
    status: p.status,
    visibility: p.visibility,
    publishedAt: p.publishedAt ? new Date(p.publishedAt) : p.status === "ACTIVE" ? (existing?.publishedAt ?? new Date()) : null,
    brandId: p.brandId || null,
    price: p.price,
    salePrice: p.salePrice ?? null,
    saleStartsAt: p.saleStartsAt ? new Date(p.saleStartsAt) : null,
    saleEndsAt: p.saleEndsAt ? new Date(p.saleEndsAt) : null,
    costPrice: p.costPrice ?? null,
    trackInventory: p.trackInventory,
    lowStockThreshold: p.lowStockThreshold ?? null,
    allowBackorder: p.allowBackorder,
    minQty: p.minQty,
    maxQty: p.maxQty ?? null,
    requiresShipping: p.requiresShipping,
    weightGrams: p.weightGrams ?? null,
    lengthMm: p.lengthMm ?? null,
    widthMm: p.widthMm ?? null,
    heightMm: p.heightMm ?? null,
    warranty: p.warranty,
    videoUrl: p.videoUrl || null,
    isFeatured: p.isFeatured,
    isNew: p.isNew,
    isBestSeller: p.isBestSeller,
    isLimited: p.isLimited,
    seo: { title: p.seo.title, description: p.seo.description, canonical: p.seo.canonical || undefined, ogImage: p.seo.ogImage || undefined, noindex: p.seo.noindex },
  };

  const stockEvents: { productId: string; variantId: string | null; balance: number; previous: number }[] = [];
  const productId = await db.$transaction(
    async (tx) => {
      const prod = id ? await tx.product.update({ where: { id }, data }) : await tx.product.create({ data: { ...data, stock: 0 } });
      const pid = prod.id;

      // Categories
      await tx.productCategory.deleteMany({ where: { productId: pid } });
      const primary = p.primaryCategoryId && p.categoryIds.includes(p.primaryCategoryId) ? p.primaryCategoryId : p.categoryIds[0];
      if (p.categoryIds.length) await tx.productCategory.createMany({ data: [...new Set(p.categoryIds)].map((c) => ({ productId: pid, categoryId: c, isPrimary: c === primary })) });

      // Tags (created on the fly)
      await tx.productTag.deleteMany({ where: { productId: pid } });
      for (const name of [...new Set(p.tags)]) {
        const tslug = slugify(name) || name.toLowerCase();
        const tag = await tx.tag.upsert({ where: { slug: tslug }, create: { slug: tslug, name: { en: name, ar: name } }, update: {} });
        await tx.productTag.create({ data: { productId: pid, tagId: tag.id } });
      }

      // Images
      await tx.productImage.deleteMany({ where: { productId: pid } });
      if (p.images.length) await tx.productImage.createMany({ data: p.images.map((img, i) => ({ productId: pid, mediaId: img.mediaId, valueId: img.valueId || null, alt: img.alt ?? {}, position: i })) });

      // Attributes / specifications. Variation attributes always carry the
      // union of values used by variants so filters stay accurate.
      const variantValues = new Map<string, Set<string>>();
      for (const v of p.variants) for (const [a, val] of Object.entries(v.options)) (variantValues.get(a) ?? variantValues.set(a, new Set()).get(a)!).add(val);
      await tx.productAttribute.deleteMany({ where: { productId: pid } });
      for (const [i, a] of p.attributes.entries()) {
        const valueIds = a.usedForVariations ? [...new Set([...a.valueIds, ...(variantValues.get(a.attributeId) ?? [])])] : a.valueIds;
        const hasText = a.textValue && Object.values(a.textValue).some((x) => x?.trim());
        if (!valueIds.length && !hasText && a.numberValue == null && a.boolValue == null) continue;
        await tx.productAttribute.create({
          data: {
            productId: pid,
            attributeId: a.attributeId,
            usedForVariations: a.usedForVariations,
            position: i,
            textValue: hasText ? a.textValue : undefined,
            numberValue: a.numberValue ?? null,
            boolValue: a.boolValue ?? null,
            values: { create: valueIds.map((valueId) => ({ valueId })) },
          },
        });
      }

      // Stock (simple): go through the ledger so history stays complete.
      if (p.type === "SIMPLE" && p.trackInventory) {
        const current = existing?.stock ?? 0;
        if (p.stock !== current) {
          const r = await applyStockChange({ productId: pid, delta: p.stock - current, reason: existing ? "ADJUSTMENT" : "INITIAL", note: "Product editor", userId: staff.id }, tx);
          if (r) stockEvents.push({ productId: pid, variantId: null, balance: r.balance, previous: current });
        }
      }

      // Variants
      const keepIds = new Set(p.variants.map((v) => v.id).filter(Boolean) as string[]);
      if (p.type === "SIMPLE") await tx.productVariant.deleteMany({ where: { productId: pid } });
      else await tx.productVariant.deleteMany({ where: { productId: pid, id: { notIn: [...keepIds] } } });
      if (p.type === "VARIABLE") {
        for (const [i, v] of p.variants.entries()) {
          const vdata = { sku: v.sku || null, barcode: v.barcode || null, price: v.price ?? null, salePrice: v.salePrice ?? null, weightGrams: v.weightGrams ?? null, imageId: v.imageId || null, isActive: v.isActive, position: i };
          const prev = v.id ? existing?.variants.find((x) => x.id === v.id) : undefined;
          let variantId: string;
          if (prev) {
            await tx.productVariant.update({ where: { id: prev.id }, data: vdata });
            variantId = prev.id;
            await tx.variantOption.deleteMany({ where: { variantId } });
          } else {
            variantId = (await tx.productVariant.create({ data: { ...vdata, productId: pid, stock: 0 } })).id;
          }
          await tx.variantOption.createMany({ data: Object.entries(v.options).map(([attributeId, valueId]) => ({ variantId, attributeId, valueId })) });
          const current = prev?.stock ?? 0;
          if (v.stock !== current) {
            const r = await applyStockChange({ productId: pid, variantId, delta: v.stock - current, reason: prev ? "ADJUSTMENT" : "INITIAL", note: "Product editor", userId: staff.id }, tx);
            if (r) stockEvents.push({ productId: pid, variantId, balance: r.balance, previous: current });
          }
        }
      }

      // Relations
      await tx.productRelation.deleteMany({ where: { productId: pid } });
      const rel = [
        ...p.relations.related.map((r, i) => ({ relatedId: r, type: "RELATED" as const, position: i })),
        ...p.relations.upsell.map((r, i) => ({ relatedId: r, type: "UPSELL" as const, position: i })),
        ...p.relations.crossSell.map((r, i) => ({ relatedId: r, type: "CROSS_SELL" as const, position: i })),
      ].filter((r) => r.relatedId !== pid);
      if (rel.length) await tx.productRelation.createMany({ data: rel.map((r) => ({ ...r, productId: pid })), skipDuplicates: true });
      return pid;
    },
    { timeout: 30_000 },
  );

  await refreshProductDerived(productId);
  for (const s of stockEvents) await afterStockChange(s.productId, s.variantId, s.balance, s.previous);
  await audit({
    actor: staff,
    action: id ? "product.updated" : "product.created",
    entityType: "product",
    entityId: productId,
    summary: t(p.name, "en"),
    changes: existing ? diff(existing as unknown as Record<string, unknown>, data as unknown as Record<string, unknown>, ["price", "salePrice", "status", "costPrice", "visibility"]) : {},
  });
  return { id: productId, slug };
}

export async function duplicateProduct(id: string, staff: CurrentStaff) {
  const src = await productEditorData(id, "en");
  if (!src.product) throw Errors.notFound("product");
  const p = src.product;
  const copy = await saveProduct(
    null,
    {
      ...p,
      name: Object.fromEntries(Object.entries(p.name).map(([k, v]) => [k, `${v} (copy)`])),
      slug: `${p.slug}-copy`,
      sku: "",
      status: "DRAFT",
      publishedAt: null,
      tags: p.tags,
      images: p.images.map((i) => ({ mediaId: i.mediaId, valueId: i.valueId, alt: i.alt })),
      variants: p.variants.map((v) => ({ ...v, id: undefined, sku: "", imageId: v.imageId, options: v.options })),
      relations: { related: p.relations.related.map((r) => r.id), upsell: p.relations.upsell.map((r) => r.id), crossSell: p.relations.crossSell.map((r) => r.id) },
      seo: { ...p.seo, canonical: "" },
    },
    staff,
  );
  await audit({ actor: staff, action: "product.duplicated", entityType: "product", entityId: copy.id, summary: `from ${id}` });
  return copy;
}

/** Products with order history are archived (history must stay intact); others are deleted. */
export async function deleteProducts(ids: string[], staff: CurrentStaff) {
  const withOrders = new Set((await db.orderItem.findMany({ where: { productId: { in: ids } }, select: { productId: true }, distinct: ["productId"] })).map((x) => x.productId!));
  const archive = ids.filter((i) => withOrders.has(i));
  const remove = ids.filter((i) => !withOrders.has(i));
  if (archive.length) await db.product.updateMany({ where: { id: { in: archive } }, data: { status: "ARCHIVED" } });
  if (remove.length) await db.product.deleteMany({ where: { id: { in: remove } } });
  await audit({ actor: staff, action: "product.deleted", entityType: "product", summary: `${remove.length} deleted, ${archive.length} archived`, changes: { deleted: remove, archived: archive } });
  return { deleted: remove.length, archived: archive.length };
}

export const bulkSchema = z.discriminatedUnion("op", [
  z.object({ op: z.enum(["publish", "draft", "archive", "delete", "feature", "unfeature"]) }),
  z.object({ op: z.literal("category"), categoryId: z.string() }),
  z.object({ op: z.literal("brand"), brandId: z.string().nullable() }),
  z.object({ op: z.literal("price"), percent: z.number().min(-90).max(500) }),
  z.object({ op: z.literal("sale"), percent: z.number().min(0).max(95), endsAt: z.string().datetime().nullable().optional() }),
  z.object({ op: z.literal("stock"), stock: z.number().int().min(0).max(1_000_000) }),
]);

export async function bulkProducts(ids: string[], raw: unknown, staff: CurrentStaff) {
  const input = bulkSchema.parse(raw);
  if (!ids.length) throw new AppError("nothing_selected", 422);
  const round = (n: number) => Math.max(0, Math.round(n / 10) * 10);
  switch (input.op) {
    case "publish":
      await db.product.updateMany({ where: { id: { in: ids } }, data: { status: "ACTIVE" } });
      await db.product.updateMany({ where: { id: { in: ids }, publishedAt: null }, data: { publishedAt: new Date() } });
      break;
    case "draft":
      await db.product.updateMany({ where: { id: { in: ids } }, data: { status: "DRAFT" } });
      break;
    case "archive":
      await db.product.updateMany({ where: { id: { in: ids } }, data: { status: "ARCHIVED" } });
      break;
    case "delete":
      return deleteProducts(ids, staff);
    case "feature":
    case "unfeature":
      await db.product.updateMany({ where: { id: { in: ids } }, data: { isFeatured: input.op === "feature" } });
      break;
    case "category":
      await db.productCategory.createMany({ data: ids.map((productId) => ({ productId, categoryId: input.categoryId })), skipDuplicates: true });
      break;
    case "brand":
      await db.product.updateMany({ where: { id: { in: ids } }, data: { brandId: input.brandId } });
      break;
    case "price": {
      const f = 1 + input.percent / 100;
      for (const p of await db.product.findMany({ where: { id: { in: ids } }, include: { variants: true } })) {
        await db.product.update({ where: { id: p.id }, data: { price: round(p.price * f), salePrice: p.salePrice != null ? round(p.salePrice * f) : null } });
        for (const v of p.variants) if (v.price != null) await db.productVariant.update({ where: { id: v.id }, data: { price: round(v.price * f), salePrice: v.salePrice != null ? round(v.salePrice * f) : null } });
      }
      break;
    }
    case "sale": {
      const f = 1 - input.percent / 100;
      for (const p of await db.product.findMany({ where: { id: { in: ids } }, include: { variants: true } })) {
        await db.product.update({ where: { id: p.id }, data: input.percent === 0 ? { salePrice: null, saleEndsAt: null } : { salePrice: round(p.price * f), saleStartsAt: null, saleEndsAt: input.endsAt ? new Date(input.endsAt) : null } });
        for (const v of p.variants) if (v.price != null) await db.productVariant.update({ where: { id: v.id }, data: input.percent === 0 ? { salePrice: null } : { salePrice: round(v.price * f), saleEndsAt: input.endsAt ? new Date(input.endsAt) : null } });
      }
      break;
    }
    case "stock":
      for (const p of await db.product.findMany({ where: { id: { in: ids }, type: "SIMPLE", trackInventory: true } })) {
        if (p.stock === input.stock) continue;
        const r = await db.$transaction((tx) => applyStockChange({ productId: p.id, delta: input.stock - p.stock, reason: "ADJUSTMENT", note: "Bulk update", userId: staff.id }, tx));
        if (r) await afterStockChange(p.id, null, r.balance, p.stock);
      }
      break;
  }
  for (const id of ids) await refreshProductDerived(id);
  await audit({ actor: staff, action: `product.bulk_${input.op}`, entityType: "product", summary: `${ids.length} products`, changes: { ids, ...input } });
  return { updated: ids.length };
}

export async function searchProductsForPicker(q: string, locale: string, exclude: string[] = []) {
  const rows = await db.product.findMany({
    where: { ...(q ? { OR: [{ searchText: { contains: q.toLowerCase() } }, { sku: { contains: q, mode: "insensitive" } }] } : {}), id: { notIn: exclude } },
    take: 20,
    orderBy: { salesCount: "desc" },
    select: { id: true, name: true, sku: true, images: { take: 1, orderBy: { position: "asc" }, select: { media: { select: { url: true } } } } },
  });
  return rows.map((r) => ({ id: r.id, name: t(r.name, locale), sku: r.sku, image: r.images[0]?.media.url ?? null }));
}

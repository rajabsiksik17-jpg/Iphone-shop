import "server-only";
import sharp from "sharp";
import { z } from "zod";
import { db, dbAll, activeProfile, setActiveProfileCache, PROFILE_MODELS, Prisma } from "../db";
import { AppError, Errors } from "../errors";
import { audit } from "../audit";
import { getManySettings, getSettings, patchSettings } from "../settings/service";
import { processImage } from "../media/images";
import { refreshProductDerived } from "../catalog/derived";
import { invalidateCategoryCounts } from "../catalog/taxonomy";
import { buildFullSlug, buildPath, depthOf } from "@/lib/category-tree";
import { initialSectionData } from "@/cms/sections";
import { STORE_TYPES, storeTypeByKey, type PresetAttribute, type PresetCategory, type StoreTypePreset, type TrustConcept } from "@/config/store-types";
import { STORE_TEMPLATES, type SpecValue, type StoreTemplate, type TemplateProduct } from "@/config/store-templates";
import { heroArt, packshot, wordmark, type ArtKind } from "../templates/art";
import { slugify } from "@/lib/utils";
import { localized, t } from "@/lib/i18n-text";
import type { CurrentStaff } from "../auth/session";
import type { Settings } from "../settings/schemas";

/**
 * Store-type profiles.
 *
 * Each store type the store has used is a profile. Its catalog (categories,
 * brands, products), homepage (sections, hero slider) and presentation (card
 * specs, trust icons, product card) belong to it. Switching type:
 *   1. saves the current presentation into the current profile,
 *   2. initialises the target profile from its template the first time
 *      (one transaction — all or nothing), or simply re-selects it later,
 *   3. restores the target's presentation and makes it active.
 * Nothing is deleted, copied over or merged: rows stay where they are and the
 * active profile decides what's in scope (see PROFILE_MODELS in server/db).
 *
 * Shared across types: customers, orders, payments, coupons, pages other than
 * the homepage, menus, branding, contact details and every setting not listed
 * in ProfileOverrides. The attribute library is shared (keys like "color" are
 * reused) but which attributes a type shows on cards/filters is per profile.
 */

type T = { en: string; ar: string };
type ProductCard = Settings<"appearance">["productCard"];
type Icons = Settings<"storeType">["icons"];

/** Presentation saved per profile and restored when it becomes active again. */
export type ProfileOverrides = { cardAttributeKeys?: string[]; icons?: Icons; productCard?: ProductCard };
/** Bookkeeping kept with the profile (template refs it created, for safe template updates). */
type ProfileMeta = { refs?: string[] };

const CUSTOM_PREFIX = "custom-";
const isCustomKey = (key: string) => key.startsWith(CUSTOM_PREFIX);

// ────────────────────────────── Definitions ──────────────────────────────

const customDefinitionSchema = z.object({
  attributes: z.array(z.object({ key: z.string().regex(/^[a-z][a-z0-9-]{0,40}$/), name: localized({ required: true, max: 60 }), type: z.enum(["SELECT", "MULTISELECT", "COLOR", "TEXT", "NUMBER", "BOOLEAN"]), values: z.array(localized({ required: true, max: 60 })).max(40).optional(), filterable: z.boolean().optional(), highlighted: z.boolean().optional(), variant: z.boolean().optional(), icon: z.string().max(120).optional() })).max(30).default([]),
  categories: z.array(z.object({ name: localized({ required: true, max: 60 }), icon: z.string().max(120).optional(), children: z.array(z.object({ name: localized({ required: true, max: 60 }), icon: z.string().max(120).optional() })).max(20).optional() })).max(20).default([]),
  cardAttributes: z.array(z.string().max(40)).max(4).default([]),
  icons: z.object({ delivery: z.string().max(120), warranty: z.string().max(120), returns: z.string().max(120), payment: z.string().max(120) }).partial().default({}),
  homeSections: z.array(z.string().max(40)).max(14).default([]),
  terms: z.object({ product: localized({ max: 40 }), products: localized({ max: 40 }) }).partial().optional(),
  card: z.object({ imageRatio: z.enum(["1/1", "4/5", "3/4"]).optional(), showBrand: z.boolean().optional(), showRating: z.boolean().optional() }).optional(),
  theme: z.object({ from: z.string().regex(/^#[0-9a-f]{6}$/i), to: z.string().regex(/^#[0-9a-f]{6}$/i), accent: z.string().regex(/^#[0-9a-f]{6}$/i) }).optional(),
});
export type CustomDefinition = z.infer<typeof customDefinitionSchema>;

const STANDARD_ICONS: Record<TrustConcept, string> = { delivery: "lucide:Truck", warranty: "lucide:ShieldCheck", returns: "lucide:RotateCcw", payment: "lucide:CreditCard" };
const DEFAULT_HOME = ["hero_slider", "category_grid", "product_carousel", "promo_banners", "product_carousel", "features", "newsletter"];

/** Built-in preset, or a custom type stored in the database — same shape either way. */
export async function storeTypeDefinition(key: string): Promise<StoreTypePreset | null> {
  const builtin = storeTypeByKey(key);
  if (builtin) return builtin;
  if (!isCustomKey(key)) return null;
  const row = await dbAll.storeProfile.findUnique({ where: { key } });
  if (!row?.isCustom) return null;
  const d = customDefinitionSchema.parse(row.definition ?? {});
  return {
    key,
    name: row.name as T,
    description: row.description as T,
    icon: row.icon ?? "Store",
    theme: d.theme,
    terms: d.terms?.product && d.terms?.products ? (d.terms as { product: T; products: T }) : undefined,
    card: d.card,
    attributes: d.attributes as PresetAttribute[],
    categories: d.categories as PresetCategory[],
    cardAttributes: d.cardAttributes,
    icons: { ...STANDARD_ICONS, ...d.icons },
    homeSections: d.homeSections.length ? d.homeSections : DEFAULT_HOME,
  };
}

// ────────────────────────────── Overview ──────────────────────────────

export async function profilesOverview(locale: string) {
  const [active, rows, products, categories, brands] = await Promise.all([
    activeProfile(),
    dbAll.storeProfile.findMany(),
    dbAll.product.groupBy({ by: ["profile", "source"], _count: { _all: true } }),
    dbAll.category.groupBy({ by: ["profile", "source"], _count: { _all: true } }),
    dbAll.brand.groupBy({ by: ["profile", "source"], _count: { _all: true } }),
  ]);
  const count = (list: { profile: string | null; source: string; _count: { _all: number } }[], key: string, source?: string) => list.filter((r) => r.profile === key && (!source || r.source === source)).reduce((n, r) => n + r._count._all, 0);
  const countCats = (cats: PresetCategory[]): number => cats.reduce((n, c) => n + 1 + countCats(c.children ?? []), 0);
  const custom = rows.filter((r) => r.isCustom);
  const defs: StoreTypePreset[] = [...STORE_TYPES, ...(await Promise.all(custom.map((r) => storeTypeDefinition(r.key)))).filter((d): d is StoreTypePreset => Boolean(d))];
  return {
    active,
    types: defs.map((d) => {
      const row = rows.find((r) => r.key === d.key);
      const tpl = STORE_TEMPLATES[d.key];
      return {
        key: d.key,
        custom: isCustomKey(d.key),
        name: t(d.name, locale),
        description: t(d.description, locale),
        icon: d.icon,
        theme: d.theme ?? null,
        template: { categories: countCats(d.categories), attributes: d.attributes.length, brands: tpl?.brands.length ?? 0, products: tpl?.products.length ?? 0, version: tpl?.version ?? 0 },
        initializedAt: row?.initializedAt?.toISOString() ?? null,
        activatedAt: row?.activatedAt?.toISOString() ?? null,
        templateVersion: row?.templateVersion ?? 0,
        updateAvailable: Boolean(row?.initializedAt && tpl && row.templateVersion < tpl.version),
        data: {
          products: count(products as never, d.key),
          merchantProducts: count(products as never, d.key, "MERCHANT"),
          demoProducts: count(products as never, d.key, "DEMO"),
          categories: count(categories as never, d.key),
          brands: count(brands as never, d.key),
        },
        cardAttributes: d.cardAttributes.map((k) => t(d.attributes.find((a) => a.key === k)?.name, locale)).filter(Boolean),
        attributes: d.attributes.map((a) => t(a.name, locale)),
        rootCategories: d.categories.map((c) => t(c.name, locale)),
      };
    }),
  };
}

// ────────────────────────────── Switching ──────────────────────────────

/** Dry run for the confirmation dialog. */
export async function planSwitch(key: string, locale: string) {
  const def = await storeTypeDefinition(key);
  if (!def) throw Errors.notFound("store_type");
  const from = await activeProfile();
  const [fromDef, row, counts] = await Promise.all([
    storeTypeDefinition(from),
    dbAll.storeProfile.findUnique({ where: { key } }),
    Promise.all([dbAll.product.count({ where: { profile: from } }), dbAll.category.count({ where: { profile: from } }), dbAll.product.count({ where: { profile: key } })]),
  ]);
  const tpl = STORE_TEMPLATES[key];
  return {
    from: { key: from, name: fromDef ? t(fromDef.name, locale) : from, products: counts[0], categories: counts[1] },
    to: { key, name: t(def.name, locale), initialized: Boolean(row?.initializedAt), products: counts[2], demoProducts: tpl?.products.length ?? 0 },
  };
}

/**
 * Make `key` the active store type. Super-admin only (enforced by the action).
 * Safe to retry: initialisation is one transaction and asset generation is
 * idempotent, so a failure leaves the previous type active and nothing half-made.
 */
export async function switchStoreType(key: string, staff: CurrentStaff) {
  const def = await storeTypeDefinition(z.string().max(60).parse(key));
  if (!def) throw Errors.notFound("store_type");
  const from = await activeProfile();
  if (from === key) return { key, initialized: false };

  // 1. Keep the outgoing type's presentation with it.
  await saveOverrides(from);

  // 2. First activation: build the profile from its template (all-or-nothing).
  const row = await dbAll.storeProfile.findUnique({ where: { key } });
  let initialized = false;
  if (!row?.initializedAt) {
    await initializeProfile(def, staff);
    initialized = true;
  }

  // 3. Restore the incoming type's presentation and make it active.
  await restoreOverrides(def);
  await dbAll.storeProfile.upsert({ where: { key }, create: { key, activatedAt: new Date() }, update: { activatedAt: new Date() } });
  await patchSettings("storeType", { type: key, appliedPresets: [...new Set([...(await getSettings("storeType")).appliedPresets, key])].slice(-40) });
  setActiveProfileCache(key);
  invalidateCategoryCounts();

  await audit({ actor: staff, action: "platform.store_type_switched", entityType: "settings", entityId: "storeType", summary: `${from} → ${key}${initialized ? " (initialised)" : ""}`, changes: { from, to: key, initialized } });
  return { key, initialized };
}

async function saveOverrides(key: string) {
  const [{ storeType, appearance }, cardAttrs] = await Promise.all([getManySettings(["storeType", "appearance"]), dbAll.attribute.findMany({ where: { showOnCard: true }, select: { key: true } })]);
  const overrides: ProfileOverrides = { cardAttributeKeys: cardAttrs.map((a) => a.key), icons: storeType.icons, productCard: appearance.productCard };
  await dbAll.storeProfile.upsert({ where: { key }, create: { key, overrides, initializedAt: new Date() }, update: { overrides } });
}

async function restoreOverrides(def: StoreTypePreset) {
  const [row, { appearance }] = await Promise.all([dbAll.storeProfile.findUnique({ where: { key: def.key } }), getManySettings(["appearance"])]);
  const saved = (row?.overrides ?? {}) as ProfileOverrides;
  const cardKeys = saved.cardAttributeKeys ?? def.cardAttributes;
  const icons: Icons = saved.icons ?? { delivery: def.icons.delivery, warranty: def.icons.warranty, returns: def.icons.returns, payment: def.icons.payment };
  const productCard: ProductCard = saved.productCard ?? { ...appearance.productCard, ...(def.card ?? {}) };
  await dbAll.$transaction([dbAll.attribute.updateMany({ where: { key: { notIn: cardKeys } }, data: { showOnCard: false } }), dbAll.attribute.updateMany({ where: { key: { in: cardKeys } }, data: { showOnCard: true } })]);
  await patchSettings("storeType", { icons });
  await patchSettings("appearance", { productCard });
}

// ────────────────────────────── Initialisation ──────────────────────────────

/** Price in the store's base currency (minor units) from a SAR template price. */
async function priceConverter() {
  const [base, sar] = await Promise.all([dbAll.currency.findFirst({ where: { isBase: true } }), dbAll.currency.findUnique({ where: { code: "SAR" } })]);
  const decimals = base?.decimals ?? 2;
  const rate = !base || base.code === "SAR" ? 1 : sar?.rate || 1; // SAR per 1 base unit
  return (sarAmount: number) => Math.round((sarAmount / rate) * 10 ** decimals);
}

/** Shared demo asset: generated once per (kind, colour, size) and reused by every template. */
async function demoAsset(ref: string, svg: () => string, width: number, alt: T) {
  const hit = await dbAll.media.findUnique({ where: { templateRef: ref } });
  if (hit) return hit;
  let img = sharp(Buffer.from(svg()));
  img = img.resize({ width });
  const png = await img.png().toBuffer();
  const m = await processImage(png, { folder: "demo", alt, quality: 80 });
  try {
    return await dbAll.media.update({ where: { id: m.id }, data: { templateRef: ref } });
  } catch {
    // Generated concurrently by another request: keep theirs.
    return (await dbAll.media.findUnique({ where: { templateRef: ref } })) ?? m;
  }
}

const productAsset = (kind: ArtKind, color: string, view: number, alt: T) => demoAsset(`demo/${kind}/${color.slice(1)}/${view}`, () => packshot(kind, color, view), 1000, alt);
const heroAsset = (key: string, kind: ArtKind, color: string, theme: { from: string; to: string; accent: string }, size: "desktop" | "tablet" | "mobile", alt: T, mirror = false) => {
  const dims = { desktop: [2400, 900], tablet: [1600, 800], mobile: [1080, 720] }[size];
  return demoAsset(`demo/hero/${key}/${kind}/${color.slice(1)}/${size}${mirror ? "/m" : ""}`, () => heroArt({ ...theme, kind, color, width: dims[0], height: dims[1], mirror }), dims[0], alt);
};

type AttrMap = Map<string, { id: string; type: string; values: Map<string, string> }>;

/** Attributes are a shared library: create missing ones and append missing values (never rename/remove). */
async function ensureAttributes(def: StoreTypePreset): Promise<AttrMap> {
  const map: AttrMap = new Map();
  for (const [i, a] of def.attributes.entries()) {
    let attr = await dbAll.attribute.findUnique({ where: { key: a.key }, include: { values: true } });
    if (!attr) {
      attr = await dbAll.attribute.create({
        data: {
          key: a.key,
          name: a.name,
          type: a.type,
          unit: a.unit ?? null,
          icon: a.icon ?? null,
          isFilterable: a.filterable ?? ["SELECT", "MULTISELECT", "COLOR", "BOOLEAN"].includes(a.type),
          isVariantOption: a.variant ?? false,
          isHighlighted: a.highlighted ?? false,
          position: 100 + i,
        },
        include: { values: true },
      });
    }
    let position = attr.values.length;
    for (const v of a.values ?? []) {
      const slug = slugify(v.en);
      if (attr.values.some((x) => x.slug === slug)) continue;
      const created = await dbAll.attributeValue.create({ data: { attributeId: attr.id, slug, label: { en: v.en, ar: v.ar }, colorHex: (v as { hex?: string }).hex ?? null, position: position++ } });
      attr.values.push(created);
    }
    map.set(a.key, { id: attr.id, type: attr.type, values: new Map(attr.values.map((v) => [v.slug, v.id])) });
  }
  return map;
}

/** A unique slug: the plain one, or suffixed with the type when another profile already uses it. */
async function freeSlug(model: "product" | "brand", slug: string, key: string) {
  const taken = model === "product" ? await dbAll.product.findUnique({ where: { slug }, select: { id: true } }) : await dbAll.brand.findUnique({ where: { slug }, select: { id: true } });
  return taken ? `${slug}-${key}`.slice(0, 120) : slug;
}

const specText = (v: SpecValue): T => (typeof v === "object" && !Array.isArray(v) ? v : { en: String(v), ar: String(v) });

function describe(p: TemplateProduct, def: StoreTypePreset): T {
  const rows = Object.entries(p.specs ?? {}).map(([k, v]) => {
    const a = def.attributes.find((x) => x.key === k);
    if (!a) return null;
    const label = (lang: "en" | "ar") => {
      if (typeof v === "boolean") return lang === "ar" ? (v ? "نعم" : "لا") : v ? "Yes" : "No";
      const pick = (s: string) => a.values?.find((x) => x.en === s)?.[lang] ?? s;
      if (Array.isArray(v)) return v.map(pick).join(lang === "ar" ? "، " : ", ");
      if (typeof v === "object") return v[lang];
      return pick(String(v)) + (a.unit && typeof v === "number" ? ` ${a.unit}` : "");
    };
    return { en: `<li><strong>${a.name.en}:</strong> ${label("en")}</li>`, ar: `<li><strong>${a.name.ar}:</strong> ${label("ar")}</li>` };
  }).filter((x): x is T => Boolean(x));
  const list = (lang: "en" | "ar") => (rows.length ? `<ul>${rows.map((r) => r[lang]).join("")}</ul>` : "");
  return { en: `<p>${p.short.en}</p>${list("en")}`, ar: `<p>${p.short.ar}</p>${list("ar")}` };
}

/**
 * Build a profile from its template. Images are generated (or reused) first;
 * every database row is then written in a single transaction and the profile
 * is marked initialised in that same transaction.
 */
async function initializeProfile(def: StoreTypePreset, staff: CurrentStaff | null, opts: { onlyRefs?: (ref: string) => boolean } = {}) {
  const key = def.key;
  const tpl: StoreTemplate | undefined = STORE_TEMPLATES[key];
  const theme = def.theme ?? { from: "#0f172a", to: "#334155", accent: "#6366f1" };
  const wanted = opts.onlyRefs ?? (() => true);
  const toMinor = await priceConverter();
  const attrs = await ensureAttributes(def);

  // ── Assets (idempotent, outside the transaction) ──
  const flatCats: { path: string; cat: PresetCategory; parent: string | null; index: number }[] = [];
  def.categories.forEach((c, i) => {
    flatCats.push({ path: String(i), cat: c, parent: null, index: i });
    (c.children ?? []).forEach((ch, j) => flatCats.push({ path: `${i}.${j}`, cat: ch, parent: String(i), index: j }));
  });
  const catImages = new Map<string, string>();
  for (const [i, kind] of (tpl?.categoryArt ?? []).entries()) {
    const sample = tpl?.products.find((p) => p.cat === String(i) || p.cat.startsWith(`${i}.`));
    catImages.set(String(i), (await productAsset(kind, sample?.color ?? theme.accent, 0, def.categories[i].name)).id);
  }
  const brandLogos = new Map<string, string>();
  for (const b of tpl?.brands ?? []) brandLogos.set(b.ref, (await demoAsset(`demo/brand/${slugify(b.name)}/${b.color.slice(1)}`, () => wordmark(b.name, b.color), 600, { en: b.name, ar: b.name })).id);
  const productImages = new Map<string, string[]>();
  for (const p of tpl?.products ?? []) productImages.set(p.ref, [(await productAsset(p.art, p.color, 0, p.name)).id, (await productAsset(p.art, p.color, 1, p.name)).id]);
  const heroArtKind = tpl?.hero.art ?? "gift";
  const heroColor = tpl?.hero.color ?? theme.accent;
  // Hero art sits opposite the copy: copy starts on the left in English and on
  // the right in Arabic, so each slide gets a mirrored set for the other language.
  const heroSet = async (kind: ArtKind, color: string, th: typeof theme, mirror: boolean) => ({
    desktop: await heroAsset(key, kind, color, th, "desktop", def.name, mirror),
    tablet: await heroAsset(key, kind, color, th, "tablet", def.name, mirror),
    mobile: await heroAsset(key, kind, color, th, "mobile", def.name, mirror),
  });
  const hero = await heroSet(heroArtKind, heroColor, theme, false);
  const heroAr = await heroSet(heroArtKind, heroColor, theme, true);
  const offerKind = (tpl?.products[1]?.art ?? heroArtKind) as ArtKind;
  const offerColor = tpl?.products[1]?.color ?? heroColor;
  const offerTheme = { from: theme.to, to: theme.from, accent: theme.accent };
  const offer = await heroSet(offerKind, offerColor, offerTheme, true);
  const offerAr = await heroSet(offerKind, offerColor, offerTheme, false);
  const bannerImgs = await Promise.all(
    [0, 1].map(async (i) => {
      const p = tpl?.products[i * 2] ?? null;
      const kind = (p?.art ?? heroArtKind) as ArtKind;
      const color = p?.color ?? heroColor;
      const th = i ? offerTheme : theme;
      return { desktop: await heroAsset(`${key}-b${i}`, kind, color, th, "tablet", def.name), mobile: await heroAsset(`${key}-b${i}`, kind, color, th, "mobile", def.name) };
    }),
  );

  // Slugs are global: resolve collisions with other profiles before the transaction.
  const brandSlugs = new Map<string, string>();
  for (const b of tpl?.brands ?? []) brandSlugs.set(b.ref, await freeSlug("brand", slugify(b.name), key));
  const productSlugs = new Map<string, string>();
  for (const p of tpl?.products ?? []) productSlugs.set(p.ref, await freeSlug("product", slugify(p.name.en), key));
  const now = Date.now();
  const createdRefs: string[] = [];
  const productIds: string[] = [];

  await dbAll.$transaction(
    async (tx) => {
      const ref = (kind: string, id: string) => `${key}/${kind}/${id}`;

      // Categories (with their filterable attributes)
      const filterIds = def.attributes.filter((a) => a.filterable !== false && attrs.has(a.key)).map((a) => attrs.get(a.key)!.id);
      const catIds = new Map<string, { id: string; path: string; fullSlug: string }>();
      for (const fc of flatCats) {
        const r = ref("category", fc.path.replace(".", "-") + "-" + slugify(fc.cat.name.en));
        const existing = await tx.category.findUnique({ where: { templateRef: r }, select: { id: true, path: true, fullSlug: true } });
        if (existing) {
          catIds.set(fc.path, existing);
          continue;
        }
        if (!wanted(r)) continue;
        const parent = fc.parent ? catIds.get(fc.parent) : null;
        if (fc.parent && !parent) continue;
        let slug = slugify(fc.cat.name.en);
        let fullSlug = buildFullSlug(parent?.fullSlug ?? null, slug);
        if (await tx.category.findUnique({ where: { fullSlug }, select: { id: true } })) {
          slug = `${slug}-${key}`;
          fullSlug = buildFullSlug(parent?.fullSlug ?? null, slug);
        }
        const c = await tx.category.create({
          data: { slug, fullSlug, path: "/pending/", parentId: parent?.id ?? null, name: fc.cat.name, icon: fc.cat.icon ?? null, isFeatured: !fc.parent, position: fc.index, imageId: fc.parent ? null : (catImages.get(fc.path) ?? null), profile: key, source: "DEMO", templateRef: r },
        });
        const path = buildPath(parent?.path ?? null, c.id);
        await tx.category.update({ where: { id: c.id }, data: { path, depth: depthOf(path) } });
        await tx.categoryAttribute.createMany({ data: filterIds.map((attributeId, position) => ({ categoryId: c.id, attributeId, position })), skipDuplicates: true });
        catIds.set(fc.path, { id: c.id, path, fullSlug });
        createdRefs.push(r);
      }

      // Brands
      const brandIds = new Map<string, string>();
      for (const [i, b] of (tpl?.brands ?? []).entries()) {
        const r = ref("brand", b.ref);
        const existing = await tx.brand.findUnique({ where: { templateRef: r }, select: { id: true } });
        if (existing) {
          brandIds.set(b.ref, existing.id);
          continue;
        }
        if (!wanted(r)) continue;
        const created = await tx.brand.create({ data: { slug: brandSlugs.get(b.ref)!, name: { en: b.name, ar: b.name }, logoId: brandLogos.get(b.ref), isFeatured: true, position: i, profile: key, source: "DEMO", templateRef: r } });
        brandIds.set(b.ref, created.id);
        createdRefs.push(r);
      }

      // Products
      for (const [index, p] of (tpl?.products ?? []).entries()) {
        const r = ref("product", p.ref);
        if ((await tx.product.findUnique({ where: { templateRef: r }, select: { id: true } })) || !wanted(r)) continue;
        const cat = catIds.get(p.cat);
        const variable = Boolean(p.variants?.values.length);
        const stock = p.stock ?? 25;
        const images = productImages.get(p.ref) ?? [];
        const brand = tpl!.brands[p.brand];
        const created = await tx.product.create({
          data: {
            slug: productSlugs.get(p.ref)!,
            sku: `DEMO-${key}-${p.ref}`.toUpperCase().slice(0, 60),
            name: p.name,
            shortDescription: p.short,
            description: describe(p, def),
            type: variable ? "VARIABLE" : "SIMPLE",
            status: "ACTIVE",
            publishedAt: new Date(now - (tpl!.products.length - index) * 3_600_000),
            brandId: brandIds.get(brand.ref) ?? null,
            manufacturer: brand.name,
            price: toMinor(p.price),
            salePrice: p.sale ? toMinor(p.sale) : null,
            costPrice: Math.round(toMinor(p.price) * 0.7),
            stock: variable ? 0 : stock,
            isFeatured: p.featured ?? false,
            isNew: index < 2,
            profile: key,
            source: "DEMO",
            templateRef: r,
            categories: cat ? { create: [{ categoryId: cat.id, isPrimary: true }] } : undefined,
            images: { create: images.map((mediaId, position) => ({ mediaId, position })) },
          },
        });
        productIds.push(created.id);
        createdRefs.push(r);

        let position = 0;
        for (const [k, v] of Object.entries(p.specs ?? {})) {
          const a = attrs.get(k);
          if (!a) continue;
          const choice = a.type === "SELECT" || a.type === "MULTISELECT" || a.type === "COLOR";
          const pa = await tx.productAttribute.create({
            data: {
              productId: created.id,
              attributeId: a.id,
              position: position++,
              ...(a.type === "TEXT" ? { textValue: specText(v) } : {}),
              ...(a.type === "NUMBER" ? { numberValue: Number(v) } : {}),
              ...(a.type === "BOOLEAN" ? { boolValue: Boolean(v) } : {}),
            },
          });
          if (choice) {
            const ids = (Array.isArray(v) ? v : [String(v)]).map((label) => a.values.get(slugify(String(label)))).filter((x): x is string => Boolean(x));
            if (ids.length) await tx.productAttributeValue.createMany({ data: ids.map((valueId) => ({ productAttributeId: pa.id, valueId })), skipDuplicates: true });
          }
        }
        if (variable) {
          const axis = p.variants!;
          const a = attrs.get(axis.attr)!;
          const pa = await tx.productAttribute.create({ data: { productId: created.id, attributeId: a.id, usedForVariations: true, position: position++ } });
          const valueIds = axis.values.map((v) => a.values.get(slugify(v))!).filter(Boolean);
          await tx.productAttributeValue.createMany({ data: valueIds.map((valueId) => ({ productAttributeId: pa.id, valueId })), skipDuplicates: true });
          for (const [vi, v] of axis.values.entries()) {
            const delta = axis.delta?.[v] ?? 0;
            const vStock = [12, 8, 20, 5, 15, 9][vi % 6];
            await tx.productVariant.create({
              data: {
                productId: created.id,
                sku: `DEMO-${key}-${p.ref}-${slugify(v)}`.toUpperCase().slice(0, 80),
                price: delta ? toMinor(p.price + delta) : null,
                salePrice: p.sale && delta ? toMinor(p.sale + delta) : null,
                stock: vStock,
                position: vi,
                options: { create: [{ attributeId: a.id, valueId: a.values.get(slugify(v))! }] },
              },
            });
          }
        }
        await tx.inventoryMovement.create({ data: { productId: created.id, delta: variable ? 0 : stock, balanceAfter: variable ? 0 : stock, reason: "INITIAL", note: "Template sample stock" } });
      }

      // Hero slider (desktop, tablet and phone images; landscape everywhere)
      const sliderRef = ref("slider", "home");
      let sliderKey = (await tx.slider.findUnique({ where: { templateRef: sliderRef }, select: { key: true } }))?.key ?? null;
      if (!sliderKey && wanted(sliderRef)) {
        sliderKey = `home-${key}`.slice(0, 60);
        if (await tx.slider.findUnique({ where: { key: sliderKey } })) sliderKey = `${sliderKey}-${Date.now().toString(36)}`;
        const slider = await tx.slider.create({ data: { key: sliderKey, name: `Homepage hero — ${def.name.en}`, settings: { autoplay: true, interval: 6500, transition: "fade", loop: true, showArrows: true, showDots: true }, profile: key, templateRef: sliderRef } });
        const firstCat = catIds.get("0");
        const offerLabel = def.terms?.products ?? def.name;
        const slides = [
          { img: hero, imgAr: heroAr, eyebrow: def.name, heading: tpl?.hero.heading ?? def.name, body: tpl?.hero.body ?? def.description, cta: { label: { en: "Shop now", ar: "تسوّق الآن" }, href: "/shop" }, cta2: firstCat ? { label: def.categories[0].name, href: `/category/${firstCat.fullSlug}` } : {} },
          { img: offer, imgAr: offerAr, eyebrow: { en: "Limited-time offers", ar: "عروض لفترة محدودة" }, heading: { en: `Up to 20% off ${offerLabel.en.toLowerCase()}`, ar: `خصومات حتى 20% على ${offerLabel.ar}` }, body: { en: "Hand-picked deals, while stock lasts.", ar: "عروض مختارة حتى نفاد الكمية." }, cta: { label: { en: "View offers", ar: "شاهد العروض" }, href: "/shop?sale=1" }, cta2: {} },
        ];
        for (const [i, s] of slides.entries()) {
          await tx.slide.create({
            data: {
              sliderId: slider.id,
              position: i,
              desktopImageId: s.img.desktop.id,
              tabletImageId: s.img.tablet.id,
              mobileImageId: s.img.mobile.id,
              localeImages: { ar: { desktop: s.imgAr.desktop.id, tablet: s.imgAr.tablet.id, mobile: s.imgAr.mobile.id } },
              eyebrow: s.eyebrow,
              heading: s.heading,
              body: s.body,
              primaryCta: s.cta,
              secondaryCta: s.cta2,
              style: { align: i ? "end" : "start", vertical: "center", textColor: "#ffffff", overlay: "#000000", overlayOpacity: 10, animation: "fade-up", buttonStyle: i ? "glass" : "solid" },
            },
          });
        }
        createdRefs.push(sliderRef);
      }

      // Homepage sections for this profile (compact by default: no duplicate carousels on phones)
      const home = await tx.page.findUnique({ where: { slug: "home" }, select: { id: true } });
      if (home) {
        const cats = [catIds.get("0"), catIds.get("1")];
        for (const [i, type] of def.homeSections.entries()) {
          const r = ref("section", `${i}-${type}`);
          if ((await tx.pageSection.findUnique({ where: { templateRef: r }, select: { id: true } })) || !wanted(r)) continue;
          let data: Record<string, unknown> = initialSectionData(type) as Record<string, unknown>;
          if (type === "hero_slider") data = { ...data, slider: sliderKey ?? "home", height: "md" };
          if (type === "promo_banners")
            data = {
              ...data,
              items: [0, 1].map((b) => {
                const c = cats[b] ?? cats[0];
                const name = def.categories[b]?.name ?? def.name;
                return { image: { id: bannerImgs[b].desktop.id, url: bannerImgs[b].desktop.url }, mobileImage: { id: bannerImgs[b].mobile.id, url: bannerImgs[b].mobile.url }, eyebrow: b ? { en: "Just in", ar: "وصل حديثاً" } : { en: "Featured", ar: "مختارات" }, title: name, text: { en: `Explore our ${name.en.toLowerCase()} range.`, ar: `اكتشف تشكيلة ${name.ar}.` }, cta: { en: "Shop now", ar: "تسوّق الآن" }, href: c ? `/category/${c.fullSlug}` : "/shop", theme: "light" };
              }),
            };
          if (type === "features")
            data = {
              ...data,
              items: [
                { icon: def.icons.delivery.replace(/^lucide:/, ""), title: { en: "Fast delivery", ar: "توصيل سريع" }, text: { en: "To your door, tracked all the way.", ar: "حتى باب منزلك مع تتبع كامل." } },
                { icon: def.icons.warranty.replace(/^lucide:/, ""), title: { en: "Quality guaranteed", ar: "جودة مضمونة" }, text: { en: "Genuine products from trusted brands.", ar: "منتجات أصلية من علامات موثوقة." } },
                { icon: def.icons.returns.replace(/^lucide:/, ""), title: { en: "Easy returns", ar: "إرجاع سهل" }, text: { en: "Changed your mind? No problem.", ar: "غيّرت رأيك؟ لا مشكلة." } },
                { icon: def.icons.payment.replace(/^lucide:/, ""), title: { en: "Secure payment", ar: "دفع آمن" }, text: { en: "Cards, wallets or cash on delivery.", ar: "بطاقات أو محافظ أو الدفع عند الاستلام." } },
              ],
            };
          await tx.pageSection.create({ data: { pageId: home.id, type, data: data as Prisma.InputJsonValue, style: {}, position: i, isVisible: true, profile: key, templateRef: r } });
          createdRefs.push(r);
        }
      }

      const row = await tx.storeProfile.findUnique({ where: { key } });
      const meta = (row?.definition && !row.isCustom ? (row.definition as ProfileMeta) : {}) as ProfileMeta;
      await tx.storeProfile.upsert({
        where: { key },
        create: { key, initializedAt: new Date(), templateVersion: tpl?.version ?? 0, definition: { refs: createdRefs } },
        update: { initializedAt: row?.initializedAt ?? new Date(), templateVersion: tpl?.version ?? 0, ...(row?.isCustom ? {} : { definition: { refs: [...new Set([...(meta.refs ?? []), ...createdRefs])] } }) },
      });
    },
    { timeout: 180_000, maxWait: 20_000 },
  );

  for (const id of productIds) await refreshProductDerived(id);
  invalidateCategoryCounts();
  if (staff) await audit({ actor: staff, action: "platform.store_type_initialized", entityType: "storeProfile", entityId: key, summary: `${key}: ${createdRefs.length} records from template v${tpl?.version ?? 0}` });
  return { created: createdRefs.length };
}

/**
 * Template update: adds what a newer template version introduced. Records the
 * profile already received (even if the merchant edited or deleted them since)
 * are never recreated or overwritten.
 */
export async function applyTemplateUpdate(key: string, staff: CurrentStaff) {
  const def = await storeTypeDefinition(key);
  if (!def) throw Errors.notFound("store_type");
  const row = await dbAll.storeProfile.findUnique({ where: { key } });
  if (!row?.initializedAt) throw new AppError("not_initialized", 409);
  const had = new Set(((row.definition ?? {}) as ProfileMeta).refs ?? []);
  return initializeProfile(def, staff, { onlyRefs: (ref) => !had.has(ref) });
}

/**
 * Remove a profile's demo products (source = DEMO) that never sold. Merchant
 * products, and demo products that appear in orders, are always kept.
 */
export async function removeDemoProducts(key: string, staff: CurrentStaff) {
  const ids = (await dbAll.product.findMany({ where: { profile: key, source: "DEMO", orderItems: { none: {} } }, select: { id: true } })).map((p) => p.id);
  if (ids.length) await dbAll.product.deleteMany({ where: { id: { in: ids } } });
  invalidateCategoryCounts();
  await audit({ actor: staff, action: "platform.demo_removed", entityType: "storeProfile", entityId: key, summary: `${ids.length} demo products` });
  return { removed: ids.length };
}

// ────────────────────────────── Custom types ──────────────────────────────

const customSchema = z.object({
  name: localized({ required: true, max: 60 }),
  description: localized({ max: 300 }).prefault({}),
  icon: z.string().max(60).default("Store"),
  definition: customDefinitionSchema,
});

/** Create or update a custom store type (same architecture as the built-in ones). */
export async function saveCustomType(key: string | null, raw: unknown, staff: CurrentStaff) {
  const p = customSchema.parse(raw);
  const k = key ?? `${CUSTOM_PREFIX}${slugify(p.name.en || p.name.ar || "store").slice(0, 30) || "store"}-${Date.now().toString(36).slice(-4)}`;
  if (key && !isCustomKey(key)) throw Errors.forbidden();
  await dbAll.storeProfile.upsert({ where: { key: k }, create: { key: k, isCustom: true, name: p.name, description: p.description, icon: p.icon, definition: p.definition }, update: { name: p.name, description: p.description, icon: p.icon, definition: p.definition } });
  await audit({ actor: staff, action: key ? "platform.custom_type_updated" : "platform.custom_type_created", entityType: "storeProfile", entityId: k, summary: t(p.name, "en") });
  return { key: k };
}

/** Custom type definition for the editor. */
export async function customTypeData(key: string) {
  const row = await dbAll.storeProfile.findUnique({ where: { key } });
  if (!row?.isCustom) throw Errors.notFound("store_type");
  return { key, name: row.name as T, description: row.description as T, icon: row.icon ?? "Store", definition: customDefinitionSchema.parse(row.definition ?? {}) };
}

// ────────────────────────────── Storage report ──────────────────────────────

/** Measured footprint of profiles and shared demo assets (for the super-admin report). */
export async function storageReport() {
  const [media, demoMedia, perProfile] = await Promise.all([
    dbAll.media.aggregate({ _sum: { size: true }, _count: { _all: true } }),
    dbAll.media.aggregate({ where: { templateRef: { not: null } }, _sum: { size: true }, _count: { _all: true } }),
    dbAll.product.groupBy({ by: ["profile", "source"], _count: { _all: true } }),
  ]);
  const tables = await dbAll.$queryRaw<{ table: string; bytes: bigint; rows: bigint }[]>`
    SELECT relname AS table, pg_total_relation_size(c.oid) AS bytes, c.reltuples::bigint AS rows
    FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind = 'r'
    ORDER BY pg_total_relation_size(c.oid) DESC LIMIT 25`;
  return {
    media: { files: media._count._all, bytes: media._sum.size ?? 0 },
    demoMedia: { files: demoMedia._count._all, bytes: demoMedia._sum.size ?? 0 },
    products: perProfile.map((r) => ({ profile: r.profile, source: r.source, count: r._count._all })),
    tables: tables.map((r) => ({ table: r.table, bytes: Number(r.bytes), rows: Number(r.rows) })),
  };
}

export { PROFILE_MODELS };

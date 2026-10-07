import "server-only";
import { z } from "zod";
import { db } from "../db";
import { AppError } from "../errors";
import { audit } from "../audit";
import { getSettings, patchSettings } from "../settings/service";
import { saveAttribute, saveCategory } from "./catalog";
import { STORE_TYPES, storeTypeByKey, CUSTOM_STORE_TYPE, type PresetCategory, type StoreTypePreset } from "@/config/store-types";
import { initialSectionData } from "@/cms/sections";
import { slugify } from "@/lib/utils";
import { t } from "@/lib/i18n-text";
import { invalidateCategoryCounts } from "../catalog/taxonomy";
import type { CurrentStaff } from "../auth/session";

/**
 * Store types: presets are applied NON-DESTRUCTIVELY. A plan is computed
 * first (what's missing), shown to the admin, and only those additions are
 * made — existing attributes, values, categories and homepage sections are
 * never renamed, changed or removed.
 */

export async function storeTypePage(locale: string) {
  const [settings, attributes] = await Promise.all([
    getSettings("storeType"),
    db.attribute.findMany({ orderBy: { position: "asc" }, select: { id: true, key: true, name: true, type: true, showOnCard: true, isFilterable: true, _count: { select: { productAttrs: true } } } }),
  ]);
  return {
    settings,
    presets: STORE_TYPES.map((p) => ({ key: p.key, name: p.name, description: p.description, icon: p.icon, attributes: p.attributes.length, categories: p.categories.length, cardAttributes: p.cardAttributes, icons: p.icons })),
    attributes: attributes.map((a) => ({ id: a.id, key: a.key, name: t(a.name, locale), type: a.type, showOnCard: a.showOnCard, isFilterable: a.isFilterable, products: a._count.productAttrs })),
  };
}

export type PresetPlan = Awaited<ReturnType<typeof planPreset>>;

/** What applying a preset would add (dry run). */
export async function planPreset(key: string, locale: string) {
  const preset = storeTypeByKey(key);
  if (!preset) throw new AppError("not_found", 404);
  const keys = preset.attributes.map((a) => a.key);
  const existing = await db.attribute.findMany({ where: { key: { in: keys } }, include: { values: { select: { slug: true } } } });
  const newAttributes = preset.attributes.filter((a) => !existing.some((e) => e.key === a.key)).map((a) => t(a.name, locale));
  const extendedAttributes = preset.attributes.flatMap((a) => {
    const e = existing.find((x) => x.key === a.key);
    if (!e || !a.values) return [];
    const missing = a.values.filter((v) => !e.values.some((ev) => ev.slug === slugify(v.en)));
    return missing.length ? [{ name: t(e.name, locale), values: missing.map((v) => t(v, locale)) }] : [];
  });
  const roots = await db.category.findMany({ where: { parentId: null }, select: { slug: true } });
  const newCategories = preset.categories.filter((c) => !roots.some((r) => r.slug === slugify(c.name.en))).map((c) => ({ name: t(c.name, locale), children: (c.children ?? []).map((x) => t(x.name, locale)) }));
  const cardAttributes = preset.cardAttributes.map((k) => t(preset.attributes.find((a) => a.key === k)?.name ?? existing.find((e) => e.key === k)?.name, locale)).filter(Boolean);
  const home = await db.page.findUnique({ where: { slug: "home" }, include: { sections: { select: { type: true } } } });
  const present = new Set(home?.sections.map((s) => s.type) ?? []);
  const newHomeSections = [...new Set(preset.homeSections)].filter((type) => !present.has(type));
  return { key, newAttributes, extendedAttributes, newCategories, cardAttributes, newHomeSections };
}

const applySchema = z.object({
  attributes: z.boolean(),
  categories: z.boolean(),
  cardAttributes: z.boolean(),
  homeSections: z.boolean(),
  icons: z.boolean(),
});

export async function applyPreset(key: string, raw: unknown, staff: CurrentStaff) {
  const preset = storeTypeByKey(key);
  if (!preset) throw new AppError("not_found", 404);
  const opts = applySchema.parse(raw);
  const result = { attributesCreated: 0, valuesAdded: 0, categoriesCreated: 0, cardAttributes: 0, homeSections: 0 };

  // 1. Attributes: create missing ones; append missing values to existing ones (never edits labels or removes values).
  const attrIds = new Map<string, string>();
  if (opts.attributes || opts.categories || opts.cardAttributes) {
    for (const a of preset.attributes) {
      const e = await db.attribute.findUnique({ where: { key: a.key }, include: { values: { orderBy: { position: "asc" } } } });
      if (e) {
        attrIds.set(a.key, e.id);
        if (!opts.attributes || !a.values) continue;
        let position = e.values.length;
        for (const v of a.values) {
          const slug = slugify(v.en);
          if (e.values.some((x) => x.slug === slug)) continue;
          await db.attributeValue.create({ data: { attributeId: e.id, slug, label: { en: v.en, ar: v.ar }, colorHex: v.hex ?? null, position: position++ } });
          result.valuesAdded++;
        }
        continue;
      }
      if (!opts.attributes) continue;
      const created = await saveAttribute(
        null,
        {
          key: a.key,
          name: a.name,
          type: a.type,
          unit: a.unit,
          icon: a.icon ?? null,
          isFilterable: a.filterable ?? ["SELECT", "MULTISELECT", "COLOR", "BOOLEAN"].includes(a.type),
          isVariantOption: a.variant ?? false,
          isVisible: true,
          isHighlighted: a.highlighted ?? false,
          values: (a.values ?? []).map((v) => ({ slug: slugify(v.en), label: { en: v.en, ar: v.ar }, colorHex: v.hex ?? "" })),
        },
        staff,
      );
      attrIds.set(a.key, (created as { id: string }).id);
      result.attributesCreated++;
    }
  }

  // 2. Categories: add missing top-level categories (and their children), linked to the preset's filterable attributes.
  if (opts.categories) {
    const filterable = preset.attributes.filter((a) => a.filterable !== false && attrIds.has(a.key)).map((a) => attrIds.get(a.key)!);
    const create = async (c: PresetCategory, parentId: string | null) => {
      const slug = slugify(c.name.en);
      const found = await db.category.findFirst({ where: { parentId, slug }, select: { id: true } });
      const id = found
        ? found.id
        : (
            await saveCategory(
              null,
              { name: c.name, slug, parentId, description: {}, icon: c.icon ?? null, isActive: true, isFeatured: parentId === null, attributeIds: filterable, seo: { title: {}, description: {}, canonical: "", ogImage: "", noindex: false } },
              staff,
            )
          ).id;
      if (!found) result.categoriesCreated++;
      for (const child of c.children ?? []) await create(child, id);
    };
    for (const c of preset.categories) await create(c, null);
    invalidateCategoryCounts();
  }

  // 3. Card specs: show the preset's attributes on product cards (others keep their setting).
  if (opts.cardAttributes) {
    const ids = preset.cardAttributes.map((k) => attrIds.get(k)).filter(Boolean) as string[];
    if (ids.length) result.cardAttributes = (await db.attribute.updateMany({ where: { id: { in: ids } }, data: { showOnCard: true } })).count;
  }

  // 4. Homepage: append recommended sections that are missing — hidden, so the admin decides when to show them.
  if (opts.homeSections) {
    const home = await db.page.findUnique({ where: { slug: "home" }, include: { sections: { select: { type: true, position: true } } } });
    if (home) {
      const present = new Set(home.sections.map((s) => s.type));
      let position = Math.max(-1, ...home.sections.map((s) => s.position)) + 1;
      for (const type of [...new Set(preset.homeSections)].filter((x) => !present.has(x))) {
        await db.pageSection.create({ data: { pageId: home.id, type, data: initialSectionData(type) as object, style: {}, position: position++, isVisible: false } });
        result.homeSections++;
      }
    }
  }

  // 5. Store type + default trust icons (only fills icons the admin hasn't set).
  const current = await getSettings("storeType");
  const icons = { ...current.icons };
  if (opts.icons) for (const [k, v] of Object.entries(preset.icons) as [keyof typeof icons, string][]) icons[k] = icons[k] || v;
  await patchSettings("storeType", { type: key, icons, appliedPresets: [...new Set([...current.appliedPresets, key])] });

  await audit({ actor: staff, action: "store_type.preset_applied", entityType: "settings", entityId: "storeType", summary: `${key}: ${JSON.stringify(result)}`, changes: { key, ...opts } });
  return result;
}

const settingsSchema = z.object({
  type: z.string().max(40),
  customName: z.object({ en: z.string().max(80), ar: z.string().max(80) }),
  icons: z.object({ delivery: z.string().max(120).nullable(), warranty: z.string().max(120).nullable(), returns: z.string().max(120).nullable(), payment: z.string().max(120).nullable() }),
});

/** Save the store type selection, custom name and trust-badge icon mapping. */
export async function saveStoreType(raw: unknown, staff: CurrentStaff) {
  const p = settingsSchema.parse(raw);
  if (p.type !== CUSTOM_STORE_TYPE && !storeTypeByKey(p.type)) throw new AppError("not_found", 404);
  await patchSettings("storeType", p);
  await audit({ actor: staff, action: "settings.updated", entityType: "settings", entityId: "storeType", summary: p.type });
}

/** Which attributes appear as specs on product cards. */
export async function setCardAttributes(raw: unknown, staff: CurrentStaff) {
  const ids = z.array(z.string().max(64)).max(10).parse(raw);
  await db.$transaction([db.attribute.updateMany({ where: { id: { notIn: ids } }, data: { showOnCard: false } }), db.attribute.updateMany({ where: { id: { in: ids } }, data: { showOnCard: true } })]);
  await audit({ actor: staff, action: "attributes.card_specs", entityType: "attribute", summary: `${ids.length} on cards` });
}

export type { StoreTypePreset };

import "server-only";
import { z } from "zod";
import { db } from "../db";
import { audit } from "../audit";
import { getSettings, patchSettings } from "../settings/service";
import { storeTypeDefinition } from "./store-profiles";
import { t } from "@/lib/i18n-text";
import type { CurrentStaff } from "../auth/session";

/**
 * Presentation of the active store type: trust-badge icons and product-card
 * specs. Both are saved with the type's profile when switching away and
 * restored when switching back (see store-profiles).
 */
export async function storeTypePage(locale: string) {
  const [settings, attributes] = await Promise.all([
    getSettings("storeType"),
    db.attribute.findMany({ orderBy: { position: "asc" }, select: { id: true, key: true, name: true, type: true, showOnCard: true, isFilterable: true, _count: { select: { productAttrs: true } } } }),
  ]);
  const def = await storeTypeDefinition(settings.type);
  return {
    settings,
    defaultIcons: def?.icons ?? null,
    attributes: attributes.map((a) => ({ id: a.id, key: a.key, name: t(a.name, locale), type: a.type, showOnCard: a.showOnCard, isFilterable: a.isFilterable, products: a._count.productAttrs })),
  };
}

const iconsSchema = z.object({ icons: z.object({ delivery: z.string().max(120).nullable(), warranty: z.string().max(120).nullable(), returns: z.string().max(120).nullable(), payment: z.string().max(120).nullable() }) });

/**
 * Trust-badge icons of the active type. The type itself only changes through
 * switchStoreType (server/admin/store-profiles), which initialises/restores
 * the profile — never by writing the setting directly.
 */
export async function saveStoreType(raw: unknown, staff: CurrentStaff) {
  const p = iconsSchema.parse(raw);
  await patchSettings("storeType", { icons: p.icons });
  await audit({ actor: staff, action: "settings.updated", entityType: "settings", entityId: "storeType", summary: "trust icons" });
}

/** Which attributes appear as specs on product cards. */
export async function setCardAttributes(raw: unknown, staff: CurrentStaff) {
  const ids = z.array(z.string().max(64)).max(10).parse(raw);
  await db.$transaction([db.attribute.updateMany({ where: { id: { notIn: ids } }, data: { showOnCard: false } }), db.attribute.updateMany({ where: { id: { in: ids } }, data: { showOnCard: true } })]);
  await audit({ actor: staff, action: "attributes.card_specs", entityType: "attribute", summary: `${ids.length} on cards` });
}

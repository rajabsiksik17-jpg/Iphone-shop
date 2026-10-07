import "server-only";
import { z } from "zod";
import { getCountries } from "libphonenumber-js";
import { db } from "../db";
import { Errors } from "../errors";
import { audit } from "../audit";
import { getSettings, patchSettings } from "../settings/service";
import { invalidateDestinations } from "../commerce/regions";
import { zoneForCountry } from "../commerce/shipping";
import { REGION_PRESETS, regionPresetCount } from "@/config/regions-data";
import { localized, t } from "@/lib/i18n-text";
import { localeMeta, type Locale } from "@/i18n/config";
import type { CurrentStaff } from "../auth/session";

/**
 * Countries & cities: where the store ships, the city / governorate list per
 * country, and per-city delivery pricing for each shipping method.
 */

export async function regionsOverview(locale: Locale) {
  const [{ allowedCountries }, { defaultCountry }] = await Promise.all([getSettings("checkout"), getSettings("geo")]);
  const names = new Intl.DisplayNames([localeMeta[locale].intl], { type: "region" });
  const counts = await db.region.groupBy({ by: ["country", "isActive"], _count: { _all: true } });
  const countOf = (code: string, active?: boolean) => counts.filter((c) => c.country === code && (active === undefined || c.isActive === active)).reduce((n, c) => n + c._count._all, 0);
  const shipping = allowedCountries.map((code) => ({ code, name: names.of(code) ?? code, cities: countOf(code), activeCities: countOf(code, true), preset: regionPresetCount(code) }));
  return {
    shipping,
    shipsEverywhere: allowedCountries.length === 0,
    defaultCountry,
    allCountries: getCountries().map((code) => ({ code, name: names.of(code) ?? code })).sort((a, b) => a.name.localeCompare(b.name, locale)),
  };
}

export async function countryRegions(country: string, locale: Locale) {
  const code = z.string().length(2).parse(country).toUpperCase();
  const zone = await zoneForCountry(code);
  const methods = (zone?.methods ?? []).map((m) => ({ id: m.id, name: t(m.name, locale), type: m.type, cost: m.cost, freeOver: m.freeOver, minDays: m.minDays, maxDays: m.maxDays, limitToRegions: m.limitToRegions }));
  const rows = await db.region.findMany({ where: { country: code }, orderBy: { position: "asc" }, include: { rates: true } });
  return {
    country: code,
    zone: zone ? { id: zone.id, name: zone.name } : null,
    methods,
    regions: rows.map((r) => ({
      id: r.id,
      name: r.name as Record<string, string>,
      group: r.group as Record<string, string>,
      label: t(r.name, locale),
      groupLabel: t(r.group, locale),
      isActive: r.isActive,
      rates: r.rates.filter((x) => methods.some((m) => m.id === x.methodId)).map((x) => ({ methodId: x.methodId, isAvailable: x.isAvailable, cost: x.cost, freeOver: x.freeOver, minDays: x.minDays, maxDays: x.maxDays })),
    })),
  };
}

const codes = z.array(z.string().length(2).transform((s) => s.toUpperCase())).max(250);

/** Shipping countries (empty = everywhere) and the default country. */
export async function saveCountries(raw: { countries: unknown; defaultCountry: unknown }, staff: CurrentStaff) {
  const list = [...new Set(codes.parse(raw.countries))];
  const def = z.string().length(2).parse(raw.defaultCountry).toUpperCase();
  if (list.length && !list.includes(def)) throw Errors.invalid({ defaultCountry: ["not_in_list"] });
  await patchSettings("checkout", { allowedCountries: list });
  await patchSettings("geo", { defaultCountry: def });
  invalidateDestinations();
  await audit({ actor: staff, action: "settings.updated", entityType: "settings", entityId: "countries", summary: list.length ? list.join(", ") : "all countries" });
}

/** Add the ready-made city list for a country (skips cities that already exist). */
export async function importPresetRegions(country: string, staff: CurrentStaff) {
  const code = z.string().length(2).parse(country).toUpperCase();
  const preset = REGION_PRESETS[code];
  if (!preset) throw Errors.notFound("preset");
  const existing = await db.region.findMany({ where: { country: code }, select: { name: true } });
  const have = new Set(existing.map((r) => t(r.name, "en").toLowerCase()));
  let position = existing.length;
  const data = preset.flatMap((g) => g.cities.filter((c) => !have.has(c.en.toLowerCase())).map((c) => ({ country: code, name: c, group: g.group, position: position++ })));
  if (data.length) await db.region.createMany({ data });
  invalidateDestinations();
  await audit({ actor: staff, action: "regions.imported", entityType: "region", summary: `${code}: ${data.length} cities` });
  return { added: data.length };
}

const regionSchema = z.object({ country: z.string().length(2), name: localized({ required: true, max: 80 }), group: localized({ max: 80 }).prefault({}), isActive: z.boolean() });

export async function saveRegion(id: string | null, raw: unknown, staff: CurrentStaff) {
  const p = regionSchema.parse(raw);
  const country = p.country.toUpperCase();
  const data = { country, name: p.name, group: p.group, isActive: p.isActive };
  const r = id ? await db.region.update({ where: { id }, data }) : await db.region.create({ data: { ...data, position: await db.region.count({ where: { country } }) } });
  invalidateDestinations();
  await audit({ actor: staff, action: id ? "region.updated" : "region.created", entityType: "region", entityId: r.id, summary: `${country} · ${t(p.name, "en")}` });
  return { id: r.id };
}

export async function bulkRegions(rawIds: unknown, rawOp: unknown, staff: CurrentStaff) {
  const ids = z.array(z.string().max(64)).min(1).max(1000).parse(rawIds);
  const op = z.enum(["activate", "deactivate", "delete"]).parse(rawOp);
  const res = op === "delete" ? await db.region.deleteMany({ where: { id: { in: ids } } }) : await db.region.updateMany({ where: { id: { in: ids } }, data: { isActive: op === "activate" } });
  invalidateDestinations();
  await audit({ actor: staff, action: `region.bulk_${op}`, entityType: "region", summary: `${res.count} cities` });
  return { done: res.count, skipped: [] as { id: string; reason: string }[] };
}

export async function reorderRegions(rawIds: unknown) {
  const ids = z.array(z.string().max(64)).max(1000).parse(rawIds);
  await db.$transaction(ids.map((id, position) => db.region.update({ where: { id }, data: { position } })));
  invalidateDestinations();
}

const rateSchema = z.object({
  methodId: z.string().max(64),
  /** default = use the method's own price/time; custom = override; unavailable = hide here. */
  mode: z.enum(["default", "custom", "unavailable"]),
  cost: z.number().int().min(0).max(100_000_000).nullable().optional(),
  freeOver: z.number().int().min(0).max(100_000_000).nullable().optional(),
  minDays: z.number().int().min(0).max(365).nullable().optional(),
  maxDays: z.number().int().min(0).max(365).nullable().optional(),
});

/** Set delivery pricing for one or many cities at once (per shipping method). */
export async function saveRegionRates(rawRegionIds: unknown, rawRates: unknown, staff: CurrentStaff) {
  const regionIds = z.array(z.string().max(64)).min(1).max(1000).parse(rawRegionIds);
  const rates = z.array(rateSchema).max(20).parse(rawRates);
  for (const r of rates) if (r.minDays != null && r.maxDays != null && r.minDays > r.maxDays) throw Errors.invalid({ [`rates.${r.methodId}.maxDays`]: ["min_gt_max"] });
  await db.$transaction(async (tx) => {
    for (const r of rates) {
      if (r.mode === "default") {
        await tx.shippingRegionRate.deleteMany({ where: { methodId: r.methodId, regionId: { in: regionIds } } });
        continue;
      }
      const data = r.mode === "unavailable" ? { isAvailable: false, cost: null, freeOver: null, minDays: null, maxDays: null } : { isAvailable: true, cost: r.cost ?? null, freeOver: r.freeOver ?? null, minDays: r.minDays ?? null, maxDays: r.maxDays ?? null };
      for (const regionId of regionIds) await tx.shippingRegionRate.upsert({ where: { methodId_regionId: { methodId: r.methodId, regionId } }, create: { methodId: r.methodId, regionId, ...data }, update: data });
    }
  });
  await audit({ actor: staff, action: "region.rates_updated", entityType: "region", summary: `${regionIds.length} cities · ${rates.length} methods` });
}

/** A method offered only in cities where it's explicitly enabled (e.g. express in main cities). */
export async function setMethodLimit(methodId: string, limit: boolean, staff: CurrentStaff) {
  await db.shippingMethod.update({ where: { id: z.string().max(64).parse(methodId) }, data: { limitToRegions: z.boolean().parse(limit) } });
  await audit({ actor: staff, action: "shipping.method_limit", entityType: "shipping", entityId: methodId, summary: String(limit) });
}

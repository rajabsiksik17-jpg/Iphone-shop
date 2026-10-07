import "server-only";
import { db } from "../db";
import { t } from "@/lib/i18n-text";

export type ShippingQuote = {
  id: string;
  name: string;
  description: string;
  cost: number;
  originalCost: number;
  free: boolean;
  minDays: number | null;
  maxDays: number | null;
  type: string;
  /** For FREE_OVER: how much more to spend for free shipping. */
  freeOverRemaining: number | null;
};

/** Pure rate calculation for a method. Exported for tests. */
export function rateFor(
  method: { type: string; cost: number; freeOver: number | null; perKg: number | null },
  subtotal: number,
  weightGrams: number,
  forceFree: boolean,
) {
  let cost = method.cost;
  if (method.type === "FREE" || method.type === "PICKUP" && method.cost === 0) cost = 0;
  if (method.type === "WEIGHT") cost = method.cost + Math.ceil(Math.max(0, weightGrams) / 1000) * (method.perKg ?? 0);
  const freeByThreshold = method.type === "FREE_OVER" && method.freeOver != null && subtotal >= method.freeOver;
  const original = cost;
  if (forceFree || freeByThreshold) cost = 0;
  return {
    cost,
    original,
    freeOverRemaining: method.type === "FREE_OVER" && method.freeOver != null && subtotal < method.freeOver ? method.freeOver - subtotal : null,
  };
}

export async function zoneForCountry(country: string) {
  const zones = await db.shippingZone.findMany({ where: { isActive: true }, orderBy: { position: "asc" }, include: { methods: { where: { isActive: true }, orderBy: { position: "asc" } } } });
  return zones.find((z) => z.countries.includes(country.toUpperCase())) ?? zones.find((z) => z.countries.length === 0) ?? null;
}

/**
 * Delivery options for a destination. A city (region) can override each
 * method: hide it, or change its price, free-delivery threshold and delivery
 * time. Methods marked "limitToRegions" are offered only in cities where they
 * are explicitly enabled.
 */
export async function quoteShipping(opts: { country: string; regionId?: string | null; subtotal: number; weightGrams: number; freeShipping: boolean; requiresShipping: boolean; locale: string }): Promise<ShippingQuote[]> {
  const zone = await zoneForCountry(opts.country);
  if (!zone) return [];
  const rates = opts.regionId ? await db.shippingRegionRate.findMany({ where: { regionId: opts.regionId, methodId: { in: zone.methods.map((m) => m.id) } } }) : [];
  return zone.methods
    .filter((m) => opts.requiresShipping || m.type === "PICKUP" || m.type === "FREE")
    .flatMap((base) => {
      const o = rates.find((r) => r.methodId === base.id);
      if (o && !o.isAvailable) return [];
      if (base.limitToRegions && !o) return [];
      return [{ ...base, cost: o?.cost ?? base.cost, freeOver: o?.freeOver ?? base.freeOver, minDays: o?.minDays ?? base.minDays, maxDays: o?.maxDays ?? base.maxDays }];
    })
    .map((m) => {
      const r = rateFor(m, opts.subtotal, opts.weightGrams, opts.freeShipping);
      return {
        id: m.id,
        name: t(m.name, opts.locale),
        description: t(m.description, opts.locale),
        cost: r.cost,
        originalCost: r.original,
        free: r.cost === 0,
        minDays: m.minDays,
        maxDays: m.maxDays,
        type: m.type,
        freeOverRemaining: r.freeOverRemaining,
      };
    });
}

/** Lowest "spend X more for free shipping" across the default zone — for the cart nudge. */
export async function freeShippingThreshold(country: string) {
  const zone = await zoneForCountry(country);
  const thresholds = zone?.methods.filter((m) => m.type === "FREE_OVER" && m.freeOver != null).map((m) => m.freeOver!) ?? [];
  return thresholds.length ? Math.min(...thresholds) : null;
}

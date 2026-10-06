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

export async function quoteShipping(opts: { country: string; subtotal: number; weightGrams: number; freeShipping: boolean; requiresShipping: boolean; locale: string }): Promise<ShippingQuote[]> {
  const zone = await zoneForCountry(opts.country);
  if (!zone) return [];
  return zone.methods
    .filter((m) => opts.requiresShipping || m.type === "PICKUP" || m.type === "FREE")
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

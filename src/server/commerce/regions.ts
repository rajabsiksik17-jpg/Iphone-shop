import "server-only";
import { getCountries } from "libphonenumber-js";
import { db } from "../db";
import { Errors } from "../errors";
import { getSettings } from "../settings/service";
import { t } from "@/lib/i18n-text";
import { localeMeta, type Locale } from "@/i18n/config";

/**
 * Delivery destinations: the countries the store ships to (Settings →
 * Countries & cities; empty = everywhere) and, per country, the cities /
 * governorates shoppers pick from at checkout. A country with cities makes
 * the city a required choice; one country only means no country picker.
 */
/** `alt`: the name (and region) in the other language, so either spelling finds it. */
export type DestinationRegion = { id: string; name: string; group: string; alt?: string };
export type Destinations = { countries: { code: string; name: string }[]; regions: Record<string, DestinationRegion[]> };

let cache: { at: number; locale: string; value: Destinations }[] = [];
const TTL = 60_000;

export function invalidateDestinations() {
  cache = [];
}

export async function checkoutDestinations(locale: Locale): Promise<Destinations> {
  const hit = cache.find((c) => c.locale === locale && Date.now() - c.at < TTL);
  if (hit) return hit.value;
  const { allowedCountries } = await getSettings("checkout");
  const names = new Intl.DisplayNames([localeMeta[locale].intl], { type: "region" });
  const codes = allowedCountries.length ? allowedCountries : getCountries();
  const countries = codes.map((code) => ({ code, name: names.of(code) ?? code })).sort((a, b) => a.name.localeCompare(b.name, locale));
  const rows = await db.region.findMany({ where: { isActive: true, country: { in: codes } }, orderBy: [{ country: "asc" }, { position: "asc" }], select: { id: true, country: true, name: true, group: true } });
  const regions: Record<string, DestinationRegion[]> = {};
  const other = locale === "ar" ? "en" : "ar";
  for (const r of rows) (regions[r.country] ??= []).push({ id: r.id, name: t(r.name, locale), group: t(r.group, locale), alt: `${t(r.name, other)} ${t(r.group, other)}` });
  const value = { countries, regions };
  cache = [...cache.filter((c) => c.locale !== locale), { at: Date.now(), locale, value }];
  return value;
}

/**
 * Validate a destination: the country must be allowed and, when it has
 * cities, a valid active city of that country is required. Returns the city's
 * names for the order record.
 */
export async function resolveDestination(country: string, regionId: string | null | undefined) {
  const { allowedCountries } = await getSettings("checkout");
  const code = country.toUpperCase();
  if (allowedCountries.length && !allowedCountries.includes(code)) throw Errors.invalid({ "address.country": ["not_shipped"] });
  const hasRegions = (await db.region.count({ where: { country: code, isActive: true } })) > 0;
  if (!hasRegions) return { country: code, region: null };
  if (!regionId) throw Errors.invalid({ "address.city": ["required"] });
  const region = await db.region.findFirst({ where: { id: regionId, country: code, isActive: true } });
  if (!region) throw Errors.invalid({ "address.city": ["required"] });
  return { country: code, region };
}

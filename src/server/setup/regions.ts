import "server-only";
import { db } from "../db";
import { REGION_PRESETS } from "@/config/regions-data";

/** Main cities where express delivery runs (the seeded express method is limited to these). */
const EXPRESS_CITIES = ["Riyadh", "Jeddah", "Dammam"];

/**
 * Saudi governorates for a fresh or upgraded store: imports the full list once
 * (only when the country has no cities yet) and limits the "Express" method to
 * the main cities. Safe to run repeatedly.
 */
export async function setupSaudiRegions() {
  if (await db.region.count({ where: { country: "SA" } })) return { added: 0 };
  let position = 0;
  const data = REGION_PRESETS.SA.flatMap((g) => g.cities.map((c) => ({ country: "SA", name: c, group: g.group, position: position++ })));
  await db.region.createMany({ data });

  const zone = await db.shippingZone.findFirst({ where: { countries: { has: "SA" } }, include: { methods: true } });
  const express = zone?.methods.find((m) => /express/i.test((m.name as { en?: string }).en ?? ""));
  if (express) {
    const cities = await db.region.findMany({ where: { country: "SA" }, select: { id: true, name: true } });
    const ids = cities.filter((c) => EXPRESS_CITIES.includes((c.name as { en?: string }).en ?? "")).map((c) => c.id);
    await db.shippingRegionRate.createMany({ data: ids.map((regionId) => ({ methodId: express.id, regionId, isAvailable: true })), skipDuplicates: true });
    await db.shippingMethod.update({ where: { id: express.id }, data: { limitToRegions: true } });
  }
  return { added: data.length };
}

/**
 * Store-type storage report: initialises every built-in store type once (or
 * measures what's already there) and reports the real footprint — database
 * rows/bytes per profile and media files/bytes, separating shared demo
 * assets from merchant uploads.
 *
 *   npm run report:storage            # measure what exists
 *   npm run report:storage -- --all   # initialise every type first (dev only)
 */
import "dotenv/config";
import fs from "node:fs/promises";
import path from "node:path";
import { dbAll, activeProfile } from "../src/server/db";
import { switchStoreType } from "../src/server/admin/store-profiles";
import { STORE_TYPES } from "../src/config/store-types";
import type { CurrentStaff } from "../src/server/auth/session";

const TABLES = ["Product", "ProductVariant", "VariantOption", "ProductAttribute", "ProductAttributeValue", "ProductImage", "ProductCategory", "InventoryMovement", "Category", "CategoryAttribute", "Brand", "Slider", "Slide", "PageSection", "Media", "Attribute", "AttributeValue", "StoreProfile"];

/** Row data per table (pg_column_size sum — excludes index/TOAST overhead, reported separately). */
async function tableBytes() {
  const out: Record<string, { bytes: number; rows: number }> = {};
  for (const t of TABLES) {
    const [r] = await dbAll.$queryRawUnsafe<{ bytes: bigint; n: bigint; data: bigint }[]>(`SELECT pg_total_relation_size('"${t}"') AS bytes, (SELECT count(*) FROM "${t}") AS n, (SELECT COALESCE(sum(pg_column_size(x.*)), 0) FROM "${t}" x) AS data`);
    out[t] = { bytes: Number(r.data), rows: Number(r.n) };
  }
  return out;
}

async function dirBytes(dir: string): Promise<{ files: number; bytes: number }> {
  let files = 0;
  let bytes = 0;
  const walk = async (d: string) => {
    for (const e of await fs.readdir(d, { withFileTypes: true }).catch(() => [])) {
      const full = path.join(d, e.name);
      if (e.isDirectory()) await walk(full);
      else {
        files++;
        bytes += (await fs.stat(full)).size;
      }
    }
  };
  await walk(dir);
  return { files, bytes };
}

const kb = (n: number) => `${(n / 1024).toFixed(1)} KB`;

async function main() {
  const all = process.argv.includes("--all");
  const storageDir = path.resolve(process.env.STORAGE_DIR ?? "storage");
  const before = { tables: await tableBytes(), demoDir: await dirBytes(path.join(storageDir, "demo")) };
  const start = await activeProfile();
  const timings: Record<string, number> = {};

  if (all) {
    const admin = await dbAll.user.findFirstOrThrow({ where: { role: { key: "super_admin" } }, include: { role: true } });
    const staff = { id: admin.id, email: admin.email, name: admin.name, permissions: admin.role!.permissions, roleId: admin.roleId, sessionId: "report" } as unknown as CurrentStaff;
    for (const type of STORE_TYPES) {
      const t0 = Date.now();
      const r = await switchStoreType(type.key, staff);
      if (r.initialized) timings[type.key] = Date.now() - t0;
      process.stdout.write(r.initialized ? "+" : ".");
    }
    await switchStoreType(start, staff);
    console.log("");
  }

  const after = { tables: await tableBytes(), demoDir: await dirBytes(path.join(storageDir, "demo")) };
  const perProfile = await dbAll.product.groupBy({ by: ["profile", "source"], _count: { _all: true } });
  const cats = await dbAll.category.groupBy({ by: ["profile"], _count: { _all: true } });
  const brands = await dbAll.brand.groupBy({ by: ["profile"], _count: { _all: true } });
  const demoMedia = await dbAll.media.aggregate({ where: { templateRef: { not: null } }, _count: { _all: true }, _sum: { size: true } });
  const allMedia = await dbAll.media.aggregate({ _count: { _all: true }, _sum: { size: true } });

  const delta = Object.fromEntries(TABLES.map((t) => [t, { rows: after.tables[t].rows - before.tables[t].rows, bytes: after.tables[t].bytes - before.tables[t].bytes }]));
  const dbDelta = Object.values(delta).reduce((n, d) => n + d.bytes, 0);
  const demoProfiles = perProfile.filter((r) => r.source === "DEMO");
  const report = {
    types: STORE_TYPES.length,
    initializedNow: Object.keys(timings).length,
    avgInitMs: Object.keys(timings).length ? Math.round(Object.values(timings).reduce((a, b) => a + b, 0) / Object.keys(timings).length) : null,
    perProfile: Object.fromEntries(
      [...new Set(perProfile.map((r) => r.profile))].map((p) => [p ?? "(shared)", { products: perProfile.filter((r) => r.profile === p).reduce((n, r) => n + r._count._all, 0), demo: demoProfiles.find((r) => r.profile === p)?._count._all ?? 0, categories: cats.find((c) => c.profile === p)?._count._all ?? 0, brands: brands.find((b) => b.profile === p)?._count._all ?? 0 }]),
    ),
    database: { rowDataAddedBytes: dbDelta, rowDataAdded: kb(dbDelta), perTable: delta, totalRowData: kb(Object.values(after.tables).reduce((n, d) => n + d.bytes, 0)) },
    media: {
      sharedDemoAssets: { files: demoMedia._count._all, mainFileBytes: demoMedia._sum.size ?? 0, onDisk: after.demoDir, onDiskHuman: kb(after.demoDir.bytes) },
      allMedia: { files: allMedia._count._all, mainFileBytes: allMedia._sum.size ?? 0 },
    },
  };
  console.log(JSON.stringify(report, null, 2));
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => dbAll.$disconnect());

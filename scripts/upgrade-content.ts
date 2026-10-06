/**
 * Content upgrades for existing installs (idempotent). Applies new defaults
 * that new installs get from the seed, without touching anything an admin
 * has already customised unless --replace is passed.
 *
 *   npm run upgrade:content            # add what's missing
 *   npm run upgrade:content -- --replace-nav   # rebuild header/top-bar menus
 */
import "dotenv/config";
import { db } from "../src/server/db";
import { buildDefaultNavigation } from "../src/server/setup/navigation";

async function main() {
  const replaceNav = process.argv.includes("--replace-nav");
  // Header menus from v1 have no automatic mega-menu entry: upgrade them.
  const header = await db.menu.findUnique({ where: { key: "header" }, include: { items: true } });
  const isV1 = header && !header.items.some((i) => i.type === "ALL_CATEGORIES");
  await buildDefaultNavigation({ replace: replaceNav || Boolean(isV1) });
  console.log(`  · Navigation ${replaceNav || isV1 ? "rebuilt" : "checked"} (header + top bar)`);
}

main()
  .then(() => db.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await db.$disconnect();
    process.exit(1);
  });

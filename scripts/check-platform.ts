/**
 * Read-only health check for the store-type profiles and super-admin guards:
 *   npm run check:platform
 */
import "dotenv/config";
import { dbAll, activeProfile } from "../src/server/db";

async function main() {
  const active = await activeProfile();
  const [profiles, unassigned, rls, triggers, supers] = await Promise.all([
    dbAll.storeProfile.findMany({ select: { key: true, initializedAt: true, templateVersion: true } }),
    Promise.all([dbAll.product.count({ where: { profile: null } }), dbAll.category.count({ where: { profile: null } }), dbAll.pageSection.count({ where: { profile: null, page: { slug: "home" } } })]),
    dbAll.$queryRaw<{ relname: string; relrowsecurity: boolean }[]>`SELECT relname, relrowsecurity FROM pg_class WHERE relname IN ('StoreProfile', 'User', 'Role', 'Product')`,
    dbAll.$queryRaw<{ tgname: string }[]>`SELECT tgname FROM pg_trigger WHERE tgname IN ('nq_protect_super_admin', 'nq_protect_super_role')`,
    dbAll.user.count({ where: { type: "STAFF", status: "ACTIVE", role: { permissions: { has: "*" } } } }),
  ]);
  console.log(
    JSON.stringify(
      {
        active,
        profiles: profiles.map((p) => `${p.key}${p.initializedAt ? "" : " (not initialised)"} v${p.templateVersion}`),
        sharedRows: { products: unassigned[0], categories: unassigned[1], homeSections: unassigned[2] },
        rowLevelSecurity: Object.fromEntries(rls.map((r) => [r.relname, r.relrowsecurity])),
        superAdminTriggers: triggers.map((t) => t.tgname),
        activeSuperAdmins: supers,
      },
      null,
      2,
    ),
  );
}
main().finally(() => dbAll.$disconnect());

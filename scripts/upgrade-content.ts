/**
 * Content upgrades for existing installs (idempotent). Applies new defaults
 * that new installs get from the seed, without touching anything an admin
 * has already customised unless --replace-nav is passed.
 *
 *   npm run upgrade:content                    # add/upgrade what's missing
 *   npm run upgrade:content -- --replace-nav   # force-rebuild header/top-bar menus
 */
import "dotenv/config";
import { db } from "../src/server/db";
import { buildDefaultNavigation, NAV_VERSION } from "../src/server/setup/navigation";
import { setupSaudiRegions } from "../src/server/setup/regions";
import { LEGACY_PAGE_SLUGS } from "../src/config/legal";
import { LEGAL_PAGES } from "../prisma/seed/content-data";
import { LEGACY_LEGAL } from "./legacy-legal";
import { CONTENT_PAIRS } from "./content-pairs";
import { swapContent } from "./lib/content-swap";
import { aboutSections, contactSections, type SectionSeed } from "../src/server/setup/pages";
import { ABOUT } from "../prisma/seed/content-data";

const STATE_KEY = "_content_upgrades";
const squash = (s: unknown) => (typeof s === "string" ? s.replace(/\s+/g, "") : "");

async function legalPages() {
  // 1. Clean, descriptive slugs (/privacy → /privacy-policy …). Menu items link by id, so they follow.
  for (const [from, to] of Object.entries(LEGACY_PAGE_SLUGS)) {
    const [old, current] = await Promise.all([db.page.findUnique({ where: { slug: from } }), db.page.findUnique({ where: { slug: to } })]);
    if (old && !current) {
      await db.page.update({ where: { id: old.id }, data: { slug: to } });
      console.log(`  · Page /${from} → /${to}`);
    }
  }
  // 2. Expanded starter texts — only where the admin never edited the old default.
  const legacyBodies = Object.values(LEGACY_LEGAL).flatMap((p) => [squash(p.body.en), squash(p.body.ar)]);
  for (const [slug, def] of Object.entries(LEGAL_PAGES)) {
    const page = await db.page.findUnique({ where: { slug }, include: { sections: { orderBy: { position: "asc" } } } });
    if (!page) {
      await db.page.create({
        data: { slug, template: "legal", title: def.title, excerpt: def.excerpt ?? {}, status: "PUBLISHED", isSystem: true, publishedAt: new Date(), sections: { create: [{ type: "rich_text", data: { body: def.body }, position: 0 }] } },
      });
      console.log(`  · Created /${slug}`);
      continue;
    }
    const rich = page.sections.find((s) => s.type === "rich_text");
    const body = (rich?.data as { body?: { en?: string; ar?: string } } | undefined)?.body;
    const untouched = body && legacyBodies.includes(squash(body.en)) && legacyBodies.includes(squash(body.ar));
    if (rich && untouched && squash(body.en) !== squash(def.body.en)) {
      await db.pageSection.update({ where: { id: rich.id }, data: { data: { ...(rich.data as object), body: def.body } } });
      console.log(`  · Updated text of /${slug}`);
    }
    const excerpt = page.excerpt as Record<string, string>;
    if (def.excerpt && !excerpt?.en && !excerpt?.ar) await db.page.update({ where: { id: page.id }, data: { excerpt: def.excerpt } });
    if (!page.isSystem) await db.page.update({ where: { id: page.id }, data: { isSystem: true, template: "legal" } });
  }
}

/**
 * About/Contact v2 layouts — only for pages still in their original default
 * layout (same section types as shipped), so admin edits are never replaced.
 */
async function infoPages() {
  const replace = async (slug: string, oldTypes: string[], build: (sections: { type: string; data: unknown }[]) => SectionSeed[]) => {
    const page = await db.page.findUnique({ where: { slug }, include: { sections: { orderBy: { position: "asc" } } } });
    if (!page) return;
    const types = page.sections.map((x) => x.type);
    if (types.join(",") !== oldTypes.join(",")) return;
    const next = build(page.sections);
    await db.$transaction([
      db.pageSection.deleteMany({ where: { pageId: page.id } }),
      ...next.map((x, position) => db.pageSection.create({ data: { pageId: page.id, type: x.type, data: x.data as object, style: x.style as object, position } })),
    ]);
    console.log(`  · /${slug} redesigned (${next.map((x) => x.type).join(", ")})`);
  };
  await replace("about", ["image_text", "features", "cta"], (old) => {
    const story = (old[0]?.data ?? {}) as { image?: { id: string; url: string } | null; eyebrow?: object; title?: object; body?: object };
    return aboutSections(story.image ?? null, { eyebrow: story.eyebrow ?? ABOUT.eyebrow, heading: story.title ?? ABOUT.heading, body: story.body ?? ABOUT.body });
  });
  await replace("contact", ["contact"], () => contactSections());
}

async function main() {
  const state = ((await db.setting.findUnique({ where: { key: STATE_KEY } }))?.value ?? {}) as { nav?: number };
  await legalPages();
  await infoPages();
  const fixed = await swapContent(CONTENT_PAIRS);
  if (fixed) console.log(`  · Default copy corrected in ${fixed} records`);

  const forceNav = process.argv.includes("--replace-nav");
  const navOutdated = (state.nav ?? 1) < NAV_VERSION;
  const regions = await setupSaudiRegions();
  if (regions.added) console.log(`  · Imported ${regions.added} Saudi cities & governorates`);
  await buildDefaultNavigation({ replace: forceNav || navOutdated });
  console.log(`  · Navigation ${forceNav || navOutdated ? `rebuilt (v${NAV_VERSION})` : "up to date"}`);

  await db.setting.upsert({ where: { key: STATE_KEY }, create: { key: STATE_KEY, value: { ...state, nav: NAV_VERSION } }, update: { value: { ...state, nav: NAV_VERSION } } });
}

main()
  .then(() => db.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await db.$disconnect();
    process.exit(1);
  });

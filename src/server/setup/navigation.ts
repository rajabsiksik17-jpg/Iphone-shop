import "server-only";
import { db } from "../db";

const L = (en: string, ar: string) => ({ en, ar });

/**
 * Default store navigation, shared by the seed (new installs) and the content
 * upgrade (existing installs):
 *
 *   header: All categories (mega) · top categories (auto subcategories) ·
 *           Brands (logo grid) · Offers
 *   topbar: Track order · Help & FAQ · About · Contact
 *
 * Category entries keep `autoChildren`, so subcategories created later show
 * up automatically. Everything stays editable in Admin → Content → Menus.
 */
export async function buildDefaultNavigation(opts: { replace?: boolean } = {}) {
  const roots = await db.category.findMany({ where: { parentId: null, isActive: true }, orderBy: { position: "asc" }, select: { id: true } });
  const pages = new Map((await db.page.findMany({ select: { id: true, slug: true } })).map((p) => [p.slug, p.id]));

  const header = await db.menu.upsert({ where: { key: "header" }, create: { key: "header", name: "Header navigation" }, update: {} });
  const existing = await db.menuItem.count({ where: { menuId: header.id } });
  if (!existing || opts.replace) {
    await db.menuItem.deleteMany({ where: { menuId: header.id } });
    let position = 0;
    await db.menuItem.create({ data: { menuId: header.id, type: "ALL_CATEGORIES", label: L("Categories", "التصنيفات"), position: position++ } });
    for (const r of roots.slice(0, 6)) await db.menuItem.create({ data: { menuId: header.id, type: "CATEGORY", refId: r.id, label: {}, autoChildren: true, position: position++ } });
    await db.menuItem.create({ data: { menuId: header.id, type: "ALL_BRANDS", label: L("Brands", "العلامات التجارية"), position: position++ } });
    await db.menuItem.create({ data: { menuId: header.id, type: "URL", url: "/shop?sale=1", label: L("Offers", "العروض"), highlight: true, position: position++ } });
  }

  const topbar = await db.menu.upsert({ where: { key: "topbar" }, create: { key: "topbar", name: "Top bar links" }, update: {} });
  if (!(await db.menuItem.count({ where: { menuId: topbar.id } })) || opts.replace) {
    await db.menuItem.deleteMany({ where: { menuId: topbar.id } });
    const items = [
      { type: "URL" as const, url: "/account/orders", label: L("Track order", "تتبع الطلب") },
      ...(pages.get("faq") ? [{ type: "PAGE" as const, refId: pages.get("faq"), label: L("Help & FAQ", "المساعدة") }] : []),
      ...(pages.get("about") ? [{ type: "PAGE" as const, refId: pages.get("about"), label: L("About us", "من نحن") }] : []),
      ...(pages.get("contact") ? [{ type: "PAGE" as const, refId: pages.get("contact"), label: L("Contact us", "تواصل معنا") }] : []),
    ];
    for (const [position, it] of items.entries()) await db.menuItem.create({ data: { menuId: topbar.id, ...it, position } });
  }
}

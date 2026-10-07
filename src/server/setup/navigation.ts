import "server-only";
import { db } from "../db";

const L = (en: string, ar: string) => ({ en, ar });

/** Bump when the default structure changes; existing installs upgrade once. */
export const NAV_VERSION = 2;

/**
 * Default store navigation, shared by the seed (new installs) and the content
 * upgrade (existing installs):
 *
 *   header: Home · Shop · Categories (category browser) · Offers · About · Contact
 *   topbar: Track order · Help & FAQ · Privacy · Terms
 *
 * Categories is a single entry that renders the whole category tree as a
 * mega menu / layered drawer — individual categories are never repeated in
 * the header, so new or renamed categories appear without editing the menu.
 * Everything stays editable in Admin → Content → Menus.
 */
export async function buildDefaultNavigation(opts: { replace?: boolean } = {}) {
  const pages = new Map((await db.page.findMany({ select: { id: true, slug: true } })).map((p) => [p.slug, p.id]));
  const page = (slug: string, label: { en: string; ar: string }) => (pages.get(slug) ? [{ type: "PAGE" as const, refId: pages.get(slug)!, label }] : []);

  const header = await db.menu.upsert({ where: { key: "header" }, create: { key: "header", name: "Header navigation" }, update: {} });
  if (!(await db.menuItem.count({ where: { menuId: header.id } })) || opts.replace) {
    await db.menuItem.deleteMany({ where: { menuId: header.id } });
    const items = [
      { type: "URL" as const, url: "/", label: L("Home", "الرئيسية") },
      { type: "SHOP" as const, label: L("Shop", "المتجر") },
      { type: "ALL_CATEGORIES" as const, label: L("Categories", "التصنيفات") },
      { type: "URL" as const, url: "/shop?sale=1", label: L("Offers", "العروض"), highlight: true },
      ...page("about", L("About us", "من نحن")),
      ...page("contact", L("Contact us", "تواصل معنا")),
    ];
    for (const [position, it] of items.entries()) await db.menuItem.create({ data: { menuId: header.id, ...it, position } });
  }

  const topbar = await db.menu.upsert({ where: { key: "topbar" }, create: { key: "topbar", name: "Top bar links" }, update: {} });
  if (!(await db.menuItem.count({ where: { menuId: topbar.id } })) || opts.replace) {
    await db.menuItem.deleteMany({ where: { menuId: topbar.id } });
    const items = [
      { type: "URL" as const, url: "/account/orders", label: L("Track order", "تتبع الطلب") },
      ...page("faq", L("Help & FAQ", "المساعدة")),
      ...page("privacy-policy", L("Privacy Policy", "سياسة الخصوصية")),
      ...page("terms-and-conditions", L("Terms & Conditions", "الشروط والأحكام")),
    ];
    for (const [position, it] of items.entries()) await db.menuItem.create({ data: { menuId: topbar.id, ...it, position } });
  }
}

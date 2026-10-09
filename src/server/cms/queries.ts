import "server-only";
import { cache } from "react";
import { db, inProfile } from "../db";
import { t } from "@/lib/i18n-text";
import { imageDTO } from "../catalog/dto";
import { categoryTree, type CategoryNode } from "../catalog/taxonomy";
import type { Tree } from "@/lib/category-tree";
import { parseSectionData, sectionStyleSchema } from "@/cms/sections";

export const getPage = cache(async (slug: string, opts: { preview?: boolean } = {}) => {
  const page = await db.page.findUnique({
    where: { slug },
    // Homepage sections belong to the active store type; other pages' are shared.
    include: { sections: { where: { AND: [opts.preview ? {} : { isVisible: true }, await inProfile()] }, orderBy: { position: "asc" } } },
  });
  if (!page || (!opts.preview && page.status !== "PUBLISHED")) return null;
  return {
    ...page,
    sections: page.sections.flatMap((s) => {
      try {
        return [{ id: s.id, type: s.type, data: parseSectionData(s.type, s.data), style: sectionStyleSchema.parse(s.style ?? {}) }];
      } catch {
        return []; // a malformed/unknown section never breaks the page
      }
    }),
  };
});

/** Published information pages (legal template), for "related policies" links. */
export const legalPageLinks = cache(async (locale: string) => {
  const rows = await db.page.findMany({ where: { template: "legal", status: "PUBLISHED" }, select: { slug: true, title: true }, orderBy: { slug: "asc" } });
  return rows.map((p) => ({ slug: p.slug, title: t(p.title, locale) })).filter((p) => p.title);
});

export type ResolvedMenuItem = {
  id: string;
  label: string;
  href: string;
  newTab: boolean;
  highlight: boolean;
  icon: string | null;
  image: string | null;
  badge: string | null;
  /** Products in this category and its subcategories (category entries only). */
  count?: number;
  /** How the desktop dropdown renders: plain list, category mega panel, brand grid. */
  kind: "link" | "all-categories" | "categories" | "brands";
  children: ResolvedMenuItem[];
};

/**
 * Resolve a menu for rendering. Category items with no hand-made children
 * (and autoChildren on) inherit their subcategories from the category tree,
 * so new categories appear in navigation without editing the menu.
 * "All categories" and "All brands" items expand automatically.
 */
export const getMenu = cache(async (key: string, locale: string): Promise<ResolvedMenuItem[]> => {
  const menu = await db.menu.findUnique({ where: { key }, include: { items: { where: { isVisible: true }, orderBy: { position: "asc" } } } });
  if (!menu) return [];
  const ids = (type: string) => menu.items.filter((i) => i.type === type && i.refId).map((i) => i.refId!);
  const needsTree = menu.items.some((i) => i.type === "ALL_CATEGORIES" || (i.type === "CATEGORY" && i.autoChildren));
  const needsBrands = menu.items.some((i) => i.type === "ALL_BRANDS");
  const [categories, brands, pages, products, tree, brandList] = await Promise.all([
    db.category.findMany({ where: { id: { in: ids("CATEGORY") }, isActive: true }, select: { id: true, fullSlug: true, name: true, icon: true, image: { select: { url: true } } } }),
    db.brand.findMany({ where: { id: { in: ids("BRAND") }, isActive: true }, select: { id: true, slug: true, name: true } }),
    db.page.findMany({ where: { id: { in: ids("PAGE") }, status: "PUBLISHED" }, select: { id: true, slug: true, title: true } }),
    db.product.findMany({ where: { id: { in: ids("PRODUCT") }, status: "ACTIVE" }, select: { id: true, slug: true, name: true } }),
    needsTree ? categoryTree(locale) : Promise.resolve([] as Tree<CategoryNode>[]),
    needsBrands ? db.brand.findMany({ where: { isActive: true }, orderBy: [{ isFeatured: "desc" }, { position: "asc" }], take: 24, select: { slug: true, name: true, logo: { select: { url: true } } } }) : Promise.resolve([]),
  ]);

  const fromNode = (n: Tree<CategoryNode>, depth: number): ResolvedMenuItem => ({
    id: `cat-${n.id}`,
    label: n.name,
    href: `/category/${n.fullSlug}`,
    newTab: false,
    highlight: false,
    icon: n.icon,
    image: n.image?.url ?? null,
    badge: null,
    count: n.productCount,
    kind: "link",
    children: depth < 3 ? n.children.map((c) => fromNode(c, depth + 1)) : [],
  });
  const findNode = (nodes: Tree<CategoryNode>[], id: string): Tree<CategoryNode> | null => {
    for (const n of nodes) {
      if (n.id === id) return n;
      const hit = findNode(n.children, id);
      if (hit) return hit;
    }
    return null;
  };

  const resolve = (i: (typeof menu.items)[number]): { href: string; fallback: string; image?: string | null; icon?: string | null } | null => {
    switch (i.type) {
      case "CATEGORY": {
        const c = categories.find((x) => x.id === i.refId);
        return c ? { href: `/category/${c.fullSlug}`, fallback: t(c.name, locale), image: c.image?.url, icon: c.icon } : null;
      }
      case "BRAND": {
        const b = brands.find((x) => x.id === i.refId);
        return b ? { href: `/brand/${b.slug}`, fallback: t(b.name, locale) } : null;
      }
      case "PAGE": {
        const p = pages.find((x) => x.id === i.refId);
        return p ? { href: p.slug === "home" ? "/" : `/${p.slug}`, fallback: t(p.title, locale) } : null;
      }
      case "PRODUCT": {
        const p = products.find((x) => x.id === i.refId);
        return p ? { href: `/product/${p.slug}`, fallback: t(p.name, locale) } : null;
      }
      case "SHOP":
        return { href: "/shop", fallback: locale === "ar" ? "المتجر" : "Shop" };
      case "ALL_CATEGORIES":
        return { href: "/shop", fallback: locale === "ar" ? "كل التصنيفات" : "All categories" };
      case "ALL_BRANDS":
        return { href: "/brands", fallback: locale === "ar" ? "العلامات التجارية" : "Brands" };
      default:
        return i.url ? { href: i.url, fallback: i.url } : null;
    }
  };
  const build = (parentId: string | null): ResolvedMenuItem[] =>
    menu.items
      .filter((i) => i.parentId === parentId)
      .flatMap((i) => {
        const r = resolve(i);
        if (!r) return [];
        let children = build(i.id);
        let kind: ResolvedMenuItem["kind"] = "link";
        if (i.type === "ALL_CATEGORIES") {
          kind = "all-categories";
          children = tree.map((n) => fromNode(n, 1));
        } else if (i.type === "ALL_BRANDS") {
          kind = "brands";
          children = brandList.map((b) => ({ id: `brand-${b.slug}`, label: t(b.name, locale), href: `/brand/${b.slug}`, newTab: false, highlight: false, icon: null, image: b.logo?.url ?? null, badge: null, kind: "link" as const, children: [] }));
        } else if (i.type === "CATEGORY" && !children.length && i.autoChildren && i.refId) {
          const node = findNode(tree, i.refId);
          if (node?.children.length) {
            kind = "categories";
            children = node.children.map((c) => fromNode(c, 1));
          }
        } else if (i.type === "CATEGORY" && children.length) kind = "categories";
        const badge = t(i.badge, locale) || null;
        return [{ id: i.id, label: t(i.label, locale) || r.fallback, href: r.href, newTab: i.openInNewTab, highlight: i.highlight, icon: i.icon ?? r.icon ?? null, image: i.image ?? r.image ?? null, badge, count: i.type === "CATEGORY" && i.refId ? findNode(tree, i.refId)?.productCount : undefined, kind, children }];
      });
  return build(null);
});

export const getSlider = cache(async (key: string, locale: string) => {
  const now = new Date();
  const slider = await db.slider.findUnique({
    where: { key },
    include: {
      slides: {
        where: { isVisible: true, AND: [{ OR: [{ startsAt: null }, { startsAt: { lte: now } }] }, { OR: [{ endsAt: null }, { endsAt: { gt: now } }] }] },
        orderBy: { position: "asc" },
        include: { desktopImage: true, tabletImage: true, mobileImage: true },
      },
    },
  });
  if (!slider) return null;
  // Language-specific artwork (media ids per device) takes precedence over the defaults.
  const overridesOf = (raw: unknown) => (((raw ?? {}) as Record<string, Record<string, string | null | undefined>>)[locale] ?? {}) as { desktop?: string | null; tablet?: string | null; mobile?: string | null };
  const overrideIds = slider.slides.flatMap((s) => Object.values(overridesOf(s.localeImages)).filter(Boolean) as string[]);
  const overrideMedia = new Map((overrideIds.length ? await db.media.findMany({ where: { id: { in: overrideIds } } }) : []).map((m) => [m.id, m]));
  const settings = slider.settings as { autoplay?: boolean; interval?: number; transition?: "slide" | "fade"; loop?: boolean; showArrows?: boolean; showDots?: boolean };
  return {
    settings: { autoplay: settings.autoplay ?? true, interval: settings.interval ?? 6000, transition: settings.transition ?? "fade", loop: settings.loop ?? true, showArrows: settings.showArrows ?? true, showDots: settings.showDots ?? true },
    slides: slider.slides.map((s) => {
      const own = overridesOf(s.localeImages);
      const pick = (sl: typeof s, device: "desktop" | "tablet" | "mobile") => (own[device] && overrideMedia.get(own[device]!)) || (device === "desktop" ? sl.desktopImage : device === "tablet" ? sl.tabletImage : sl.mobileImage);
      const style = s.style as Record<string, string | number | boolean>;
      const cta = (v: unknown) => {
        const c = (v ?? {}) as { label?: unknown; href?: string };
        const label = t(c.label, locale);
        return label && c.href ? { label, href: c.href } : null;
      };
      return {
        id: s.id,
        eyebrow: t(s.eyebrow, locale),
        heading: t(s.heading, locale),
        body: t(s.body, locale),
        primary: cta(s.primaryCta),
        secondary: cta(s.secondaryCta),
        desktop: imageDTO(pick(s, "desktop"), locale, t(s.heading, locale)),
        tablet: imageDTO(pick(s, "tablet"), locale, t(s.heading, locale)),
        mobile: imageDTO(pick(s, "mobile"), locale, t(s.heading, locale)),
        style: {
          align: (style.align as "start" | "center" | "end") ?? "start",
          vertical: (style.vertical as "top" | "center" | "bottom") ?? "center",
          textColor: (style.textColor as string) ?? "#ffffff",
          overlay: (style.overlay as string) ?? "#000000",
          overlayOpacity: Number(style.overlayOpacity ?? 35),
          background: (style.background as string) ?? "#0f172a",
          animation: (style.animation as "fade-up" | "fade" | "zoom" | "none") ?? "fade-up",
          buttonStyle: (style.buttonStyle as "solid" | "outline" | "glass") ?? "solid",
          headingSize: (style.headingSize as "sm" | "md" | "lg") ?? "md",
          mobileAlign: (style.mobileAlign as "inherit" | "start" | "center" | "end") ?? "inherit",
          mobileVertical: (style.mobileVertical as "inherit" | "top" | "center" | "bottom") ?? "inherit",
          showBodyOnMobile: style.showBodyOnMobile === true,
        },
      };
    }),
  };
});

export const getAnnouncements = cache(async (locale: string) => {
  const now = new Date();
  const rows = await db.announcement.findMany({
    where: { isActive: true, AND: [{ OR: [{ startsAt: null }, { startsAt: { lte: now } }] }, { OR: [{ endsAt: null }, { endsAt: { gt: now } }] }] },
    orderBy: { position: "asc" },
  });
  return rows.map((a) => ({ id: a.id, text: t(a.text, locale), url: a.url, icon: a.icon })).filter((a) => a.text);
});

export const getFaqs = cache(async (locale: string, categorySlug?: string) => {
  const rows = await db.faq.findMany({
    where: { isActive: true, ...(categorySlug ? { category: { slug: categorySlug } } : {}) },
    include: { category: true },
    orderBy: [{ category: { position: "asc" } }, { position: "asc" }],
  });
  return rows.map((f) => ({ id: f.id, question: t(f.question, locale), answer: t(f.answer, locale), category: f.category ? { slug: f.category.slug, name: t(f.category.name, locale) } : null }));
});

export const getSocialLinks = cache(async (placement?: string) => {
  const rows = await db.socialLink.findMany({ where: { isEnabled: true, ...(placement ? { placements: { has: placement } } : {}) }, orderBy: { position: "asc" } });
  return rows.map((r) => ({ platform: r.platform, url: r.url, label: r.label }));
});

export async function approvedTestimonials(locale: string, limit: number, minRating: number) {
  const rows = await db.review.findMany({
    where: { status: "APPROVED", rating: { gte: minRating }, body: { not: "" } },
    orderBy: [{ isVerifiedPurchase: "desc" }, { createdAt: "desc" }],
    take: limit,
    include: { product: { select: { slug: true, name: true } } },
  });
  return rows.map((r) => ({ id: r.id, author: r.authorName, rating: r.rating, title: r.title, body: r.body, verified: r.isVerifiedPurchase, product: { slug: r.product.slug, name: t(r.product.name, locale) } }));
}

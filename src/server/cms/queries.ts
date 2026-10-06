import "server-only";
import { cache } from "react";
import { db } from "../db";
import { t } from "@/lib/i18n-text";
import { imageDTO } from "../catalog/dto";
import { parseSectionData, sectionStyleSchema } from "@/cms/sections";

export const getPage = cache(async (slug: string, opts: { preview?: boolean } = {}) => {
  const page = await db.page.findUnique({
    where: { slug },
    include: { sections: { where: opts.preview ? {} : { isVisible: true }, orderBy: { position: "asc" } } },
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

export type ResolvedMenuItem = { id: string; label: string; href: string; newTab: boolean; highlight: boolean; children: ResolvedMenuItem[] };

export const getMenu = cache(async (key: string, locale: string): Promise<ResolvedMenuItem[]> => {
  const menu = await db.menu.findUnique({ where: { key }, include: { items: { orderBy: { position: "asc" } } } });
  if (!menu) return [];
  const ids = (type: string) => menu.items.filter((i) => i.type === type && i.refId).map((i) => i.refId!);
  const [categories, brands, pages, products] = await Promise.all([
    db.category.findMany({ where: { id: { in: ids("CATEGORY") }, isActive: true }, select: { id: true, fullSlug: true, name: true } }),
    db.brand.findMany({ where: { id: { in: ids("BRAND") }, isActive: true }, select: { id: true, slug: true, name: true } }),
    db.page.findMany({ where: { id: { in: ids("PAGE") }, status: "PUBLISHED" }, select: { id: true, slug: true, title: true } }),
    db.product.findMany({ where: { id: { in: ids("PRODUCT") }, status: "ACTIVE" }, select: { id: true, slug: true, name: true } }),
  ]);
  const resolve = (i: (typeof menu.items)[number]): { href: string; fallback: string } | null => {
    switch (i.type) {
      case "CATEGORY": {
        const c = categories.find((x) => x.id === i.refId);
        return c ? { href: `/category/${c.fullSlug}`, fallback: t(c.name, locale) } : null;
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
        return [{ id: i.id, label: t(i.label, locale) || r.fallback, href: r.href, newTab: i.openInNewTab, highlight: i.highlight, children: build(i.id) }];
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
        include: { desktopImage: true, mobileImage: true },
      },
    },
  });
  if (!slider) return null;
  const settings = slider.settings as { autoplay?: boolean; interval?: number; transition?: "slide" | "fade"; loop?: boolean; showArrows?: boolean; showDots?: boolean };
  return {
    settings: { autoplay: settings.autoplay ?? true, interval: settings.interval ?? 6000, transition: settings.transition ?? "fade", loop: settings.loop ?? true, showArrows: settings.showArrows ?? true, showDots: settings.showDots ?? true },
    slides: slider.slides.map((s) => {
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
        desktop: imageDTO(s.desktopImage, locale, t(s.heading, locale)),
        mobile: imageDTO(s.mobileImage, locale, t(s.heading, locale)),
        style: {
          align: (style.align as "start" | "center" | "end") ?? "start",
          vertical: (style.vertical as "top" | "center" | "bottom") ?? "center",
          textColor: (style.textColor as string) ?? "#ffffff",
          overlay: (style.overlay as string) ?? "#000000",
          overlayOpacity: Number(style.overlayOpacity ?? 35),
          background: (style.background as string) ?? "#0f172a",
          animation: (style.animation as "fade-up" | "fade" | "zoom" | "none") ?? "fade-up",
          buttonStyle: (style.buttonStyle as "solid" | "outline" | "glass") ?? "solid",
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

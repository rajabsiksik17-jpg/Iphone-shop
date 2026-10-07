import "server-only";
import { z } from "zod";
import { db, Prisma } from "../db";
import { Errors } from "../errors";
import { audit } from "../audit";
import { localized, t } from "@/lib/i18n-text";
import { parseSectionData, sectionDef, sectionStyleSchema } from "@/cms/sections";
import type { CurrentStaff } from "../auth/session";

const lt = (max = 2000) => localized({ max }).prefault({});
const dateOrNull = z.string().datetime().nullable();
const safeUrl = z.union([z.string().trim().regex(/^(\/(?!\/)|https?:\/\/|mailto:|tel:|#)/i).max(2000), z.literal("")]);

// ────────────────────────────────── Pages ───────────────────────────────────

export const PAGE_TEMPLATES = ["standard", "home", "contact", "faq", "legal"] as const;

export async function pageList(locale: string) {
  const rows = await db.page.findMany({ orderBy: [{ isSystem: "desc" }, { updatedAt: "desc" }], include: { _count: { select: { sections: true } } } });
  return rows.map((p) => ({
    id: p.id,
    slug: p.slug,
    title: t(p.title, locale) || p.slug,
    template: p.template,
    status: p.status,
    isSystem: p.isSystem,
    sections: p._count.sections,
    updatedAt: p.updatedAt.toISOString(),
  }));
}

/** Everything the page builder needs, including names for referenced records. */
export async function pageEditorData(slug: string, locale: string) {
  const page = slug === "new" ? null : await db.page.findUnique({ where: { slug }, include: { sections: { orderBy: { position: "asc" } } } });
  if (slug !== "new" && !page) return null;
  const productIds = new Set<string>();
  for (const s of page?.sections ?? []) {
    const def = sectionDef(s.type);
    for (const f of def?.fields ?? []) if (f.type === "products") for (const id of ((s.data as Record<string, unknown>)[f.key] as string[] | undefined) ?? []) productIds.add(id);
  }
  const [categories, brands, sliders, products] = await Promise.all([
    db.category.findMany({ select: { id: true, name: true, depth: true, path: true }, orderBy: [{ path: "asc" }] }),
    db.brand.findMany({ select: { id: true, name: true }, orderBy: { position: "asc" } }),
    db.slider.findMany({ select: { key: true, name: true } }),
    productIds.size
      ? db.product.findMany({ where: { id: { in: [...productIds] } }, select: { id: true, name: true, images: { take: 1, orderBy: { position: "asc" }, select: { media: { select: { url: true } } } } } })
      : [],
  ]);
  return {
    page: page
      ? {
          id: page.id,
          slug: page.slug,
          template: page.template,
          title: page.title as Record<string, string>,
          excerpt: page.excerpt as Record<string, string>,
          status: page.status,
          seo: page.seo as Record<string, unknown>,
          isSystem: page.isSystem,
          updatedAt: page.updatedAt.toISOString(),
          sections: page.sections.map((s) => ({ id: s.id, type: s.type, isVisible: s.isVisible, data: s.data as Record<string, unknown>, style: sectionStyleSchema.parse(s.style ?? {}) })),
        }
      : null,
    refs: {
      categories: (await import("./products")).sortTree(categories.map((c) => ({ ...c, position: 0 }))).map((c) => ({ id: c.id, name: `${"— ".repeat(c.depth)}${t(c.name, locale)}` })),
      brands: brands.map((b) => ({ id: b.id, name: t(b.name, locale) })),
      sliders: sliders.map((s) => ({ id: s.key, name: s.name })),
      products: products.map((p) => ({ id: p.id, name: t(p.name, locale), image: p.images[0]?.media.url ?? null })),
    },
  };
}
export type PageEditorData = NonNullable<Awaited<ReturnType<typeof pageEditorData>>>;

const seoSchema = z
  .object({ title: lt(160), description: lt(320), canonical: safeUrl.default(""), ogImage: z.string().max(2000).default(""), noindex: z.boolean().default(false) })
  .prefault({});

export const pageSchema = z.object({
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "invalid_slug")
    .max(80),
  template: z.enum(PAGE_TEMPLATES),
  title: localized({ required: true, max: 200 }),
  excerpt: lt(500),
  status: z.enum(["DRAFT", "PUBLISHED"]),
  seo: seoSchema,
  sections: z
    .array(z.object({ id: z.string().max(64).optional(), type: z.string().max(40), isVisible: z.boolean(), data: z.record(z.string(), z.unknown()), style: z.unknown() }))
    .max(60),
});

/** Slugs the storefront already routes; a CMS page must never shadow them. */
const RESERVED_SLUGS = new Set(["admin", "api", "shop", "category", "brand", "brands", "product", "search", "cart", "checkout", "account", "login", "register", "wishlist", "compare", "order", "media", "track", "forgot-password", "reset-password", "verify-email"]);

export async function savePage(id: string | null, raw: unknown, staff: CurrentStaff) {
  const p = pageSchema.parse(raw);
  const existing = id ? await db.page.findUnique({ where: { id } }) : null;
  if (id && !existing) throw Errors.notFound("page");
  // System pages keep their slug and template: storefront routes depend on them.
  const slug = existing?.isSystem ? existing.slug : p.slug;
  const template = existing?.isSystem ? existing.template : p.template;
  if (!existing?.isSystem && RESERVED_SLUGS.has(slug)) throw Errors.invalid({ slug: ["reserved"] });
  if (await db.page.findFirst({ where: { slug, ...(id ? { id: { not: id } } : {}) } })) throw Errors.invalid({ slug: ["taken"] });

  const sections = p.sections.map((s, i) => {
    if (!sectionDef(s.type)) throw Errors.invalid({ [`sections.${i}`]: ["unknown_type"] });
    try {
      return { id: s.id, type: s.type, isVisible: s.isVisible, data: parseSectionData(s.type, s.data) as Prisma.InputJsonValue, style: sectionStyleSchema.parse(s.style ?? {}) as Prisma.InputJsonValue, position: i };
    } catch (e) {
      if (e instanceof z.ZodError) throw Errors.invalid({ [`sections.${i}`]: e.issues.map((x) => `${x.path.join(".")}: ${x.message}`) });
      throw e;
    }
  });

  const data = {
    slug,
    template,
    title: p.title,
    excerpt: p.excerpt,
    status: p.status,
    seo: p.seo as Prisma.InputJsonValue,
    publishedAt: p.status === "PUBLISHED" ? (existing?.publishedAt ?? new Date()) : existing?.publishedAt ?? null,
  };
  const page = await db.$transaction(async (tx) => {
    const pg = id ? await tx.page.update({ where: { id }, data }) : await tx.page.create({ data });
    const keep = sections.filter((s) => s.id).map((s) => s.id!);
    await tx.pageSection.deleteMany({ where: { pageId: pg.id, id: { notIn: keep } } });
    for (const s of sections) {
      const row = { type: s.type, isVisible: s.isVisible, data: s.data, style: s.style, position: s.position };
      if (s.id && (await tx.pageSection.findFirst({ where: { id: s.id, pageId: pg.id }, select: { id: true } }))) await tx.pageSection.update({ where: { id: s.id }, data: row });
      else await tx.pageSection.create({ data: { ...row, pageId: pg.id } });
    }
    return pg;
  });
  await audit({ actor: staff, action: id ? "page.updated" : "page.created", entityType: "page", entityId: page.id, summary: `${t(p.title, "en")} (/${slug}) · ${sections.length} sections` });
  return { id: page.id, slug: page.slug };
}

export async function deletePage(id: string, staff: CurrentStaff) {
  const page = await db.page.findUnique({ where: { id } });
  if (!page) throw Errors.notFound("page");
  if (page.isSystem) throw Errors.conflict("system_page");
  await db.page.delete({ where: { id } });
  await audit({ actor: staff, action: "page.deleted", entityType: "page", entityId: id, summary: page.slug });
}

export async function duplicatePage(id: string, staff: CurrentStaff) {
  const page = await db.page.findUnique({ where: { id }, include: { sections: true } });
  if (!page) throw Errors.notFound("page");
  let slug = `${page.slug}-copy`;
  for (let n = 2; await db.page.findUnique({ where: { slug } }); n++) slug = `${page.slug}-copy-${n}`;
  const copy = await db.page.create({
    data: {
      slug,
      template: page.template === "home" ? "standard" : page.template,
      title: page.title as Prisma.InputJsonValue,
      excerpt: page.excerpt as Prisma.InputJsonValue,
      seo: page.seo as Prisma.InputJsonValue,
      status: "DRAFT",
      sections: { create: page.sections.map((s) => ({ type: s.type, position: s.position, isVisible: s.isVisible, data: s.data as Prisma.InputJsonValue, style: s.style as Prisma.InputJsonValue })) },
    },
  });
  await audit({ actor: staff, action: "page.duplicated", entityType: "page", entityId: copy.id, summary: `${page.slug} → ${slug}` });
  return { slug };
}

// ───────────────────────────────── Sliders ──────────────────────────────────

const ctaSchema = z.object({ label: lt(80), href: safeUrl.default("") }).prefault({});
const hex = z.string().regex(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);

const mediaId = z.string().max(64).nullable().optional();
const deviceImages = z.object({ desktop: mediaId, tablet: mediaId, mobile: mediaId }).partial();
/** Language-specific artwork; any device left empty falls back to the default image. */
const localeImagesSchema = z.object({ ar: deviceImages, en: deviceImages }).partial().prefault({});
export type LocaleImageIds = z.infer<typeof localeImagesSchema>;

export const slideSchema = z.object({
  id: z.string().max(64).optional(),
  isVisible: z.boolean(),
  startsAt: dateOrNull,
  endsAt: dateOrNull,
  desktopImageId: z.string().max(64).nullable(),
  tabletImageId: z.string().max(64).nullable().default(null),
  mobileImageId: z.string().max(64).nullable(),
  localeImages: localeImagesSchema,
  eyebrow: lt(120),
  heading: lt(200),
  body: lt(600),
  primaryCta: ctaSchema,
  secondaryCta: ctaSchema,
  style: z
    .object({
      align: z.enum(["start", "center", "end"]).default("start"),
      vertical: z.enum(["top", "center", "bottom"]).default("center"),
      textColor: hex.default("#ffffff"),
      overlay: hex.default("#000000"),
      overlayOpacity: z.coerce.number().int().min(0).max(90).default(35),
      background: hex.default("#0f172a"),
      animation: z.enum(["fade-up", "fade", "zoom", "none"]).default("fade-up"),
      buttonStyle: z.enum(["solid", "outline", "glass"]).default("solid"),
      // Responsive text: heading scale, and phone-specific alignment/position ("inherit" = same as desktop).
      headingSize: z.enum(["sm", "md", "lg"]).default("md"),
      mobileAlign: z.enum(["inherit", "start", "center", "end"]).default("inherit"),
      mobileVertical: z.enum(["inherit", "top", "center", "bottom"]).default("inherit"),
      showBodyOnMobile: z.boolean().default(false),
    })
    .prefault({}),
});

export const sliderSettingsSchema = z
  .object({
    autoplay: z.boolean().default(true),
    interval: z.coerce.number().int().min(2000).max(30000).default(6000),
    transition: z.enum(["fade", "slide"]).default("fade"),
    loop: z.boolean().default(true),
    showArrows: z.boolean().default(true),
    showDots: z.boolean().default(true),
  })
  .prefault({});

export async function sliderList() {
  const sliders = await db.slider.findMany({
    orderBy: { createdAt: "asc" },
    include: { slides: { orderBy: { position: "asc" }, include: { desktopImage: { select: { id: true, url: true } }, tabletImage: { select: { id: true, url: true } }, mobileImage: { select: { id: true, url: true } } } } },
  });
  // Language overrides store media ids; resolve them to previews for the editor.
  const overrideIds = sliders.flatMap((s) => s.slides.flatMap((sl) => Object.values((sl.localeImages ?? {}) as Record<string, Record<string, string | null>>).flatMap((d) => Object.values(d ?? {}).filter(Boolean) as string[])));
  const media = new Map((overrideIds.length ? await db.media.findMany({ where: { id: { in: overrideIds } }, select: { id: true, url: true } }) : []).map((m) => [m.id, m]));
  const resolveOverrides = (raw: unknown) => {
    const ids = localeImagesSchema.parse(raw ?? {});
    const dev = (d?: z.infer<typeof deviceImages>) => ({ desktop: (d?.desktop && media.get(d.desktop)) || null, tablet: (d?.tablet && media.get(d.tablet)) || null, mobile: (d?.mobile && media.get(d.mobile)) || null });
    return { ar: dev(ids.ar), en: dev(ids.en) };
  };
  const usedBy = await db.pageSection.findMany({ where: { type: "hero_slider" }, select: { data: true, page: { select: { slug: true, title: true } } } });
  return sliders.map((s) => ({
    id: s.id,
    key: s.key,
    name: s.name,
    settings: sliderSettingsSchema.parse(s.settings ?? {}),
    usedOn: usedBy.filter((u) => (u.data as { slider?: string }).slider === s.key).map((u) => u.page.slug),
    slides: s.slides.map((sl) => ({
      id: sl.id,
      isVisible: sl.isVisible,
      startsAt: sl.startsAt?.toISOString() ?? null,
      endsAt: sl.endsAt?.toISOString() ?? null,
      desktopImage: sl.desktopImage,
      tabletImage: sl.tabletImage,
      mobileImage: sl.mobileImage,
      localeImages: resolveOverrides(sl.localeImages),
      eyebrow: sl.eyebrow as Record<string, string>,
      heading: sl.heading as Record<string, string>,
      body: sl.body as Record<string, string>,
      primaryCta: ctaSchema.parse(sl.primaryCta ?? {}),
      secondaryCta: ctaSchema.parse(sl.secondaryCta ?? {}),
      style: slideSchema.shape.style.parse(sl.style ?? {}),
    })),
  }));
}

export const sliderSchema = z.object({
  key: z.string().trim().toLowerCase().regex(/^[a-z0-9-]{2,40}$/),
  name: z.string().trim().min(1).max(80),
  settings: sliderSettingsSchema,
  slides: z.array(slideSchema).max(20),
});

export async function saveSlider(id: string | null, raw: unknown, staff: CurrentStaff) {
  const p = sliderSchema.parse(raw);
  for (const [i, s] of p.slides.entries()) if (s.startsAt && s.endsAt && s.startsAt >= s.endsAt) throw Errors.invalid({ [`slides.${i}.endsAt`]: ["end_before_start"] });
  if (await db.slider.findFirst({ where: { key: p.key, ...(id ? { id: { not: id } } : {}) } })) throw Errors.invalid({ key: ["taken"] });
  const slider = await db.$transaction(async (tx) => {
    const sl = id ? await tx.slider.update({ where: { id }, data: { key: p.key, name: p.name, settings: p.settings } }) : await tx.slider.create({ data: { key: p.key, name: p.name, settings: p.settings } });
    await tx.slide.deleteMany({ where: { sliderId: sl.id, id: { notIn: p.slides.filter((s) => s.id).map((s) => s.id!) } } });
    for (const [position, s] of p.slides.entries()) {
      const row = {
        position,
        isVisible: s.isVisible,
        startsAt: s.startsAt ? new Date(s.startsAt) : null,
        endsAt: s.endsAt ? new Date(s.endsAt) : null,
        desktopImageId: s.desktopImageId,
        tabletImageId: s.tabletImageId,
        mobileImageId: s.mobileImageId,
        localeImages: s.localeImages,
        eyebrow: s.eyebrow,
        heading: s.heading,
        body: s.body,
        primaryCta: s.primaryCta,
        secondaryCta: s.secondaryCta,
        style: s.style,
      };
      if (s.id && (await tx.slide.findFirst({ where: { id: s.id, sliderId: sl.id }, select: { id: true } }))) await tx.slide.update({ where: { id: s.id }, data: row });
      else await tx.slide.create({ data: { ...row, sliderId: sl.id } });
    }
    return sl;
  });
  await audit({ actor: staff, action: id ? "slider.updated" : "slider.created", entityType: "slider", entityId: slider.id, summary: `${p.name} · ${p.slides.length} slides` });
  return { id: slider.id };
}

export async function deleteSlider(id: string, staff: CurrentStaff) {
  const s = await db.slider.delete({ where: { id } });
  await audit({ actor: staff, action: "slider.deleted", entityType: "slider", entityId: id, summary: s.name });
}

// ────────────────────────────── Announcements ───────────────────────────────

export async function announcementList() {
  const rows = await db.announcement.findMany({ orderBy: { position: "asc" } });
  const now = new Date();
  return rows.map((a) => ({
    id: a.id,
    text: a.text as Record<string, string>,
    url: a.url ?? "",
    icon: a.icon ?? "",
    isActive: a.isActive,
    startsAt: a.startsAt?.toISOString() ?? null,
    endsAt: a.endsAt?.toISOString() ?? null,
    live: a.isActive && (!a.startsAt || a.startsAt <= now) && (!a.endsAt || a.endsAt > now),
  }));
}

export const announcementSchema = z.object({
  text: localized({ required: true, max: 300 }),
  url: safeUrl,
  icon: z.string().max(80),
  isActive: z.boolean(),
  startsAt: dateOrNull,
  endsAt: dateOrNull,
});

export async function saveAnnouncement(id: string | null, raw: unknown, staff: CurrentStaff) {
  const p = announcementSchema.parse(raw);
  if (p.startsAt && p.endsAt && p.startsAt >= p.endsAt) throw Errors.invalid({ endsAt: ["end_before_start"] });
  const data = { text: p.text, url: p.url || null, icon: p.icon || null, isActive: p.isActive, startsAt: p.startsAt ? new Date(p.startsAt) : null, endsAt: p.endsAt ? new Date(p.endsAt) : null };
  const a = id ? await db.announcement.update({ where: { id }, data }) : await db.announcement.create({ data: { ...data, position: await db.announcement.count() } });
  await audit({ actor: staff, action: id ? "announcement.updated" : "announcement.created", entityType: "announcement", entityId: a.id, summary: t(p.text, "en") });
  return { id: a.id };
}

export async function deleteAnnouncement(id: string, staff: CurrentStaff) {
  const a = await db.announcement.delete({ where: { id } });
  await audit({ actor: staff, action: "announcement.deleted", entityType: "announcement", entityId: id, summary: t(a.text, "en") });
}

/** Persist a new order for any positioned model given its ids in order. */
export async function reorder(model: "announcement" | "faq" | "faqCategory" | "socialLink", ids: string[]) {
  await db.$transaction(ids.map((id, position) => (db[model] as unknown as { update: (a: object) => Prisma.PrismaPromise<unknown> }).update({ where: { id }, data: { position } })));
}

// ────────────────────────────────── Menus ───────────────────────────────────

export async function menuList(locale: string) {
  const [menus, pages, categories, brands] = await Promise.all([
    db.menu.findMany({ orderBy: { key: "asc" }, include: { items: { orderBy: { position: "asc" } } } }),
    db.page.findMany({ select: { id: true, slug: true, title: true }, orderBy: { slug: "asc" } }),
    db.category.findMany({ select: { id: true, name: true, depth: true, path: true } }),
    db.brand.findMany({ select: { id: true, name: true }, orderBy: { position: "asc" } }),
  ]);
  const productIds = menus.flatMap((m) => m.items.filter((i) => i.type === "PRODUCT" && i.refId).map((i) => i.refId!));
  const products = productIds.length ? await db.product.findMany({ where: { id: { in: productIds } }, select: { id: true, name: true, images: { take: 1, orderBy: { position: "asc" }, select: { media: { select: { url: true } } } } } }) : [];
  return {
    menus: menus.map((m) => ({
      id: m.id,
      key: m.key,
      name: m.name,
      items: m.items.map((i) => ({ id: i.id, parentId: i.parentId, label: i.label as Record<string, string>, type: i.type, refId: i.refId, url: i.url ?? "", openInNewTab: i.openInNewTab, highlight: i.highlight, icon: i.icon, image: i.image, badge: (i.badge ?? {}) as Record<string, string>, autoChildren: i.autoChildren, isVisible: i.isVisible })),
    })),
    refs: {
      pages: pages.map((p) => ({ id: p.id, name: `${t(p.title, locale) || p.slug} (/${p.slug === "home" ? "" : p.slug})` })),
      categories: (await import("./products")).sortTree(categories.map((c) => ({ ...c, position: 0 }))).map((c) => ({ id: c.id, name: `${"— ".repeat(c.depth)}${t(c.name, locale)}` })),
      brands: brands.map((b) => ({ id: b.id, name: t(b.name, locale) })),
      products: products.map((p) => ({ id: p.id, name: t(p.name, locale), image: p.images[0]?.media.url ?? null })),
    },
  };
}

const menuItemSchema = z.object({
  id: z.string().max(64),
  parentId: z.string().max(64).nullable(),
  label: lt(120),
  type: z.enum(["URL", "PAGE", "CATEGORY", "BRAND", "PRODUCT", "SHOP", "ALL_CATEGORIES", "ALL_BRANDS"]),
  refId: z.string().max(64).nullable(),
  url: safeUrl,
  openInNewTab: z.boolean(),
  highlight: z.boolean(),
  icon: z.string().trim().max(120).nullable().default(null),
  // Uploaded media URL (our storage) — relative or https only.
  image: z.string().trim().max(500).regex(/^(\/(?!\/)|https:\/\/)/).nullable().default(null),
  badge: lt(24),
  autoChildren: z.boolean().default(true),
  isVisible: z.boolean().default(true),
});

/** Types that point at nothing: their href and children are generated. */
const GENERATED = ["URL", "SHOP", "ALL_CATEGORIES", "ALL_BRANDS"];

export const menuSchema = z.object({ name: z.string().trim().min(1).max(80), items: z.array(menuItemSchema).max(200) });

/**
 * Replace a menu's items. Items carry client ids (existing cuid or "tmp-…")
 * so parents can be referenced before they exist; ids are remapped on create.
 */
export async function saveMenu(id: string, raw: unknown, staff: CurrentStaff) {
  const p = menuSchema.parse(raw);
  for (const [i, it] of p.items.entries()) {
    if (it.type === "URL" && !it.url) throw Errors.invalid({ [`items.${i}.url`]: ["required"] });
    if (["PAGE", "CATEGORY", "BRAND", "PRODUCT"].includes(it.type) && !it.refId) throw Errors.invalid({ [`items.${i}.refId`]: ["required"] });
    if (it.type === "URL" && !t(it.label, "en")) throw Errors.invalid({ [`items.${i}.label`]: ["required"] });
  }
  const ids = new Set(p.items.map((i) => i.id));
  // Max depth 3 and no dangling parents.
  const depth = (it: (typeof p.items)[number], n = 0): number => (it.parentId ? (n > 3 ? 99 : depth(p.items.find((x) => x.id === it.parentId)!, n + 1)) : n);
  for (const it of p.items) if (it.parentId && !ids.has(it.parentId)) throw Errors.invalid({ items: ["dangling_parent"] });
  for (const it of p.items) if (depth(it) > 2) throw Errors.invalid({ items: ["too_deep"] });

  await db.$transaction(async (tx) => {
    await tx.menu.update({ where: { id }, data: { name: p.name } });
    const existing = new Set((await tx.menuItem.findMany({ where: { menuId: id }, select: { id: true } })).map((i) => i.id));
    // Detach everything first so deletes/reparenting can't cascade unexpectedly.
    await tx.menuItem.updateMany({ where: { menuId: id }, data: { parentId: null } });
    await tx.menuItem.deleteMany({ where: { menuId: id, id: { notIn: [...ids].filter((x) => existing.has(x)) } } });
    const real = new Map<string, string>();
    const positions = new Map<string | null, number>();
    // Parents before children: process by depth.
    const ordered = [...p.items].sort((a, b) => depth(a) - depth(b));
    for (const it of ordered) {
      const parentId = it.parentId ? real.get(it.parentId)! : null;
      const position = positions.get(parentId) ?? 0;
      positions.set(parentId, position + 1);
      const row = { label: it.label, type: it.type, refId: GENERATED.includes(it.type) ? null : it.refId, url: it.type === "URL" ? it.url : null, openInNewTab: it.openInNewTab, highlight: it.highlight, icon: it.icon || null, image: it.image || null, badge: it.badge, autoChildren: it.autoChildren, isVisible: it.isVisible, parentId, position };
      if (existing.has(it.id)) {
        await tx.menuItem.update({ where: { id: it.id }, data: row });
        real.set(it.id, it.id);
      } else {
        const created = await tx.menuItem.create({ data: { ...row, menuId: id } });
        real.set(it.id, created.id);
      }
    }
    // Positions above are assigned in depth order, which preserves sibling order
    // because `ordered` is a stable sort of the submitted list.
  });
  await audit({ actor: staff, action: "menu.updated", entityType: "menu", entityId: id, summary: `${p.name} · ${p.items.length} items` });
}

// ─────────────────────────────────── FAQ ────────────────────────────────────

export async function faqList() {
  const [categories, faqs] = await Promise.all([db.faqCategory.findMany({ orderBy: { position: "asc" }, include: { _count: { select: { faqs: true } } } }), db.faq.findMany({ orderBy: { position: "asc" } })]);
  return {
    categories: categories.map((c) => ({ id: c.id, slug: c.slug, name: c.name as Record<string, string>, count: c._count.faqs })),
    faqs: faqs.map((f) => ({ id: f.id, categoryId: f.categoryId, question: f.question as Record<string, string>, answer: f.answer as Record<string, string>, isActive: f.isActive })),
  };
}

export const faqSchema = z.object({ categoryId: z.string().max(64).nullable(), question: localized({ required: true, max: 300 }), answer: localized({ required: true, max: 5000 }), isActive: z.boolean() });

export async function saveFaq(id: string | null, raw: unknown, staff: CurrentStaff) {
  const p = faqSchema.parse(raw);
  const f = id ? await db.faq.update({ where: { id }, data: p }) : await db.faq.create({ data: { ...p, position: await db.faq.count({ where: { categoryId: p.categoryId } }) } });
  await audit({ actor: staff, action: id ? "faq.updated" : "faq.created", entityType: "faq", entityId: f.id, summary: t(p.question, "en") });
  return { id: f.id };
}

export async function deleteFaq(id: string, staff: CurrentStaff) {
  const f = await db.faq.delete({ where: { id } });
  await audit({ actor: staff, action: "faq.deleted", entityType: "faq", entityId: id, summary: t(f.question, "en") });
}

export const faqCategorySchema = z.object({ slug: z.string().trim().toLowerCase().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(60), name: localized({ required: true, max: 120 }) });

export async function saveFaqCategory(id: string | null, raw: unknown, staff: CurrentStaff) {
  const p = faqCategorySchema.parse(raw);
  if (await db.faqCategory.findFirst({ where: { slug: p.slug, ...(id ? { id: { not: id } } : {}) } })) throw Errors.invalid({ slug: ["taken"] });
  const c = id ? await db.faqCategory.update({ where: { id }, data: p }) : await db.faqCategory.create({ data: { ...p, position: await db.faqCategory.count() } });
  await audit({ actor: staff, action: "faq_category.saved", entityType: "faq_category", entityId: c.id, summary: t(p.name, "en") });
  return { id: c.id };
}

export async function deleteFaqCategory(id: string, staff: CurrentStaff) {
  // Questions are kept (uncategorised) via onDelete: SetNull.
  const c = await db.faqCategory.delete({ where: { id } });
  await audit({ actor: staff, action: "faq_category.deleted", entityType: "faq_category", entityId: id, summary: t(c.name, "en") });
}

// ────────────────────────────────── Social ──────────────────────────────────

export const SOCIAL_PLATFORMS = ["facebook", "instagram", "x", "tiktok", "youtube", "linkedin", "snapchat", "whatsapp", "telegram", "pinterest", "threads", "discord", "reddit"] as const;
export const SOCIAL_PLACEMENTS = ["header", "footer", "contact", "about", "home", "floating"] as const;

export async function socialList() {
  const rows = await db.socialLink.findMany({ orderBy: { position: "asc" } });
  // Every supported platform is listed, configured or not, in saved order.
  const missing = SOCIAL_PLATFORMS.filter((p) => !rows.some((r) => r.platform === p));
  return [
    ...rows.map((r) => ({ platform: r.platform, label: r.label ?? "", url: r.url, isEnabled: r.isEnabled, placements: r.placements })),
    ...missing.map((platform) => ({ platform, label: "", url: "", isEnabled: false, placements: ["footer"] as string[] })),
  ];
}

const socialItem = z
  .object({
    platform: z.enum(SOCIAL_PLATFORMS),
    label: z.string().trim().max(60),
    url: z.union([z.string().trim().url().regex(/^https:\/\//i, "https_only").max(500), z.literal("")]),
    isEnabled: z.boolean(),
    placements: z.array(z.enum(SOCIAL_PLACEMENTS)).max(SOCIAL_PLACEMENTS.length),
  })
  .refine((s) => !s.isEnabled || s.url, { path: ["url"], message: "required" });

export async function saveSocial(raw: unknown, staff: CurrentStaff) {
  const items = z.array(socialItem).max(SOCIAL_PLATFORMS.length).parse(raw);
  await db.$transaction(
    items.map((s, position) =>
      db.socialLink.upsert({ where: { platform: s.platform }, create: { ...s, label: s.label || null, position }, update: { ...s, label: s.label || null, position } }),
    ),
  );
  await audit({ actor: staff, action: "social.updated", summary: items.filter((s) => s.isEnabled).map((s) => s.platform).join(", ") || "none enabled" });
}

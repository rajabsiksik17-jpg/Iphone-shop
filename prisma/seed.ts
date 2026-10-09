/**
 * Seed script.
 *   Essentials (always, idempotent): roles, currencies, order statuses, email
 *   templates, integrations, social platforms, first super-admin.
 *   Demo data (SEED_DEMO != "false", only on an empty catalogue): brands,
 *   categories, attributes, ~40 products with generated imagery, CMS pages,
 *   menus, slides, coupons, shipping, demo customers, orders and reviews.
 *
 * Run with `npm run db:seed` (uses the react-server condition so app services
 * can be reused directly).
 */
import "dotenv/config";
import sharp from "sharp";
import { db } from "../src/server/db";
import { hashPassword } from "../src/server/auth/password";
import { processImage } from "../src/server/media/images";
import { refreshProductDerived } from "../src/server/catalog/derived";
import { SYSTEM_ROLES } from "../src/config/permissions";
import { EMAIL_TEMPLATES } from "../src/server/email/defaults";
import { INTEGRATIONS } from "../src/server/integrations/registry";
import { initialSectionData } from "../src/cms/sections";
import { aboutSections, contactSections } from "../src/server/setup/pages";
import { buildFullSlug, buildPath, depthOf } from "../src/lib/category-tree";
import { ATTRIBUTES, ATTRIBUTE_GROUPS, BRANDS, CATEGORIES, COLORS, PRODUCTS, type CategoryDef } from "./seed/catalog-data";
import { ABOUT, ANNOUNCEMENTS, FAQS, FAQ_CATEGORIES, LEGAL_PAGES, SOCIAL_PLATFORMS } from "./seed/content-data";
import { CURRENCY_CATALOG } from "../src/config/currencies";
import { BANK_INSTRUCTIONS } from "../scripts/content-pairs";
import { buildDefaultNavigation, NAV_VERSION } from "../src/server/setup/navigation";
import { setupSaudiRegions } from "../src/server/setup/regions";
import { setupPlatform } from "../src/server/setup/platform";
import { brandLogo, categoryArt, productArt, slideArt, bannerArt, type DeviceKind } from "./seed/art";

const L = (en: string, ar: string) => ({ en, ar });
const SAR = (major: number) => Math.round(major * 100);
// Catalogue prices in the data files are authored in JOD; both JOD and SAR are
// pegged to the US dollar, so the conversion is stable. Retail-style rounding:
// whole riyals, ending in 9 above 100 SAR (799 JOD → 4,229 SAR).
const JOD_TO_SAR = 5.29;
const retail = (jod: number) => {
  const sar = jod * JOD_TO_SAR;
  return SAR(sar >= 100 ? Math.round(sar / 10) * 10 - 1 : Math.round(sar));
};
const log = (...a: unknown[]) => console.log("  ·", ...a);

async function svgMedia(svg: string, folder: string, alt?: { en: string; ar: string }, width?: number) {
  let img = sharp(Buffer.from(svg));
  if (width) img = img.resize({ width });
  const png = await img.png().toBuffer();
  return processImage(png, { folder, alt, quality: 84 });
}

// ─────────────────────────────── Essentials ─────────────────────────────────

async function essentials() {
  console.log("Seeding essentials…");
  for (const r of SYSTEM_ROLES) {
    await db.role.upsert({ where: { key: r.key }, create: { key: r.key, name: r.name, permissions: r.permissions, isSystem: true }, update: {} });
  }

  // SAR is the base currency; the others are display currencies whose rates
  // are refreshed from the rates provider (see server/commerce/fx.ts).
  const approxRates: Record<string, number> = { SAR: 1, AED: 0.98, QAR: 0.97, KWD: 0.082, BHD: 0.1, OMR: 0.103, JOD: 0.189, EGP: 13, IQD: 349, MAD: 2.5, TND: 0.82, DZD: 35.8, TRY: 10.9, USD: 0.2667, EUR: 0.23, GBP: 0.2 };
  for (const [position, c] of CURRENCY_CATALOG.entries()) {
    const data = { code: c.code, name: c.name, symbol: c.symbol, decimals: c.decimals, flag: c.flag, symbolPosition: ["USD", "EUR", "GBP", "TRY"].includes(c.code) ? ("BEFORE" as const) : ("AFTER" as const), rate: approxRates[c.code] ?? 1, isBase: c.code === "SAR", autoRate: c.code !== "SAR", position };
    await db.currency.upsert({ where: { code: c.code }, create: data, update: {} });
  }

  const statuses = [
    { key: "pending", label: L("Pending", "قيد الانتظار"), color: "#d97706", position: 0, countsAsSale: true },
    { key: "paid", label: L("Paid", "مدفوع"), color: "#0891b2", position: 1, notifyCustomer: false },
    { key: "processing", label: L("Processing", "قيد التجهيز"), color: "#4f46e5", position: 2, notifyCustomer: true },
    { key: "shipped", label: L("Shipped", "تم الشحن"), color: "#7c3aed", position: 3, notifyCustomer: true, emailTemplate: "order_shipped" },
    { key: "completed", label: L("Completed", "مكتمل"), color: "#059669", position: 4, isFinal: true, notifyCustomer: true, emailTemplate: "order_completed" },
    { key: "cancelled", label: L("Cancelled", "ملغي"), color: "#64748b", position: 5, isFinal: true, restocks: true, countsAsSale: false, notifyCustomer: true, emailTemplate: "order_cancelled" },
    { key: "refunded", label: L("Refunded", "مسترد"), color: "#e11d48", position: 6, isFinal: true, countsAsSale: false },
    { key: "failed", label: L("Failed", "فشل"), color: "#991b1b", position: 7, isFinal: true, restocks: true, countsAsSale: false },
  ];
  for (const s of statuses) await db.orderStatus.upsert({ where: { key: s.key }, create: { ...s, isSystem: true }, update: {} });

  for (const tpl of EMAIL_TEMPLATES) {
    await db.emailTemplate.upsert({ where: { key: tpl.key }, create: { key: tpl.key, subject: tpl.subject, body: tpl.body }, update: {} });
  }

  for (const [i, def] of INTEGRATIONS.entries()) {
    const enabled = def.key === "cod" || def.key === "bank_transfer";
    await db.integration.upsert({
      where: { key: def.key },
      create: {
        key: def.key,
        category: def.category,
        isEnabled: enabled,
        position: i,
        status: enabled ? "CONNECTED" : "NOT_CONFIGURED",
        config:
          def.key === "bank_transfer"
            ? {
                instructions_en: BANK_INSTRUCTIONS.en,
                instructions_ar: BANK_INSTRUCTIONS.ar,
              }
            : def.key === "cod"
              ? { instructions_en: "Pay the courier in cash when your order arrives.", instructions_ar: "ادفع للمندوب نقداً عند وصول طلبك." }
              : {},
      },
      update: {},
    });
  }

  for (const [i, platform] of SOCIAL_PLATFORMS.entries()) {
    await db.socialLink.upsert({ where: { platform }, create: { platform, url: "", isEnabled: false, placements: ["footer", "contact", "floating"], position: i }, update: {} });
  }

  const email = (process.env.SEED_ADMIN_EMAIL ?? "admin@nuqta.test").toLowerCase();
  const password = process.env.SEED_ADMIN_PASSWORD;
  if (!(await db.user.findFirst({ where: { type: "STAFF" } }))) {
    if (!password) throw new Error("Set SEED_ADMIN_PASSWORD in .env to create the first admin account.");
    const role = await db.role.findUniqueOrThrow({ where: { key: "super_admin" } });
    await db.user.create({ data: { email, name: "Store Owner", type: "STAFF", roleId: role.id, passwordHash: await hashPassword(password), locale: "en", agentStatus: "ONLINE" } });
    log(`Super admin created: ${email} (password from SEED_ADMIN_PASSWORD)`);
  }
}

// ──────────────────────────────── Catalogue ─────────────────────────────────

async function catalogue() {
  console.log("Seeding attributes…");
  const groups = new Map<string, string>();
  for (const g of ATTRIBUTE_GROUPS) groups.set(g.key, (await db.attributeGroup.create({ data: g })).id);

  const attrIds = new Map<string, string>();
  const valueIds = new Map<string, string>(); // "attr:slug" -> id
  for (const [i, a] of ATTRIBUTES.entries()) {
    const created = await db.attribute.create({
      data: {
        key: a.key,
        name: a.name,
        type: a.type,
        groupId: groups.get(a.group),
        isFilterable: a.filterable ?? false,
        isVariantOption: a.variant ?? false,
        position: i,
        unit: a.unit,
        values: { create: (a.values ?? []).map((v, j) => ({ slug: v.slug, label: v.label, colorHex: "hex" in v ? v.hex : null, position: j })) },
      },
      include: { values: true },
    });
    attrIds.set(a.key, created.id);
    for (const v of created.values) valueIds.set(`${a.key}:${v.slug}`, v.id);
  }

  console.log("Seeding brands…");
  const brandIds = new Map<string, string>();
  for (const [i, b] of BRANDS.entries()) {
    const logo = await svgMedia(brandLogo(b.name.en, b.color), "brands", b.name, 600);
    const banner = await svgMedia(bannerArt({ from: "#0b1220", to: b.color, kind: "phone-pro", color: "#d9dadc" }), "brands", b.name, 1600);
    const created = await db.brand.create({
      data: { slug: b.slug, name: b.name, description: b.description, logoId: logo.id, bannerId: banner.id, isFeatured: b.featured, position: i },
    });
    brandIds.set(b.slug, created.id);
  }

  console.log("Seeding categories…");
  const catIds = new Map<string, { id: string; path: string }>();
  async function createCategory(def: CategoryDef, parent: { id: string; path: string; fullSlug: string } | null, position: number) {
    const image = def.art ? await svgMedia(categoryArt(def.art.kind, def.art.color, def.art.tint), "categories", def.name, 800) : null;
    const tmp = await db.category.create({
      data: {
        slug: def.slug,
        fullSlug: buildFullSlug(parent?.fullSlug ?? null, def.slug),
        path: "/pending/",
        parentId: parent?.id,
        name: def.name,
        description: def.description ?? {},
        isFeatured: def.featured ?? false,
        icon: def.icon,
        position,
        imageId: image?.id,
      },
    });
    const path = buildPath(parent?.path ?? null, tmp.id);
    const c = await db.category.update({ where: { id: tmp.id }, data: { path, depth: depthOf(path) } });
    catIds.set(def.slug, { id: c.id, path });
    for (const [j, key] of (def.attributes ?? []).entries()) {
      await db.categoryAttribute.create({ data: { categoryId: c.id, attributeId: attrIds.get(key)!, position: j } });
    }
    for (const [j, child] of (def.children ?? []).entries()) await createCategory(child, { id: c.id, path, fullSlug: c.fullSlug }, j);
  }
  for (const [i, c] of CATEGORIES.entries()) await createCategory(c, null, i);

  console.log(`Seeding ${PRODUCTS.length} products (generating imagery)…`);
  const now = Date.now();
  for (const [index, p] of PRODUCTS.entries()) {
    const colorAxis = p.axes?.find((a) => a.attr === "color");
    const colorSlugs = colorAxis?.values ?? p.colors ?? ["black"];
    const hex = (slug: string) => (COLORS as Record<string, { hex: string }>)[slug]?.hex ?? "#1c1c1e";

    // Two gallery images for the hero colour + one per additional colour.
    const images: { mediaId: string; valueSlug: string | null }[] = [];
    for (const [ci, slug] of colorSlugs.entries()) {
      const views = ci === 0 ? [0, 1] : [0];
      for (const v of views) {
        const m = await svgMedia(productArt(p.kind as DeviceKind, hex(slug), v + ci), "products", { en: `${p.name.en} — ${slug}`, ar: `${p.name.ar} — ${slug}` }, 1200);
        images.push({ mediaId: m.id, valueSlug: colorAxis ? slug : null });
      }
    }

    const primaryCat = catIds.get(p.categories[0])!;
    const variable = Boolean(p.axes?.length);
    const created = await db.product.create({
      data: {
        slug: p.slug,
        sku: p.sku,
        name: p.name,
        shortDescription: p.short,
        description: p.description ?? { en: `<p>${p.short.en}</p>`, ar: `<p>${p.short.ar}</p>` },
        type: variable ? "VARIABLE" : "SIMPLE",
        status: "ACTIVE",
        publishedAt: new Date(now - (PRODUCTS.length - index) * 86_400_000 * 1.5),
        createdAt: new Date(now - (PRODUCTS.length - index) * 86_400_000 * 1.5),
        brandId: brandIds.get(p.brand),
        price: retail(p.price),
        salePrice: p.sale ? retail(p.sale) : null,
        saleEndsAt: p.sale && p.saleDays ? new Date(now + p.saleDays * 86_400_000) : null,
        costPrice: Math.round(retail(p.price) * 0.78),
        stock: variable ? 0 : (p.stock ?? 25),
        weightGrams: p.weight,
        warranty: p.warranty ?? {},
        isFeatured: p.flags?.featured ?? false,
        isNew: p.flags?.new ?? false,
        isBestSeller: p.flags?.bestSeller ?? false,
        isLimited: p.flags?.limited ?? false,
        modelNumber: p.sku.replace(/^[A-Z]+-/, ""),
        manufacturer: BRANDS.find((b) => b.slug === p.brand)?.name.en,
        seo: {},
        categories: { create: p.categories.map((slug, i) => ({ categoryId: catIds.get(slug)!.id, isPrimary: i === 0 })) },
        images: {
          create: images.map((img, i) => ({ mediaId: img.mediaId, position: i, valueId: img.valueSlug ? valueIds.get(`color:${img.valueSlug}`) : null })),
        },
      },
    });
    void primaryCat;

    // Specifications & descriptive attributes
    let position = 0;
    const variantAttrKeys = new Set((p.axes ?? []).map((a) => a.attr));
    for (const [key, raw] of Object.entries(p.specs ?? {})) {
      if (variantAttrKeys.has(key as "color")) continue;
      const def = ATTRIBUTES.find((a) => a.key === key)!;
      const pa = await db.productAttribute.create({
        data: {
          productId: created.id,
          attributeId: attrIds.get(key)!,
          position: position++,
          ...(def.type === "TEXT" ? { textValue: { en: String(raw), ar: String(raw) } } : {}),
          ...(def.type === "BOOLEAN" ? { boolValue: Boolean(raw) } : {}),
        },
      });
      if (def.type === "SELECT" || def.type === "MULTISELECT" || def.type === "COLOR") {
        for (const slug of Array.isArray(raw) ? raw : [String(raw)]) {
          const vid = valueIds.get(`${key}:${slug}`);
          if (vid) await db.productAttributeValue.create({ data: { productAttributeId: pa.id, valueId: vid } });
        }
      }
    }
    // Simple product colour (for swatches/filters)
    if (!variable && p.colors?.length) {
      const pa = await db.productAttribute.create({ data: { productId: created.id, attributeId: attrIds.get("color")!, position: position++ } });
      for (const c of p.colors) await db.productAttributeValue.create({ data: { productAttributeId: pa.id, valueId: valueIds.get(`color:${c}`)! } });
    }

    // Variations: cartesian product of axes
    if (variable) {
      for (const axis of p.axes!) {
        const pa = await db.productAttribute.create({ data: { productId: created.id, attributeId: attrIds.get(axis.attr)!, usedForVariations: true, position: position++ } });
        for (const v of axis.values) await db.productAttributeValue.create({ data: { productAttributeId: pa.id, valueId: valueIds.get(`${axis.attr}:${v}`)! } });
      }
      const combos = p.axes!.reduce<Record<string, string>[]>((acc, axis) => acc.flatMap((c) => axis.values.map((v) => ({ ...c, [axis.attr]: v }))), [{}]);
      for (const [vi, combo] of combos.entries()) {
        const delta = Object.values(combo).reduce((s, v) => s + (p.priceDelta?.[v] ?? 0), 0);
        const colorSlug = combo.color;
        const img = colorSlug ? images.find((i) => i.valueSlug === colorSlug) : null;
        const stock = p.stock ?? [0, 3, 8, 14, 22, 30][(vi * 7 + index) % 6];
        await db.productVariant.create({
          data: {
            productId: created.id,
            sku: `${p.sku}-${Object.values(combo).map((v) => v.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 14)).join("-")}`,
            price: delta ? retail(p.price + delta) : null,
            salePrice: p.sale && delta ? retail(p.sale + delta) : null,
            saleEndsAt: p.sale && delta && p.saleDays ? new Date(now + p.saleDays * 86_400_000) : null,
            stock,
            imageId: img?.mediaId,
            position: vi,
            options: { create: Object.entries(combo).map(([attr, slug]) => ({ attributeId: attrIds.get(attr)!, valueId: valueIds.get(`${attr}:${slug}`)! })) },
          },
        });
      }
    }
    await db.inventoryMovement.create({ data: { productId: created.id, delta: variable ? 0 : (p.stock ?? 25), balanceAfter: variable ? 0 : (p.stock ?? 25), reason: "INITIAL", note: "Initial stock" } });
    await refreshProductDerived(created.id);
    process.stdout.write(".");
  }
  console.log("");

  // Cross-sells / related
  const bySlug = async (slug: string) => (await db.product.findUniqueOrThrow({ where: { slug } })).id;
  const rel = async (from: string, to: string[], type: "CROSS_SELL" | "RELATED" | "UPSELL") => {
    const id = await bySlug(from);
    for (const [i, s] of to.entries()) await db.productRelation.create({ data: { productId: id, relatedId: await bySlug(s), type, position: i } });
  };
  await rel("iphone-17-pro", ["iphone-17-pro-silicone-case-magsafe", "apple-20w-usb-c-power-adapter", "airpods-pro-3"], "CROSS_SELL");
  await rel("galaxy-s25-ultra", ["galaxy-s25-ultra-clear-case", "samsung-45w-power-adapter", "galaxy-buds3-pro"], "CROSS_SELL");
  await rel("iphone-17", ["iphone-17-pro", "iphone-air"], "UPSELL");

  return { catIds, brandIds };
}

// ─────────────────────────────── Content ────────────────────────────────────

async function content(catIds: Map<string, { id: string; path: string }>, brandIds: Map<string, string>) {
  console.log("Seeding content…");
  const slides = [
    { kind: "phone-pro" as const, color: "#e46a2e", from: "#120a05", to: "#3b1a0c", accent: "#e46a2e", eyebrow: L("New", "جديد"), heading: L("iPhone 17 Pro.\nAll out Pro.", "آيفون 17 برو.\nاحترافي بالكامل."), body: L("Aluminium unibody. A19 Pro. Three 48MP cameras. Order now with next-day delivery in Riyadh, Jeddah and Dammam.", "هيكل ألمنيوم موحّد. معالج A19 Pro. ثلاث كاميرات 48 ميجابكسل. اطلبه الآن مع التوصيل في اليوم التالي داخل الرياض وجدة والدمام."), primary: { label: L("Buy now", "اشترِ الآن"), href: "/product/iphone-17-pro" }, secondary: { label: L("Compare iPhones", "قارن أجهزة آيفون"), href: "/category/smartphones/iphones" } },
    { kind: "phone-pro" as const, color: "#7d7f82", from: "#05070d", to: "#1b2338", accent: "#6d8bd6", eyebrow: L("Limited-time offer", "عرض لفترة محدودة"), heading: L("Galaxy S25 Ultra\nat its best price", "جالكسي S25 ألترا\nبأفضل سعر"), body: L("Titanium, S Pen and a 200MP camera — at its best price yet.", "التيتانيوم وقلم S Pen وكاميرا 200 ميجابكسل — بأفضل سعر حتى الآن."), primary: { label: L("Shop the deal", "تسوّق العرض"), href: "/product/galaxy-s25-ultra" }, secondary: { label: L("All Galaxy", "كل أجهزة جالكسي"), href: "/category/smartphones/android/samsung-galaxy" } },
    { kind: "earbuds" as const, color: "#f2f2f4", from: "#0b1220", to: "#1e1b4b", accent: "#8b5cf6", eyebrow: L("Audio week", "أسبوع الصوتيات"), heading: L("Hear more.\nPay less.", "اسمع أكثر.\nوادفع أقل."), body: L("Up to 18% off AirPods, Galaxy Buds and Sony noise-cancelling headphones.", "خصومات حتى 18% على إيربودز وجالكسي بادز وسماعات سوني."), primary: { label: L("Shop audio", "تسوّق الصوتيات"), href: "/category/audio" }, secondary: null },
  ];
  const slider = await db.slider.create({ data: { key: "home", name: "Homepage hero", settings: { autoplay: true, interval: 6500, transition: "fade", loop: true, showArrows: true, showDots: true } } });
  for (const [i, s] of slides.entries()) {
    const desktop = await svgMedia(slideArt({ from: s.from, to: s.to, accent: s.accent, kind: s.kind, color: s.color }), "slides", s.heading, 2400);
    const mobile = await svgMedia(slideArt({ from: s.from, to: s.to, accent: s.accent, kind: s.kind, color: s.color, width: 1000, height: 1400 }), "slides", s.heading, 1000);
    await db.slide.create({
      data: {
        sliderId: slider.id,
        position: i,
        desktopImageId: desktop.id,
        mobileImageId: mobile.id,
        eyebrow: s.eyebrow,
        heading: s.heading,
        body: s.body,
        primaryCta: s.primary,
        secondaryCta: s.secondary ?? {},
        style: { align: "start", vertical: "center", textColor: "#ffffff", overlay: "#000000", overlayOpacity: 10, animation: "fade-up", buttonStyle: i === 1 ? "glass" : "solid" },
      },
    });
  }

  for (const [i, a] of ANNOUNCEMENTS.entries()) await db.announcement.create({ data: { ...a, position: i } });

  for (const [i, c] of FAQ_CATEGORIES.entries()) {
    const cat = await db.faqCategory.create({ data: { ...c, position: i } });
    for (const [j, f] of FAQS.filter((x) => x.cat === c.slug).entries()) await db.faq.create({ data: { categoryId: cat.id, question: f.q, answer: f.a, position: j } });
  }

  const banner1 = await svgMedia(bannerArt({ from: "#0f172a", to: "#334155", kind: "laptop", color: "#d9dadc" }), "banners", L("MacBook Air", "ماك بوك إير"), 1600);
  const banner2 = await svgMedia(bannerArt({ from: "#052e2b", to: "#0f766e", kind: "watch", color: "#2b2b2d" }), "banners", L("Wearables", "الأجهزة القابلة للارتداء"), 1600);
  const aboutImg = await svgMedia(bannerArt({ from: "#1e1b4b", to: "#4338ca", kind: "tablet", color: "#9fb2c8" }), "pages", ABOUT.title, 1600);

  const section = (type: string, data: Record<string, unknown> = {}, style: Record<string, unknown> = {}) => ({ type, data: { ...initialSectionData(type), ...data }, style });
  const pages: { slug: string; template: string; title: { en: string; ar: string }; system?: boolean; sections: ReturnType<typeof section>[]; seo?: object }[] = [
    {
      slug: "home",
      template: "home",
      title: L("Home", "الرئيسية"),
      system: true,
      sections: [
        section("hero_slider", { slider: "home", height: "lg", rounded: true }, { paddingY: "sm" }),
        section("ticker"),
        section("category_grid", { title: L("Shop by category", "تسوّق حسب التصنيف"), subtitle: L("Everything from flagships to the right cable.", "كل شيء من الهواتف الرائدة إلى الكابل المناسب."), source: "roots", layout: "tiles", limit: 6 }),
        section("product_carousel", { title: L("New arrivals", "وصل حديثاً"), subtitle: L("The latest launches, in stock now.", "أحدث الإصدارات، متوفرة الآن."), source: "new", limit: 10, layout: "carousel", viewAll: "/shop?sort=newest" }),
        section("promo_banners", {
          items: [
            { image: { id: banner1.id, url: banner1.url }, eyebrow: L("Back to uni", "العودة للجامعة"), title: L("MacBook Air M4", "ماك بوك إير M4"), text: L("All-day battery, 16GB memory. From 4,229 SAR.", "بطارية تدوم طوال اليوم وذاكرة 16 جيجابايت. ابتداءً من 4,229 ريالاً."), cta: L("Shop laptops", "تسوّق اللابتوبات"), href: "/category/laptops", theme: "light" },
            { image: { id: banner2.id, url: banner2.url }, eyebrow: L("Move more", "تحرّك أكثر"), title: L("Smart watches", "الساعات الذكية"), text: L("Apple Watch, Galaxy Watch, Pixel Watch and more.", "ساعة أبل وجالكسي ووتش وبكسل ووتش والمزيد."), cta: L("Explore wearables", "استكشف"), href: "/category/wearables", theme: "light" },
          ],
        }),
        section("product_carousel", { title: L("Deals worth grabbing", "عروض تستحق"), subtitle: L("Real discounts on genuine products.", "خصومات حقيقية على منتجات أصلية."), source: "on_sale", limit: 10, layout: "carousel", viewAll: "/shop?sale=1", showCountdown: true }, { background: "surface" }),
        section("brand_strip", { title: L("Official brands", "علامات رسمية"), source: "featured", grayscale: true }),
        section("product_carousel", { title: L("Best sellers", "الأكثر مبيعاً"), source: "best_sellers", limit: 8, layout: "grid", viewAll: "/shop?sort=best_selling" }),
        section("features", {
          title: L("Why shop with Nuqta", "لماذا تتسوق من نقطة"),
          items: [
            { icon: "Truck", title: L("Fast delivery", "توصيل سريع"), text: L("Next-day in major cities, 2–5 days across the Kingdom.", "في اليوم التالي في المدن الرئيسية، و2–5 أيام لباقي مناطق المملكة.") },
            { icon: "ShieldCheck", title: L("100% genuine", "أصلي 100%"), text: L("Official stock with local warranty.", "منتجات رسمية مع كفالة محلية.") },
            { icon: "RotateCcw", title: L("Easy returns", "إرجاع سهل"), text: L("14 days to change your mind.", "14 يوماً لتغيير رأيك.") },
            { icon: "MessagesSquare", title: L("Real experts", "خبراء حقيقيون"), text: L("Live chat with people who know tech.", "محادثة مباشرة مع أشخاص يفهمون التقنية.") },
          ],
        }),
        section("testimonials", { title: L("Loved by our customers", "يحبه عملاؤنا"), limit: 6, minRating: 4 }),
        section("newsletter", {}, { background: "dark" }),
      ],
    },
    {
      slug: "about",
      template: "standard",
      title: ABOUT.title,
      system: true,
      sections: aboutSections({ id: aboutImg.id, url: aboutImg.url }, { eyebrow: ABOUT.eyebrow, heading: ABOUT.heading, body: ABOUT.body }),
    },
    { slug: "contact", template: "contact", title: L("Contact us", "تواصل معنا"), system: true, sections: contactSections() },
    { slug: "faq", template: "faq", title: L("Help & FAQ", "المساعدة والأسئلة الشائعة"), system: true, sections: [section("faq", { title: L("How can we help?", "كيف يمكننا مساعدتك؟") }), section("cta", { title: L("Still need help?", "ما زلت بحاجة لمساعدة؟"), cta: L("Contact support", "تواصل مع الدعم"), href: "/contact" }, { background: "surface", align: "center" })] },
    ...Object.entries(LEGAL_PAGES).map(([slug, p]) => ({ slug, template: "legal", title: p.title, excerpt: p.excerpt, system: true, sections: [section("rich_text", { body: p.body })] })),
  ];
  const pageIds = new Map<string, string>();
  for (const p of pages) {
    const created = await db.page.create({
      data: {
        slug: p.slug,
        template: p.template,
        title: p.title,
        excerpt: ("excerpt" in p && p.excerpt) || {},
        status: "PUBLISHED",
        isSystem: p.system ?? false,
        publishedAt: new Date(),
        sections: { create: p.sections.map((s, i) => ({ type: s.type, data: s.data as object, style: s.style as object, position: i })) },
      },
    });
    pageIds.set(p.slug, created.id);
  }

  // Menus
  // Header + top bar: shared defaults (mega menus fill themselves from the category tree).
  await buildDefaultNavigation();
  await db.setting.upsert({ where: { key: "_content_upgrades" }, create: { key: "_content_upgrades", value: { nav: NAV_VERSION } }, update: { value: { nav: NAV_VERSION } } });
  const item = (menuId: string, data: { label?: object; type: "URL" | "CATEGORY" | "PAGE" | "SHOP" | "BRAND"; refId?: string; url?: string; position: number; parentId?: string; highlight?: boolean }) =>
    db.menuItem.create({ data: { menuId, label: data.label ?? {}, type: data.type, refId: data.refId, url: data.url, position: data.position, parentId: data.parentId, highlight: data.highlight ?? false } });

  const fShop = await db.menu.create({ data: { key: "footer-shop", name: "Footer · Shop" } });
  for (const [i, s] of ["smartphones", "tablets", "laptops", "wearables", "audio", "accessories"].entries()) await item(fShop.id, { type: "CATEGORY", refId: catIds.get(s)!.id, position: i });
  const fHelp = await db.menu.create({ data: { key: "footer-help", name: "Footer · Help" } });
  await item(fHelp.id, { type: "PAGE", refId: pageIds.get("faq"), position: 0 });
  await item(fHelp.id, { type: "PAGE", refId: pageIds.get("shipping-policy"), position: 1 });
  await item(fHelp.id, { type: "PAGE", refId: pageIds.get("refund-policy"), position: 2 });
  await item(fHelp.id, { type: "PAGE", refId: pageIds.get("contact"), position: 3 });
  await item(fHelp.id, { type: "URL", url: "/account/orders", label: L("Track your order", "تتبع طلبك"), position: 4 });
  const fCompany = await db.menu.create({ data: { key: "footer-company", name: "Footer · Company" } });
  await item(fCompany.id, { type: "PAGE", refId: pageIds.get("about"), position: 0 });
  await item(fCompany.id, { type: "URL", url: "/brands", label: L("Our brands", "علاماتنا التجارية"), position: 1 });
  const fLegal = await db.menu.create({ data: { key: "footer-legal", name: "Footer · Legal" } });
  for (const [i, s] of ["privacy-policy", "terms-and-conditions", "cookie-policy"].entries()) await item(fLegal.id, { type: "PAGE", refId: pageIds.get(s), position: i });

  // Shipping
  const sa = await db.shippingZone.create({ data: { name: "Saudi Arabia", countries: ["SA"], position: 0 } });
  await db.shippingMethod.createMany({
    data: [
      { zoneId: sa.id, name: L("Standard delivery", "التوصيل العادي"), description: L("Free on orders over 299 SAR", "مجاني للطلبات فوق 299 ريال"), type: "FREE_OVER", cost: SAR(25), freeOver: SAR(299), minDays: 2, maxDays: 5, position: 0 },
      { zoneId: sa.id, name: L("Express (Riyadh, Jeddah, Dammam)", "توصيل سريع (الرياض، جدة، الدمام)"), description: L("Next working day for orders before 4 pm", "يوم العمل التالي للطلبات قبل 4 مساءً"), type: "FLAT", cost: SAR(45), minDays: 1, maxDays: 2, position: 1 },
      { zoneId: sa.id, name: L("Store pickup", "الاستلام من المتجر"), description: L("King Fahd Road, Riyadh", "طريق الملك فهد، الرياض"), type: "PICKUP", cost: 0, minDays: 0, maxDays: 1, position: 2 },
    ],
  });
  const gcc = await db.shippingZone.create({ data: { name: "GCC", countries: ["AE", "KW", "QA", "BH", "OM"], position: 1 } });
  await db.shippingMethod.create({ data: { zoneId: gcc.id, name: L("GCC express", "شحن خليجي سريع"), type: "WEIGHT", cost: SAR(69), perKg: SAR(15), minDays: 3, maxDays: 6 } });
  const world = await db.shippingZone.create({ data: { name: "Rest of world", countries: [], position: 2 } });
  await db.shippingMethod.create({ data: { zoneId: world.id, name: L("International", "شحن دولي"), type: "WEIGHT", cost: SAR(119), perKg: SAR(25), minDays: 5, maxDays: 12 } });

  await setupSaudiRegions();
  await setupPlatform();
  // Everything the seed created is sample data: mark it so it's never confused with the merchant's own.
  await db.$transaction([db.product.updateMany({ data: { source: "DEMO" } }), db.category.updateMany({ data: { source: "DEMO" } }), db.brand.updateMany({ data: { source: "DEMO" } })]);

  // Coupons & promotions
  await db.coupon.createMany({
    data: [
      { code: "WELCOME10", name: L("Welcome 10% off", "خصم ترحيبي 10%"), type: "PERCENT", value: 1000, maxDiscount: SAR(150), firstOrderOnly: true, usageLimitPerCustomer: 1 },
      { code: "FREESHIP", name: L("Free shipping", "شحن مجاني"), type: "FREE_SHIPPING", value: 0, minSubtotal: SAR(149) },
      { code: "ACCESS15", name: L("15% off accessories", "خصم 15% على الإكسسوارات"), type: "PERCENT", value: 1500, scope: "CATEGORIES", targetIds: [catIds.get("accessories")!.id], excludeSaleItems: true },
    ],
  });
  await db.coupon.create({ data: { name: L("Spend 2,500 SAR, save 100 SAR", "أنفق 2,500 ريال ووفّر 100 ريال"), type: "FIXED", value: SAR(100), minSubtotal: SAR(2500), isAutomatic: true } });

  // Social (demo URLs)
  for (const p of ["instagram", "facebook", "tiktok", "youtube", "whatsapp"]) {
    await db.socialLink.update({
      where: { platform: p },
      data: { isEnabled: true, url: p === "whatsapp" ? "https://wa.me/966500000000" : `https://www.${p}.com/nuqta.demo`, placements: ["footer", "contact", "about", "floating"] },
    });
  }

  // Store settings with demo contact details
  await db.setting.upsert({
    where: { key: "contact" },
    create: {
      key: "contact",
      value: {
        phone: "+966 11 500 0000",
        email: "hello@nuqta.test",
        whatsapp: "+966500000000",
        address: L("King Fahd Road, Riyadh, Saudi Arabia", "طريق الملك فهد، الرياض، المملكة العربية السعودية"),
        hours: L("Sat–Thu 10:00–23:00 · Fri 16:00–23:00", "السبت–الخميس 10:00–23:00 · الجمعة 16:00–23:00"),
        mapEmbedUrl: "https://www.openstreetmap.org/export/embed.html?bbox=46.665%2C24.700%2C46.695%2C24.720&layer=mapnik&marker=24.7106%2C46.6799",
      },
    },
    update: {},
  });
  await db.setting.upsert({ where: { key: "widgets" }, create: { key: "widgets", value: { whatsapp: { number: "966500000000" } } }, update: {} });
  await db.setting.upsert({ where: { key: "store" }, create: { key: "store", value: { email: "hello@nuqta.test", phone: "+966 11 500 0000", address: L("King Fahd Road, Riyadh, Saudi Arabia", "طريق الملك فهد، الرياض، المملكة العربية السعودية") } }, update: {} });
  void brandIds;
}

// ─────────────────────────── Demo customers & orders ─────────────────────────

function rand<T>(arr: T[], seed: number) {
  return arr[Math.abs(Math.floor(Math.sin(seed) * 10_000)) % arr.length];
}

async function demoActivity() {
  console.log("Seeding demo staff, customers, orders, reviews and analytics…");
  const roles = Object.fromEntries((await db.role.findMany()).map((r) => [r.key, r.id]));
  const staffPassword = process.env.SEED_ADMIN_PASSWORD!;
  const hash = await hashPassword(staffPassword);
  await db.user.create({ data: { email: "support@nuqta.test", name: "Lina Haddad", type: "STAFF", roleId: roles.support_agent, passwordHash: hash, locale: "ar", agentStatus: "ONLINE" } });
  await db.user.create({ data: { email: "content@nuqta.test", name: "Omar Khalil", type: "STAFF", roleId: roles.content_manager, passwordHash: hash, locale: "en" } });

  const first = ["Ahmad", "Sara", "Yousef", "Rania", "Khaled", "Dana", "Hamza", "Noor", "Faris", "Leen", "Tareq", "Hala", "Zaid", "Maya", "Bashar", "Jana", "Omar", "Rawan", "Ali", "Salma", "Mohammad", "Aya", "Laith", "Tala"];
  const last = ["Al-Masri", "Haddad", "Nasser", "Khoury", "Odeh", "Saleh", "Zubi", "Hijazi", "Qasem", "Darwish", "Barakat", "Shami"];
  const cities = ["Riyadh", "Jeddah", "Dammam", "Mecca", "Medina", "Khobar"];
  const customers = [];
  for (let i = 0; i < 36; i++) {
    const name = `${first[i % first.length]} ${rand(last, i + 3)}`;
    customers.push(
      await db.user.create({
        data: {
          email: `${name.toLowerCase().replace(/[^a-z]+/g, ".")}${i}@example.com`,
          name,
          phone: `+9665${(10000000 + i * 79193).toString().slice(0, 8)}`,
          passwordHash: hash,
          locale: i % 3 === 0 ? "en" : "ar",
          createdAt: new Date(Date.now() - (80 - i * 2) * 86_400_000),
          marketingOptIn: i % 2 === 0,
        },
      }),
    );
  }

  const products = await db.product.findMany({ include: { variants: true } });
  const statusPlan = ["completed", "completed", "completed", "completed", "shipped", "processing", "paid", "pending", "cancelled", "completed", "refunded"];
  const now = Date.now();
  let seq = 100001;
  for (let i = 0; i < 160; i++) {
    const daysAgo = Math.floor(Math.pow((i * 37) % 100 / 100, 1.6) * 75);
    const placedAt = new Date(now - daysAgo * 86_400_000 - ((i * 7919) % 86_400) * 1000);
    const cust = rand(customers, i + 11);
    const guest = i % 5 === 0;
    const lineCount = 1 + (i % 3 === 0 ? 1 : 0) + (i % 7 === 0 ? 1 : 0);
    const items = [];
    for (let l = 0; l < lineCount; l++) {
      const p = products[(i * 13 + l * 7) % products.length];
      const v = p.variants.length ? p.variants[(i + l) % p.variants.length] : null;
      const unit = v?.price ?? p.effectivePrice ?? p.price;
      const qty = p.price < SAR(300) && i % 4 === 0 ? 2 : 1;
      items.push({ productId: p.id, variantId: v?.id, sku: v?.sku ?? p.sku, name: p.name as object, unitPrice: unit, regularUnitPrice: v?.price ?? p.price, quantity: qty, total: unit * qty });
    }
    const subtotal = items.reduce((s, it) => s + it.total, 0);
    const shipping = subtotal >= SAR(299) ? 0 : SAR(25);
    const status = daysAgo < 2 ? rand(["pending", "processing", "paid"], i) : rand(statusPlan, i * 3);
    const paid = !["pending", "cancelled"].includes(status);
    const method = i % 4 === 0 ? "bank_transfer" : "cod";
    const order = await db.order.create({
      data: {
        number: `NQ-${seq++}`,
        userId: guest ? null : cust.id,
        email: cust.email,
        phone: cust.phone ?? "+966500000000",
        customerName: cust.name,
        statusKey: status,
        paymentStatus: status === "refunded" ? "REFUNDED" : paid ? "PAID" : "UNPAID",
        paymentMethod: method,
        currency: "SAR",
        locale: cust.locale,
        subtotal,
        shippingTotal: shipping,
        total: subtotal + shipping,
        refundedTotal: status === "refunded" ? subtotal + shipping : 0,
        shippingAddress: { fullName: cust.name, phone: cust.phone, country: "JO", city: rand(cities, i), line1: `${(i % 40) + 1} Al-Madina St.` },
        shippingMethodName: L("Standard delivery", "التوصيل العادي"),
        placedAt,
        paidAt: paid ? placedAt : null,
        completedAt: status === "completed" ? new Date(placedAt.getTime() + 2 * 86_400_000) : null,
        items: { create: items },
        history: { create: [{ toStatus: "pending", note: "Order placed", createdAt: placedAt }, ...(status !== "pending" ? [{ fromStatus: "pending", toStatus: status, createdAt: new Date(placedAt.getTime() + 3_600_000) }] : [])] },
        ...(paid ? { payments: { create: { provider: method, amount: subtotal + shipping, currency: "SAR", status: status === "refunded" ? "REFUNDED" : "CAPTURED", createdAt: placedAt } } } : {}),
      },
    });
    void order;
  }
  await db.$executeRawUnsafe(`SELECT setval('order_number_seq', ${seq + 10})`);

  // Recompute sales counts from orders
  const sales = await db.orderItem.groupBy({ by: ["productId"], _sum: { quantity: true } });
  for (const s of sales) if (s.productId) await db.product.update({ where: { id: s.productId }, data: { salesCount: s._sum.quantity ?? 0 } });

  // Reviews only from customers who actually "bought" (verified)
  const bodies = [
    { r: 5, t: L("Exactly as described", "تماماً كما هو موصوف"), b: L("Arrived the next day, sealed and with local warranty. Setup was effortless.", "وصل في اليوم التالي مغلقاً ومع كفالة محلية. الإعداد كان سهلاً جداً.") },
    { r: 5, t: L("Great service", "خدمة رائعة"), b: L("The team on live chat helped me pick the right storage size. Very happy.", "ساعدني فريق المحادثة المباشرة في اختيار السعة المناسبة. سعيد جداً.") },
    { r: 4, t: L("Very good", "جيد جداً"), b: L("Excellent device. Delivery took two days to Abha, which was fine.", "جهاز ممتاز. استغرق التوصيل يومين إلى أبها وكان ذلك مقبولاً.") },
    { r: 5, t: L("Best price I found", "أفضل سعر وجدته"), b: L("Cheaper than other stores and genuine. Will order again.", "أرخص من المتاجر الأخرى وأصلي. سأطلب مرة أخرى.") },
    { r: 3, t: L("Good, packaging could be better", "جيد، التغليف يمكن أن يكون أفضل"), b: L("Product is great but the outer box was a bit dented.", "المنتج رائع لكن الصندوق الخارجي كان به بعض الانبعاج.") },
    { r: 4, t: L("Solid", "ممتاز"), b: L("Battery life is impressive. Cash on delivery made it easy.", "عمر البطارية مذهل. الدفع عند الاستلام جعل الأمر سهلاً.") },
  ];
  const purchased = await db.orderItem.findMany({ where: { order: { statusKey: "completed", userId: { not: null } } }, include: { order: { include: { user: true } } }, take: 90 });
  const seen = new Set<string>();
  for (const [i, it] of purchased.entries()) {
    if (!it.productId || !it.order.user) continue;
    const key = `${it.productId}:${it.order.userId}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const b = bodies[i % bodies.length];
    const loc = it.order.user.locale === "en" ? "en" : "ar";
    await db.review.create({
      data: {
        productId: it.productId,
        userId: it.order.userId,
        orderItemId: it.id,
        authorName: it.order.user.name.split(" ")[0] + " " + it.order.user.name.split(" ")[1]?.[0] + ".",
        rating: b.r,
        title: b.t[loc],
        body: b.b[loc],
        status: i % 9 === 0 ? "PENDING" : "APPROVED",
        isVerifiedPurchase: true,
        locale: loc,
        createdAt: new Date((it.order.completedAt ?? new Date()).getTime() + 86_400_000),
      },
    });
  }
  const agg = await db.review.groupBy({ by: ["productId"], where: { status: "APPROVED" }, _avg: { rating: true }, _count: { _all: true } });
  for (const a of agg) await db.product.update({ where: { id: a.productId }, data: { ratingAvg: Math.round((a._avg.rating ?? 0) * 10) / 10, ratingCount: a._count._all } });

  // First-party analytics: daily sessions → views → carts → checkouts → purchases
  const orders = await db.order.findMany({ select: { id: true, placedAt: true, total: true } });
  const events: { type: "PAGE_VIEW" | "PRODUCT_VIEW" | "ADD_TO_CART" | "BEGIN_CHECKOUT" | "PURCHASE"; visitorId: string; createdAt: Date; path?: string; productId?: string; orderId?: string; value?: number; device: string }[] = [];
  for (let d = 0; d < 75; d++) {
    const day = new Date(now - d * 86_400_000);
    const visitors = 60 + ((d * 31) % 45) + Math.round(30 * Math.sin(d / 5));
    for (let v = 0; v < visitors; v++) {
      const vid = `demo-${d}-${v}`;
      const t = new Date(day.getTime() - ((v * 977) % 86_400) * 1000);
      const device = v % 3 === 0 ? "desktop" : "mobile";
      events.push({ type: "PAGE_VIEW", visitorId: vid, createdAt: t, path: "/", device });
      if (v % 2 === 0) events.push({ type: "PRODUCT_VIEW", visitorId: vid, createdAt: t, productId: products[(v + d) % products.length].id, device });
      if (v % 7 === 0) events.push({ type: "ADD_TO_CART", visitorId: vid, createdAt: t, productId: products[(v + d) % products.length].id, device });
      if (v % 13 === 0) events.push({ type: "BEGIN_CHECKOUT", visitorId: vid, createdAt: t, device });
    }
  }
  for (const o of orders) events.push({ type: "PURCHASE", visitorId: `order-${o.id}`, createdAt: o.placedAt, orderId: o.id, value: o.total, device: "mobile" });
  for (let i = 0; i < events.length; i += 2000) await db.analyticsEvent.createMany({ data: events.slice(i, i + 2000) });

  const terms = ["iphone 17", "galaxy s25", "airpods", "charger", "case", "pixel", "ipad", "power bank", "سامسونج", "ايفون"];
  for (const [i, term] of terms.entries()) await db.searchTerm.create({ data: { term, count: 120 - i * 9, lastResults: 3 + (i % 4) } });

  // A couple of contact messages and notifications so the admin isn't empty.
  await db.contactSubmission.create({ data: { name: "Rami S.", email: "rami@example.com", phone: "+966551234567", subject: "Corporate order", message: "Hi, we'd like a quote for 15 iPhone 17 units for our office. Do you offer business invoices?", status: "NEW" } });
  await db.notification.create({ data: { audience: "STAFF", permission: "inventory.manage", event: "PRODUCT_LOW_STOCK", title: L("Low stock", "مخزون منخفض"), body: L("Galaxy S25 Ultra Clear Case — 3 left", "غطاء شفاف لجالكسي S25 ألترا — متبقي 3"), link: "/admin/inventory", severity: "WARNING" } });
}

async function main() {
  await essentials();
  const hasCatalog = (await db.product.count()) > 0;
  if (process.env.SEED_DEMO === "false") {
    console.log("SEED_DEMO=false — skipping demo data.");
  } else if (hasCatalog) {
    console.log("Catalogue already present — skipping demo data. Run `npm run db:reset` for a fresh demo.");
  } else {
    const { catIds, brandIds } = await catalogue();
    await content(catIds, brandIds);
    await demoActivity();
  }
  console.log("✔ Seed complete");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());

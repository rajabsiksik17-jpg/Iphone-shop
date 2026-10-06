import "server-only";
import { cache } from "react";
import { db } from "./db";
import { getManySettings } from "./settings/service";
import { getCurrentUser } from "./auth/session";
import { requestMeta } from "./request";
import { switchableCurrencies, moneyContext } from "./commerce/currency";
import { findCart } from "./commerce/cart";
import { freeShippingThreshold } from "./commerce/shipping";
import { publicIntegrationConfig } from "./integrations/service";
import { getMenu, getSocialLinks } from "./cms/queries";
import { categoryTree } from "./catalog/taxonomy";
import { t } from "@/lib/i18n-text";
import type { StoreConfig } from "@/components/providers/store-context";
import type { Settings } from "./settings/schemas";
import { cookies } from "next/headers";

const SHADOWS: Record<string, [string, string]> = {
  none: ["none", "0 8px 30px -12px rgb(15 23 42 / 0.18)"],
  soft: ["0 1px 2px rgb(15 23 42 / 0.04), 0 8px 24px -12px rgb(15 23 42 / 0.12)", "0 12px 40px -12px rgb(15 23 42 / 0.25)"],
  medium: ["0 2px 4px rgb(15 23 42 / 0.06), 0 12px 32px -12px rgb(15 23 42 / 0.2)", "0 18px 48px -12px rgb(15 23 42 / 0.3)"],
  strong: ["0 4px 8px rgb(15 23 42 / 0.08), 0 20px 48px -12px rgb(15 23 42 / 0.3)", "0 24px 60px -12px rgb(15 23 42 / 0.4)"],
};

const FONT_VARS: Record<string, string> = {
  geist: "var(--font-geist)",
  inter: "var(--font-inter)",
  manrope: "var(--font-manrope)",
  "dm-sans": "var(--font-dm-sans)",
  "ibm-plex-arabic": "var(--font-plex-arabic)",
  "noto-kufi": "var(--font-noto-kufi)",
  tajawal: "var(--font-tajawal)",
  cairo: "var(--font-cairo)",
};

/** Appearance settings → CSS custom properties consumed by the design system. */
export function themeCss(a: Settings<"appearance">) {
  const c = a.colors;
  const [card, pop] = SHADOWS[a.shadow] ?? SHADOWS.soft;
  const btn = a.buttonShape === "pill" ? "999px" : a.buttonShape === "square" ? "6px" : `${Math.max(6, a.radius - 2)}px`;
  // Values are validated hex colours / enums / numbers from Zod schemas — safe to inline.
  return `:root{--nq-primary:${c.primary};--nq-primary-fg:${c.primaryForeground};--nq-accent:${c.accent};--nq-accent-fg:${c.accentForeground};--nq-bg:${c.background};--nq-surface:${c.surface};--nq-fg:${c.foreground};--nq-muted:${c.muted};--nq-border:${c.border};--nq-sale:${c.sale};--nq-success:${c.success};--nq-warning:${c.warning};--nq-radius:${a.radius}px;--nq-btn-radius:${btn};--nq-container:${a.containerWidth}px;--nq-shadow-card:${card};--nq-shadow-pop:${pop};--font-latin:${FONT_VARS[a.fontLatin]};--font-arabic:${FONT_VARS[a.fontArabic]};}`;
}

export const getStorefrontShell = cache(async (locale: "ar" | "en") => {
  const [settings, user, meta, currencies, cart, integrations, header, footerShop, footerHelp, footerCompany, footerLegal, social, tree] = await Promise.all([
    getManySettings(["store", "appearance", "seo", "privacy", "widgets", "ticker", "contact", "chat", "geo", "maintenance", "notifications"]),
    getCurrentUser(),
    requestMeta(),
    switchableCurrencies(),
    findCart(),
    publicIntegrationConfig(),
    getMenu("header", locale),
    getMenu("footer-shop", locale),
    getMenu("footer-help", locale),
    getMenu("footer-company", locale),
    getMenu("footer-legal", locale),
    getSocialLinks(),
    categoryTree(locale),
  ]);
  const jar = await cookies();
  const displayCurrency = jar.get("NQ_CURRENCY")?.value ?? null;
  const money = await moneyContext(locale, displayCurrency);
  const wishlist = user ? (await db.wishlistItem.findMany({ where: { userId: user.id }, select: { productId: true } })).map((w) => w.productId) : [];
  const ga = integrations.google_analytics as { measurementId?: string } | undefined;
  const gaConfig = await db.integration.findUnique({ where: { key: "google_analytics" }, select: { config: true } });

  const config: StoreConfig = {
    locale,
    storeName: t(settings.store.name, locale),
    money,
    currencies: currencies.map((c) => ({ code: c.code, symbol: t(c.symbol, locale), name: t(c.name, locale) })),
    user: user ? { id: user.id, name: user.name, email: user.email } : null,
    defaultCountry: settings.geo.defaultCountry,
    detectedCountry: settings.geo.detectFromHeaders ? meta.country : null,
    card: settings.appearance.productCard,
    badges: settings.appearance.badges,
    freeShippingThreshold: await freeShippingThreshold(meta.country ?? settings.geo.defaultCountry),
    analytics: {
      gaId: ga?.measurementId ?? null,
      metaPixelId: (integrations.meta_pixel as { pixelId?: string } | undefined)?.pixelId ?? null,
      tiktokPixel: (integrations.tiktok_pixel as { pixelCode?: string } | undefined)?.pixelCode ?? null,
      requireConsent: settings.privacy.requireConsent,
      consentBanner: settings.privacy.consentBanner,
      firstParty: settings.privacy.firstPartyAnalytics,
      trackEcommerce: Boolean((gaConfig?.config as { trackEcommerce?: boolean } | undefined)?.trackEcommerce ?? true),
    },
    chat: { enabled: settings.chat.enabled },
  };

  return {
    config,
    settings,
    cartCount: cart?.items.reduce((s, i) => s + i.quantity, 0) ?? 0,
    wishlist,
    menus: { header, footerShop, footerHelp, footerCompany, footerLegal },
    social,
    categories: tree,
    verification: {
      google: (integrations.google_search_console as { verificationToken?: string } | undefined)?.verificationToken || settings.seo.googleVerification || undefined,
      bing: settings.seo.bingVerification || undefined,
    },
  };
});

export type StorefrontShell = Awaited<ReturnType<typeof getStorefrontShell>>;

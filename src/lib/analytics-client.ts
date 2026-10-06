"use client";

/**
 * Client-side analytics fan-out. Events go to whichever tags the shopper has
 * consented to (GA4 e-commerce, Meta Pixel, TikTok Pixel). Tags are loaded
 * by <AnalyticsScripts/> only after consent, so these calls are no-ops otherwise.
 */
type Item = { id: string; name: string; price: number; quantity?: number; brand?: string | null; category?: string | null; variant?: string | null };

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
    fbq?: (...args: unknown[]) => void;
    ttq?: { track: (e: string, p?: unknown) => void; page: () => void };
    __nqMoney?: { currency: string; decimals: number };
  }
}

const major = (minor: number) => {
  const d = window.__nqMoney?.decimals ?? 3;
  return Math.round((minor / 10 ** d) * 100) / 100;
};
const currency = () => window.__nqMoney?.currency ?? "JOD";
const gaItems = (items: Item[]) =>
  items.map((i) => ({ item_id: i.id, item_name: i.name, price: major(i.price), quantity: i.quantity ?? 1, item_brand: i.brand ?? undefined, item_category: i.category ?? undefined, item_variant: i.variant ?? undefined }));

export const track = {
  viewItem(item: Item) {
    window.gtag?.("event", "view_item", { currency: currency(), value: major(item.price), items: gaItems([item]) });
    window.fbq?.("track", "ViewContent", { content_ids: [item.id], content_type: "product", value: major(item.price), currency: currency() });
    window.ttq?.track("ViewContent", { content_id: item.id, value: major(item.price), currency: currency() });
  },
  addToCart(item: Item) {
    const value = major(item.price * (item.quantity ?? 1));
    window.gtag?.("event", "add_to_cart", { currency: currency(), value, items: gaItems([item]) });
    window.fbq?.("track", "AddToCart", { content_ids: [item.id], content_type: "product", value, currency: currency() });
    window.ttq?.track("AddToCart", { content_id: item.id, value, currency: currency() });
  },
  removeFromCart(item: Item) {
    window.gtag?.("event", "remove_from_cart", { currency: currency(), value: major(item.price * (item.quantity ?? 1)), items: gaItems([item]) });
  },
  beginCheckout(items: Item[], total: number) {
    window.gtag?.("event", "begin_checkout", { currency: currency(), value: major(total), items: gaItems(items) });
    window.fbq?.("track", "InitiateCheckout", { value: major(total), currency: currency(), num_items: items.length });
    window.ttq?.track("InitiateCheckout", { value: major(total), currency: currency() });
  },
  purchase(orderNumber: string, items: Item[], total: number, shipping: number) {
    window.gtag?.("event", "purchase", { transaction_id: orderNumber, currency: currency(), value: major(total), shipping: major(shipping), items: gaItems(items) });
    window.fbq?.("track", "Purchase", { value: major(total), currency: currency(), content_ids: items.map((i) => i.id), content_type: "product" });
    window.ttq?.track("CompletePayment", { value: major(total), currency: currency() });
  },
  search(term: string) {
    window.gtag?.("event", "search", { search_term: term });
    window.fbq?.("track", "Search", { search_string: term });
  },
};

// ─── Consent ────────────────────────────────────────────────────────────────

export type Consent = { analytics: boolean; marketing: boolean; decided: boolean };
const KEY = "nq_consent";

export function readConsent(): Consent {
  try {
    const raw = document.cookie.split("; ").find((c) => c.startsWith(`${KEY}=`))?.split("=")[1];
    if (raw) {
      const v = JSON.parse(decodeURIComponent(raw)) as Partial<Consent>;
      return { analytics: Boolean(v.analytics), marketing: Boolean(v.marketing), decided: true };
    }
  } catch {
    /* ignore */
  }
  return { analytics: false, marketing: false, decided: false };
}

export function writeConsent(c: Omit<Consent, "decided">) {
  document.cookie = `${KEY}=${encodeURIComponent(JSON.stringify(c))}; path=/; max-age=${60 * 60 * 24 * 180}; samesite=lax`;
  window.dispatchEvent(new CustomEvent("nq:consent", { detail: c }));
  window.gtag?.("consent", "update", {
    analytics_storage: c.analytics ? "granted" : "denied",
    ad_storage: c.marketing ? "granted" : "denied",
    ad_user_data: c.marketing ? "granted" : "denied",
    ad_personalization: c.marketing ? "granted" : "denied",
  });
}

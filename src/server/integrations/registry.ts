import "server-only";
import type { IntegrationDefinition } from "./types";
import { googleAnalytics, metaPixel, plannedIntegrations, searchConsole, tiktokPixel } from "./providers/analytics";
import { whatsappCloud } from "./providers/whatsapp";
import { bankTransfer, cashOnDelivery } from "../payments/providers/offline";
import { stripeProvider } from "../payments/providers/stripe";
import { paypalProvider, plannedGateways } from "../payments/providers/paypal";
import type { PaymentProvider } from "../payments/types";

/**
 * Single registry for every third-party connection. Adding an integration =
 * write one definition object and append it here; storage, the admin UI,
 * connection testing, secret handling and status tracking come for free.
 */
export const INTEGRATIONS: IntegrationDefinition[] = [
  cashOnDelivery,
  bankTransfer,
  stripeProvider,
  paypalProvider,
  ...plannedGateways,
  googleAnalytics,
  searchConsole,
  metaPixel,
  tiktokPixel,
  whatsappCloud,
  ...plannedIntegrations,
];

export function getDefinition(key: string) {
  return INTEGRATIONS.find((d) => d.key === key);
}

export function getPaymentProvider(key: string): PaymentProvider | undefined {
  const def = getDefinition(key);
  return def?.category === "payments" ? (def as PaymentProvider) : undefined;
}

/**
 * The name shoppers and staff see for a payment method: the admin's title for
 * that language, else the method's own localized default, else its name.
 */
export function paymentMethodTitle(key: string, config: Record<string, unknown> | null | undefined, locale: string) {
  const cfg = (config ?? {}) as Record<string, string | undefined>;
  const p = getPaymentProvider(key);
  const lang = locale === "ar" ? "ar" : "en";
  return cfg[`title_${lang}`] || p?.checkoutTitle?.[lang] || cfg.title_en || p?.name || key;
}

export function secretKeysOf(def: IntegrationDefinition) {
  return def.fields.filter((f) => f.type === "secret" || f.type === "secret-textarea").map((f) => f.key);
}

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

export function secretKeysOf(def: IntegrationDefinition) {
  return def.fields.filter((f) => f.type === "secret" || f.type === "secret-textarea").map((f) => f.key);
}

import "server-only";
import type { IntegrationContext } from "../../integrations/types";
import type { PaymentProvider } from "../types";

// PayPal does not support JOD; orders are charged in the configured settlement
// currency (default USD) converted at the store's exchange rate.
const SUPPORTED = ["USD", "EUR", "GBP", "AUD", "CAD", "CHF", "JPY", "SEK", "NOK", "DKK", "PLN", "HKD", "SGD", "NZD", "MXN", "ILS", "CZK", "HUF", "PHP", "THB", "TWD", "BRL", "MYR"];

const base = (ctx: IntegrationContext) => (ctx.mode === "live" ? "https://api-m.paypal.com" : "https://api-m.sandbox.paypal.com");

async function token(ctx: IntegrationContext) {
  const id = ctx.secrets.clientId;
  const secret = ctx.secrets.clientSecret;
  if (!id || !secret) throw new Error("PayPal client ID and secret are required.");
  const res = await fetch(`${base(ctx)}/v1/oauth2/token`, {
    method: "POST",
    headers: { Authorization: `Basic ${Buffer.from(`${id}:${secret}`).toString("base64")}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: "grant_type=client_credentials",
    signal: AbortSignal.timeout(15_000),
  });
  const body = (await res.json()) as { access_token?: string; error_description?: string };
  if (!res.ok || !body.access_token) throw new Error(body.error_description ?? `PayPal auth failed (${res.status})`);
  return body.access_token;
}

async function api<T>(ctx: IntegrationContext, path: string, init: { method: string; body?: unknown; idempotencyKey?: string }) {
  const res = await fetch(`${base(ctx)}${path}`, {
    method: init.method,
    headers: {
      Authorization: `Bearer ${await token(ctx)}`,
      "Content-Type": "application/json",
      ...(init.idempotencyKey ? { "PayPal-Request-Id": init.idempotencyKey } : {}),
    },
    body: init.body ? JSON.stringify(init.body) : undefined,
    signal: AbortSignal.timeout(20_000),
  });
  const body = (await res.json().catch(() => ({}))) as T & { message?: string; details?: { description: string }[] };
  if (!res.ok) throw new Error(body.details?.[0]?.description ?? body.message ?? `PayPal error ${res.status}`);
  return body;
}

const fmt = (amount: number, decimals: number) => (amount / 10 ** decimals).toFixed(decimals);

export const paypalProvider: PaymentProvider = {
  key: "paypal",
  category: "payments",
  name: "PayPal",
  icon: "paypal",
  docsUrl: "https://developer.paypal.com/docs/checkout/standard/",
  availability: "available",
  supportsModes: true,
  description: {
    en: "PayPal Checkout (Orders v2). Charged in a PayPal-supported currency (USD by default) converted at your exchange rate.",
    ar: "الدفع عبر PayPal (Orders v2). يتم الخصم بعملة يدعمها PayPal (الدولار افتراضياً) وفق سعر الصرف لديك.",
  },
  fields: [
    { key: "title_en", type: "text", placeholder: "PayPal", label: { en: "Checkout title (English)", ar: "العنوان (إنجليزي)" } },
    { key: "title_ar", type: "text", placeholder: "باي بال", label: { en: "Checkout title (Arabic)", ar: "العنوان (عربي)" } },
    { key: "clientId", type: "secret", required: true, label: { en: "Client ID", ar: "معرّف العميل" } },
    { key: "clientSecret", type: "secret", required: true, label: { en: "Client secret", ar: "السر" } },
    { key: "settlementCurrency", type: "text", placeholder: "USD", label: { en: "Charge currency", ar: "عملة الخصم" } },
  ],
  async test(ctx) {
    try {
      await token(ctx);
      const cur = String(ctx.config.settlementCurrency || "USD").toUpperCase();
      if (!SUPPORTED.includes(cur)) return { ok: false, message: `${cur} is not supported by PayPal.` };
      return { ok: true, message: `Authenticated with PayPal ${ctx.mode === "live" ? "live" : "sandbox"}; charging in ${cur}.` };
    } catch (e) {
      return { ok: false, message: (e as Error).message };
    }
  },
  payment: {
    currencies: SUPPORTED,
    async init(order, ctx, urls, convert) {
      const currency = String(ctx.config.settlementCurrency || "USD").toUpperCase();
      const { amount, decimals } = convert(order.total, currency);
      const created = await api<{ id: string; links: { rel: string; href: string }[] }>(ctx, "/v2/checkout/orders", {
        method: "POST",
        idempotencyKey: `order-${order.id}-${order.total}`,
        body: {
          intent: "CAPTURE",
          purchase_units: [{ reference_id: order.id, invoice_id: order.number, custom_id: order.id, amount: { currency_code: currency, value: fmt(amount, decimals) } }],
          payment_source: {
            paypal: {
              experience_context: {
                return_url: urls.success,
                cancel_url: urls.cancel,
                user_action: "PAY_NOW",
                shipping_preference: "NO_SHIPPING",
                locale: order.locale === "ar" ? "ar-EG" : "en-US",
              },
            },
          },
        },
      });
      const approve = created.links.find((l) => l.rel === "payer-action" || l.rel === "approve");
      if (!approve) throw new Error("PayPal did not return an approval link");
      return { type: "redirect", url: approve.href, providerRef: created.id };
    },
    async confirm(params, ctx, providerRef) {
      const id = params.get("token") ?? providerRef;
      if (id !== providerRef) return { status: "failed", message: "Token mismatch" };
      try {
        const captured = await api<{ status: string; purchase_units: { payments: { captures: { id: string; status: string }[] } }[] }>(ctx, `/v2/checkout/orders/${id}/capture`, {
          method: "POST",
          idempotencyKey: `capture-${id}`,
        });
        const capture = captured.purchase_units?.[0]?.payments?.captures?.[0];
        if (captured.status === "COMPLETED" && capture?.status === "COMPLETED") {
          return { status: "paid", providerRef: id, metadata: { captureId: capture.id } };
        }
        return { status: "pending", providerRef: id };
      } catch (e) {
        // Already captured (e.g. page refreshed) — look the order up instead.
        const existing = await api<{ status: string; purchase_units: { payments?: { captures?: { id: string }[] } }[] }>(ctx, `/v2/checkout/orders/${id}`, { method: "GET" });
        if (existing.status === "COMPLETED") return { status: "paid", providerRef: id, metadata: { captureId: existing.purchase_units?.[0]?.payments?.captures?.[0]?.id } };
        return { status: "failed", message: (e as Error).message, providerRef: id };
      }
    },
    async refund(_providerRef, amount, ctx, meta) {
      const captureId = meta.captureId as string | undefined;
      if (!captureId) return { ok: false, message: "No PayPal capture to refund." };
      const currency = String(ctx.config.settlementCurrency || "USD").toUpperCase();
      const converted = (meta.convert as ((m: number, c: string) => { amount: number; decimals: number }) | undefined)?.(amount, currency);
      const body = converted ? { amount: { currency_code: currency, value: fmt(converted.amount, converted.decimals) } } : {};
      const res = await api<{ id: string; status: string }>(ctx, `/v2/payments/captures/${captureId}/refund`, { method: "POST", body });
      return { ok: res.status === "COMPLETED" || res.status === "PENDING", message: res.status, refundRef: res.id };
    },
  },
};

const comingSoon = (key: string, name: string, en: string, ar: string): PaymentProvider => ({
  key,
  category: "payments",
  name,
  icon: "lucide:credit-card",
  availability: "coming_soon",
  description: { en, ar },
  fields: [],
});

/** Local gateways: listed so merchants see the roadmap; not functional until an adapter is written. */
export const plannedGateways: PaymentProvider[] = [
  comingSoon("hyperpay", "HyperPay", "Regional card acquiring (Visa, Mastercard, mada). Needs a merchant contract and adapter.", "قبول البطاقات إقليمياً. يتطلب عقد تاجر ومحوّل برمجي."),
  comingSoon("ngenius", "Network International (N-Genius)", "Card acquiring widely used by Jordanian banks.", "بوابة دفع مستخدمة لدى العديد من البنوك الأردنية."),
  comingSoon("efawateercom", "eFAWATEERcom", "Jordan's national bill-payment network.", "شبكة دفع الفواتير الوطنية في الأردن."),
];

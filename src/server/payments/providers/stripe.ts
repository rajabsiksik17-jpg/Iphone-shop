import "server-only";
import Stripe from "stripe";
import type { IntegrationContext } from "../../integrations/types";
import type { PaymentProvider } from "../types";

function client(ctx: IntegrationContext) {
  const key = ctx.mode === "live" ? ctx.secrets.liveSecretKey : ctx.secrets.testSecretKey;
  if (!key) throw new Error(`Stripe ${ctx.mode} secret key is not set.`);
  return new Stripe(key, { maxNetworkRetries: 2, timeout: 20_000 });
}

/** Stripe requires 3-decimal currency amounts (JOD, KWD…) to be divisible by 10. */
function stripeAmount(amount: number, decimals: number) {
  return decimals === 3 ? Math.round(amount / 10) * 10 : amount;
}

export const stripeProvider: PaymentProvider = {
  key: "stripe",
  category: "payments",
  name: "Stripe",
  icon: "stripe",
  docsUrl: "https://docs.stripe.com/payments/checkout",
  availability: "available",
  supportsModes: true,
  description: {
    en: "Cards, Apple Pay and Google Pay through Stripe Checkout (PCI-compliant hosted page). Payment confirmation via signed webhooks.",
    ar: "البطاقات وApple Pay وGoogle Pay عبر صفحة Stripe Checkout الآمنة. تأكيد الدفع عبر Webhooks موقّعة.",
  },
  fields: [
    { key: "title_en", type: "text", placeholder: "Credit / debit card", label: { en: "Checkout title (English)", ar: "العنوان (إنجليزي)" } },
    { key: "title_ar", type: "text", placeholder: "بطاقة ائتمان / خصم", label: { en: "Checkout title (Arabic)", ar: "العنوان (عربي)" } },
    { key: "testSecretKey", type: "secret", mode: "test", placeholder: "sk_test_…", label: { en: "Test secret key", ar: "المفتاح السري (اختبار)" } },
    { key: "testWebhookSecret", type: "secret", mode: "test", placeholder: "whsec_…", label: { en: "Test webhook signing secret", ar: "سر توقيع Webhook (اختبار)" } },
    { key: "liveSecretKey", type: "secret", mode: "live", placeholder: "sk_live_…", label: { en: "Live secret key", ar: "المفتاح السري (مباشر)" } },
    { key: "liveWebhookSecret", type: "secret", mode: "live", placeholder: "whsec_…", label: { en: "Live webhook signing secret", ar: "سر توقيع Webhook (مباشر)" } },
    { key: "settlementCurrency", type: "text", placeholder: "JOD", label: { en: "Charge currency (blank = store currency)", ar: "عملة الخصم (فارغ = عملة المتجر)" } },
  ],
  async test(ctx) {
    try {
      const s = client(ctx);
      const account = await s.accounts.retrieveCurrent();
      const webhook = ctx.mode === "live" ? ctx.secrets.liveWebhookSecret : ctx.secrets.testWebhookSecret;
      return {
        ok: true,
        message: `Connected to ${account.settings?.dashboard?.display_name ?? account.id} (${ctx.mode})${webhook ? "" : " — add the webhook secret so payments confirm reliably"}`,
      };
    } catch (e) {
      return { ok: false, message: (e as Error).message };
    }
  },
  payment: {
    async init(order, ctx, urls, convert) {
      const s = client(ctx);
      const currency = String(ctx.config.settlementCurrency || order.currency).toUpperCase();
      const total = convert(order.total, currency);
      const session = await s.checkout.sessions.create(
        {
          mode: "payment",
          customer_email: order.email,
          client_reference_id: order.id,
          locale: order.locale === "ar" ? "auto" : "en",
          line_items: [
            {
              quantity: 1,
              price_data: {
                currency: currency.toLowerCase(),
                unit_amount: stripeAmount(total.amount, total.decimals),
                product_data: { name: `Order ${order.number}`, description: order.items.map((i) => `${i.quantity}× ${i.name}`).join(", ").slice(0, 400) },
              },
            },
          ],
          metadata: { orderId: order.id, orderNumber: order.number },
          payment_intent_data: { metadata: { orderId: order.id, orderNumber: order.number } },
          success_url: `${urls.success}${urls.success.includes("?") ? "&" : "?"}session_id={CHECKOUT_SESSION_ID}`,
          cancel_url: urls.cancel,
          expires_at: Math.floor(Date.now() / 1000) + 60 * 60,
        },
        { idempotencyKey: `order-${order.id}-${order.total}` },
      );
      if (!session.url) throw new Error("Stripe did not return a checkout URL");
      return { type: "redirect", url: session.url, providerRef: session.id };
    },
    async confirm(params, ctx, providerRef) {
      const s = client(ctx);
      const sessionId = params.get("session_id") ?? providerRef;
      const session = await s.checkout.sessions.retrieve(sessionId);
      if (session.payment_status === "paid") {
        return { status: "paid", providerRef: session.id, metadata: { paymentIntent: session.payment_intent } };
      }
      if (session.status === "expired") return { status: "failed", message: "Checkout session expired", providerRef: session.id };
      return { status: "pending", providerRef: session.id };
    },
    async webhook(req, rawBody, ctx) {
      const secret = ctx.mode === "live" ? ctx.secrets.liveWebhookSecret : ctx.secrets.testWebhookSecret;
      if (!secret) throw new Error("Webhook secret not configured");
      const signature = req.headers.get("stripe-signature");
      if (!signature) throw new Error("Missing Stripe-Signature header");
      // Throws if the signature doesn't match — forged events are rejected.
      const event = client(ctx).webhooks.constructEvent(rawBody, signature, secret);
      switch (event.type) {
        case "checkout.session.completed":
        case "checkout.session.async_payment_succeeded": {
          const sess = event.data.object as Stripe.Checkout.Session;
          return sess.payment_status === "paid"
            ? { outcome: "paid", orderId: sess.metadata?.orderId, providerRef: sess.id }
            : { outcome: "ignored", orderId: sess.metadata?.orderId };
        }
        case "checkout.session.async_payment_failed":
        case "checkout.session.expired": {
          const sess = event.data.object as Stripe.Checkout.Session;
          return { outcome: "failed", orderId: sess.metadata?.orderId, providerRef: sess.id, message: event.type };
        }
        case "charge.refunded": {
          const charge = event.data.object as Stripe.Charge;
          return { outcome: "refunded", orderId: charge.metadata?.orderId, providerRef: String(charge.payment_intent ?? "") };
        }
        default:
          return { outcome: "ignored" };
      }
    },
    async refund(providerRef, amount, ctx, meta) {
      const s = client(ctx);
      let paymentIntent = meta.paymentIntent as string | undefined;
      if (!paymentIntent) {
        const session = await s.checkout.sessions.retrieve(providerRef);
        paymentIntent = session.payment_intent as string;
      }
      const currency = String(ctx.config.settlementCurrency || meta.currency || "").toUpperCase();
      const refund = await s.refunds.create({ payment_intent: paymentIntent, amount: meta.decimals === 3 ? Math.round(amount / 10) * 10 : amount, metadata: { currency } });
      return { ok: refund.status !== "failed", message: refund.status ?? "created", refundRef: refund.id };
    },
  },
};

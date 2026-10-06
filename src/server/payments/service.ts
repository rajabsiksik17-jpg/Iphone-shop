import "server-only";
import { db } from "../db";
import { emit } from "../events";
import { logger, errorMessage } from "../logger";
import { activeIntegration, loadContext } from "../integrations/service";
import { getPaymentProvider } from "../integrations/registry";
import { converter } from "../commerce/currency";
import type { Prisma } from "@/generated/prisma/client";

export async function recordPaymentLog(provider: string, level: "info" | "warn" | "error", event: string, message: string, data: Record<string, unknown> = {}) {
  await db.paymentLog
    .create({ data: { provider, level, event, message: message.slice(0, 1000), orderId: (data.orderId as string) ?? null, data: data as Prisma.InputJsonValue } })
    .catch(() => {});
}

/**
 * Idempotently mark an order paid. Safe to call from both the return URL and
 * the webhook (whichever arrives first wins; the other is a no-op).
 */
export async function markOrderPaid(orderId: string, provider: string, providerRef: string | null, metadata: Record<string, unknown> = {}) {
  const updated = await db.order.updateMany({
    where: { id: orderId, paymentStatus: { notIn: ["PAID", "REFUNDED", "PARTIALLY_REFUNDED"] } },
    data: { paymentStatus: "PAID", paidAt: new Date() },
  });
  if (updated.count === 0) return false;
  const order = await db.order.findUniqueOrThrow({ where: { id: orderId } });
  const payment = await db.payment.findFirst({ where: { orderId, provider, ...(providerRef ? { providerRef } : {}) }, orderBy: { createdAt: "desc" } });
  if (payment) {
    await db.payment.update({ where: { id: payment.id }, data: { status: "CAPTURED", metadata: { ...(payment.metadata as object), ...metadata } as Prisma.InputJsonValue } });
  } else {
    await db.payment.create({ data: { orderId, provider, providerRef, amount: order.total, currency: order.currency, status: "CAPTURED", metadata: metadata as Prisma.InputJsonValue } });
  }
  // Move pending orders to "paid"; leave orders an admin already advanced alone.
  if (order.statusKey === "pending") {
    await db.order.update({ where: { id: orderId }, data: { statusKey: "paid", history: { create: { fromStatus: "pending", toStatus: "paid", note: `Payment confirmed via ${provider}` } } } });
  }
  await recordPaymentLog(provider, "info", "paid", `Order ${order.number} paid`, { orderId, providerRef });
  emit("ORDER_PAID", { orderId });
  return true;
}

export async function markPaymentFailed(orderId: string, provider: string, message: string, providerRef?: string | null) {
  const order = await db.order.findUnique({ where: { id: orderId } });
  if (!order || order.paymentStatus === "PAID") return;
  await db.order.update({ where: { id: orderId }, data: { paymentStatus: "FAILED" } });
  await db.payment.updateMany({ where: { orderId, provider, ...(providerRef ? { providerRef } : {}), status: "PENDING" }, data: { status: "FAILED", errorMessage: message.slice(0, 500) } });
  await recordPaymentLog(provider, "warn", "failed", message, { orderId, providerRef });
  emit("PAYMENT_FAILED", { orderId, provider, message });
}

/** Shopper returned from the hosted page. Verify server-to-server; never trust query params alone. */
export async function handleReturn(providerKey: string, orderNumber: string, params: URLSearchParams) {
  const provider = getPaymentProvider(providerKey);
  const ctx = await loadContext(providerKey);
  const order = await db.order.findUnique({ where: { number: orderNumber }, include: { payments: { where: { provider: providerKey }, orderBy: { createdAt: "desc" }, take: 1 } } });
  if (!provider?.payment?.confirm || !ctx || !order) return { status: "failed" as const };
  if (order.paymentStatus === "PAID") return { status: "paid" as const };
  const payment = order.payments[0];
  if (!payment?.providerRef) return { status: "failed" as const };
  try {
    const result = await provider.payment.confirm(params, ctx, payment.providerRef);
    if (result.status === "paid") await markOrderPaid(order.id, providerKey, result.providerRef, result.metadata);
    else if (result.status === "failed") await markPaymentFailed(order.id, providerKey, result.message, result.providerRef);
    return { status: result.status };
  } catch (e) {
    await recordPaymentLog(providerKey, "error", "confirm_failed", errorMessage(e), { orderId: order.id });
    return { status: "pending" as const };
  }
}

export async function handleWebhook(providerKey: string, req: Request) {
  const provider = getPaymentProvider(providerKey);
  const ctx = await activeIntegration(providerKey);
  if (!provider?.payment?.webhook || !ctx) return { status: 404 };
  const raw = await req.text();
  try {
    const result = await provider.payment.webhook(req, raw, ctx);
    if (result.outcome === "ignored" || !result.orderId) return { status: 200 };
    if (result.outcome === "paid") await markOrderPaid(result.orderId, providerKey, result.providerRef ?? null);
    if (result.outcome === "failed") await markPaymentFailed(result.orderId, providerKey, result.message ?? "Payment failed", result.providerRef);
    await recordPaymentLog(providerKey, "info", `webhook_${result.outcome}`, result.message ?? result.outcome, { orderId: result.orderId });
    return { status: 200 };
  } catch (e) {
    // Signature failures land here — logged, rejected, never processed.
    await recordPaymentLog(providerKey, "error", "webhook_rejected", errorMessage(e));
    logger.warn("payments", `Rejected ${providerKey} webhook`, { error: errorMessage(e) });
    return { status: 400 };
  }
}

/** Refund through the gateway when possible; offline methods record a manual refund. */
export async function refundViaProvider(orderId: string, amount: number) {
  const payment = await db.payment.findFirst({ where: { orderId, status: { in: ["CAPTURED", "PARTIALLY_REFUNDED"] } }, orderBy: { createdAt: "desc" }, include: { order: true } });
  if (!payment) return { ok: true, manual: true as const, message: "No online payment — recorded as a manual refund." };
  const provider = getPaymentProvider(payment.provider);
  const ctx = await loadContext(payment.provider);
  if (!provider?.payment?.refund || !ctx || !payment.providerRef) return { ok: true, manual: true as const, message: "Gateway refund not supported — recorded as manual." };
  const base = await db.currency.findFirst({ where: { isBase: true } });
  try {
    const result = await provider.payment.refund(payment.providerRef, amount, ctx, {
      ...(payment.metadata as object),
      currency: payment.currency,
      decimals: base?.decimals ?? 3,
      convert: await converter(),
    });
    await recordPaymentLog(payment.provider, result.ok ? "info" : "error", "refund", result.message, { orderId, amount });
    return { ok: result.ok, manual: false as const, message: result.message, refundRef: result.refundRef, paymentId: payment.id };
  } catch (e) {
    await recordPaymentLog(payment.provider, "error", "refund_failed", errorMessage(e), { orderId, amount });
    return { ok: false, manual: false as const, message: errorMessage(e), paymentId: payment.id };
  }
}

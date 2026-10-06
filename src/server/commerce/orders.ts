import "server-only";
import { db } from "../db";
import { emit } from "../events";
import { AppError } from "../errors";
import { audit } from "../audit";
import { getSettings } from "../settings/service";
import { applyStockChange, afterStockChange } from "../catalog/inventory";
import { markOrderPaid, refundViaProvider } from "../payments/service";
import { sendTemplate } from "../email/mailer";
import { formatBase, baseCurrency } from "./currency";
import type { CurrentStaff } from "../auth/session";

type Actor = Pick<CurrentStaff, "id" | "email">;

/** Timestamps set when entering well-known statuses. */
const STATUS_TIMESTAMPS: Record<string, "shippedAt" | "completedAt" | "cancelledAt"> = {
  shipped: "shippedAt",
  completed: "completedAt",
  cancelled: "cancelledAt",
};

export async function changeOrderStatus(orderId: string, toKey: string, opts: { note?: string; notifyCustomer?: boolean; actor?: Actor; tracking?: { number?: string; url?: string; carrier?: string } }) {
  const [order, target] = await Promise.all([
    db.order.findUnique({ where: { id: orderId }, include: { items: true, status: true } }),
    db.orderStatus.findUnique({ where: { key: toKey } }),
  ]);
  if (!order) throw new AppError("not_found", 404);
  if (!target) throw new AppError("invalid_status", 422);
  if (order.statusKey === toKey && !opts.tracking) return order;

  const restock = target.restocks && !order.status.restocks;
  const unrestock = !target.restocks && order.status.restocks; // re-opening a cancelled order
  const stockEvents: { productId: string; variantId: string | null; balance: number; previous: number }[] = [];

  await db.$transaction(async (tx) => {
    if (restock || unrestock) {
      for (const item of order.items) {
        if (!item.productId) continue;
        const qty = item.quantity - item.refundedQty;
        if (qty <= 0) continue;
        const r = await applyStockChange(
          { productId: item.productId, variantId: item.variantId, delta: restock ? qty : -qty, reason: restock ? "ORDER_CANCELLED" : "ORDER", note: order.number, orderId, userId: opts.actor?.id, enforce: unrestock },
          tx,
        );
        if (r) stockEvents.push({ productId: item.productId, variantId: item.variantId, balance: r.balance, previous: r.balance + (restock ? -qty : qty) });
      }
    }
    const stamp = STATUS_TIMESTAMPS[toKey];
    await tx.order.update({
      where: { id: orderId },
      data: {
        statusKey: toKey,
        ...(stamp ? { [stamp]: new Date() } : {}),
        ...(opts.tracking ? { trackingNumber: opts.tracking.number || null, trackingUrl: opts.tracking.url || null, carrier: opts.tracking.carrier || null } : {}),
        history: {
          create: { fromStatus: order.statusKey, toStatus: toKey, note: opts.note, userId: opts.actor?.id, notifiedCustomer: Boolean(opts.notifyCustomer ?? target.notifyCustomer) },
        },
      },
    });
  });

  for (const s of stockEvents) await afterStockChange(s.productId, s.variantId, s.balance, s.previous);
  await loyaltyOnStatus(orderId, toKey);
  if (opts.actor) {
    await audit({ actor: opts.actor, action: "order.status_changed", entityType: "order", entityId: orderId, summary: `${order.number}: ${order.statusKey} → ${toKey}`, changes: { status: { from: order.statusKey, to: toKey } } });
  }
  emit("ORDER_STATUS_CHANGED", { orderId, from: order.statusKey, to: toKey, notifyCustomer: Boolean(opts.notifyCustomer ?? target.notifyCustomer), actorId: opts.actor?.id });
  return db.order.findUniqueOrThrow({ where: { id: orderId } });
}

/** Earn on completion; reverse earned + return redeemed on cancellation/refund. */
async function loyaltyOnStatus(orderId: string, toKey: string) {
  const loyalty = await getSettings("loyalty");
  const order = await db.order.findUniqueOrThrow({ where: { id: orderId } });
  if (!order.userId) return;
  const base = await baseCurrency();
  if (toKey === "completed" && loyalty.enabled && order.pointsEarned === 0) {
    const earned = Math.floor(((order.total - order.refundedTotal) / 10 ** base.decimals) * loyalty.pointsPerUnit);
    if (earned <= 0) return;
    await db.$transaction(async (tx) => {
      const u = await tx.user.update({ where: { id: order.userId! }, data: { pointsBalance: { increment: earned } } });
      await tx.pointsTransaction.create({ data: { userId: u.id, delta: earned, balanceAfter: u.pointsBalance, reason: "ORDER_EARNED", orderId } });
      await tx.order.update({ where: { id: orderId }, data: { pointsEarned: earned } });
    });
  }
  if (toKey === "cancelled" || toKey === "refunded" || toKey === "failed") {
    await db.$transaction(async (tx) => {
      if (order.pointsRedeemed > 0) {
        const u = await tx.user.update({ where: { id: order.userId! }, data: { pointsBalance: { increment: order.pointsRedeemed } } });
        await tx.pointsTransaction.create({ data: { userId: u.id, delta: order.pointsRedeemed, balanceAfter: u.pointsBalance, reason: "ORDER_REVERSED", orderId, note: "Redeemed points returned" } });
      }
      if (order.pointsEarned > 0) {
        const current = await tx.user.findUniqueOrThrow({ where: { id: order.userId! } });
        const take = Math.min(current.pointsBalance, order.pointsEarned);
        const u = await tx.user.update({ where: { id: current.id }, data: { pointsBalance: { decrement: take } } });
        await tx.pointsTransaction.create({ data: { userId: u.id, delta: -take, balanceAfter: u.pointsBalance, reason: "ORDER_REVERSED", orderId, note: "Earned points reversed" } });
      }
      await tx.order.update({ where: { id: orderId }, data: { pointsRedeemed: 0, pointsEarned: 0 } });
    });
  }
}

/** Offline payments (COD collected, bank transfer received). */
export async function markPaidManually(orderId: string, actor: Actor, reference?: string) {
  const order = await db.order.findUniqueOrThrow({ where: { id: orderId } });
  const ok = await markOrderPaid(orderId, order.paymentMethod, reference ?? null, { manual: true, by: actor.email });
  if (ok) await audit({ actor, action: "order.marked_paid", entityType: "order", entityId: orderId, summary: `${order.number} marked paid${reference ? ` (${reference})` : ""}` });
  return ok;
}

export async function addOrderNote(orderId: string, body: string, isInternal: boolean, actor: Actor) {
  const note = await db.orderNote.create({ data: { orderId, body: body.slice(0, 4000), isInternal, authorId: actor.id } });
  await audit({ actor, action: "order.note_added", entityType: "order", entityId: orderId });
  return note;
}

/**
 * Full or partial refund. Attempts the gateway first; if that fails nothing is
 * recorded so the admin can retry. Optional restock per line.
 */
export async function refundOrder(orderId: string, input: { amount: number; reason?: string; restockItems?: { itemId: string; quantity: number }[]; notify?: boolean }, actor: Actor) {
  const order = await db.order.findUniqueOrThrow({ where: { id: orderId }, include: { items: true } });
  const refundable = order.total - order.refundedTotal;
  if (input.amount <= 0 || input.amount > refundable) throw new AppError("invalid_refund_amount", 422, { max: refundable });

  const gateway = order.paymentStatus === "PAID" || order.paymentStatus === "PARTIALLY_REFUNDED" ? await refundViaProvider(orderId, input.amount) : { ok: true, manual: true as const, message: "Unpaid order" };
  if (!gateway.ok) throw new AppError("refund_failed", 502, { message: gateway.message });

  const stockEvents: { productId: string; variantId: string | null; balance: number; previous: number }[] = [];
  await db.$transaction(async (tx) => {
    await tx.refund.create({
      data: {
        orderId,
        paymentId: "paymentId" in gateway ? gateway.paymentId : undefined,
        amount: input.amount,
        reason: input.reason,
        providerRef: "refundRef" in gateway ? gateway.refundRef : undefined,
        status: gateway.manual ? "manual" : "succeeded",
        restock: Boolean(input.restockItems?.length),
        createdById: actor.id,
      },
    });
    for (const r of input.restockItems ?? []) {
      const item = order.items.find((i) => i.id === r.itemId);
      if (!item?.productId) continue;
      const qty = Math.min(r.quantity, item.quantity - item.refundedQty);
      if (qty <= 0) continue;
      await tx.orderItem.update({ where: { id: item.id }, data: { refundedQty: { increment: qty } } });
      const res = await applyStockChange({ productId: item.productId, variantId: item.variantId, delta: qty, reason: "RETURN", note: order.number, orderId, userId: actor.id }, tx);
      if (res) stockEvents.push({ productId: item.productId, variantId: item.variantId, balance: res.balance, previous: res.balance - qty });
    }
    const refundedTotal = order.refundedTotal + input.amount;
    const full = refundedTotal >= order.total;
    await tx.order.update({
      where: { id: orderId },
      data: {
        refundedTotal,
        paymentStatus: order.paymentStatus === "PAID" || order.paymentStatus === "PARTIALLY_REFUNDED" ? (full ? "REFUNDED" : "PARTIALLY_REFUNDED") : order.paymentStatus,
        ...(full ? { statusKey: "refunded", history: { create: { fromStatus: order.statusKey, toStatus: "refunded", note: input.reason, userId: actor.id } } } : {}),
      },
    });
    await tx.payment.updateMany({ where: { orderId, status: { in: ["CAPTURED", "PARTIALLY_REFUNDED"] } }, data: { status: full ? "REFUNDED" : "PARTIALLY_REFUNDED" } });
  });

  for (const s of stockEvents) await afterStockChange(s.productId, s.variantId, s.balance, s.previous);
  if (order.total - order.refundedTotal - input.amount <= 0) await loyaltyOnStatus(orderId, "refunded");
  await audit({ actor, action: "order.refunded", entityType: "order", entityId: orderId, summary: `${order.number}: refunded ${input.amount}${gateway.manual ? " (manual)" : ""}`, changes: { amount: input.amount, reason: input.reason } });
  if (input.notify !== false) {
    await sendTemplate({ template: "order_refunded", to: order.email, locale: order.locale, orderId, vars: { customer_name: order.customerName, order_number: order.number, refund_amount: await formatBase(input.amount, order.locale) } });
  }
  return { manual: gateway.manual, message: gateway.message };
}

/**
 * Scheduler: online-payment orders abandoned on the gateway page are failed
 * and their stock released after the configured hold time.
 */
export async function expireUnpaidOrders() {
  const { holdUnpaidMinutes } = await getSettings("checkout");
  const cutoff = new Date(Date.now() - holdUnpaidMinutes * 60_000);
  const stale = await db.order.findMany({
    where: { statusKey: "pending", paymentStatus: { in: ["PENDING", "FAILED"] }, placedAt: { lt: cutoff } },
    select: { id: true },
    take: 50,
  });
  for (const o of stale) await changeOrderStatus(o.id, "failed", { note: "Payment not completed in time", notifyCustomer: false });
  return stale.length;
}

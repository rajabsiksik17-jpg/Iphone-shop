"use server";

import { z } from "zod";
import { changeOrderStatus, markPaidManually, addOrderNote, refundOrder } from "@/server/commerce/orders";
import { idSchema } from "../helpers";
import { orderDetail, orderWhere } from "@/server/admin/orders";
import { db } from "@/server/db";
import { AppError } from "@/server/errors";
import type { CurrentStaff } from "@/server/auth/session";
import { adminRun } from "./_base";

export async function updateOrderStatusAction(input: { orderId: string; status: string; note?: string; notify: boolean; tracking?: { number?: string; url?: string; carrier?: string } }) {
  return adminRun("orders.manage", async (staff) => {
    const p = z
      .object({
        orderId: idSchema,
        status: z.string().min(1).max(40),
        note: z.string().max(1000).optional(),
        notify: z.boolean(),
        tracking: z.object({ number: z.string().max(80).optional(), url: z.union([z.string().url().max(500), z.literal("")]).optional(), carrier: z.string().max(60).optional() }).optional(),
      })
      .parse(input);
    await changeOrderStatus(p.orderId, p.status, { note: p.note, notifyCustomer: p.notify, actor: staff, tracking: p.tracking });
  });
}

export async function markOrderPaidAction(orderId: string, reference?: string) {
  return adminRun("orders.manage", (staff) => markPaidManually(idSchema.parse(orderId), staff, z.string().max(120).optional().parse(reference)));
}

export async function addOrderNoteAction(orderId: string, body: string, internal: boolean) {
  return adminRun("orders.manage", async (staff) => {
    const note = await addOrderNote(idSchema.parse(orderId), z.string().trim().min(1).max(4000).parse(body), internal, staff);
    return { id: note.id, body: note.body, isInternal: note.isInternal, createdAt: note.createdAt.toISOString(), author: staff.name };
  });
}

export async function refundOrderAction(input: { orderId: string; amount: number; reason?: string; restockItems?: { itemId: string; quantity: number }[]; notify?: boolean }) {
  return adminRun("orders.refund", async (staff) => {
    const p = z
      .object({
        orderId: idSchema,
        amount: z.number().int().positive(),
        reason: z.string().max(500).optional(),
        restockItems: z.array(z.object({ itemId: idSchema, quantity: z.number().int().min(0).max(999) })).max(100).optional(),
        notify: z.boolean().optional(),
      })
      .parse(input);
    return refundOrder(p.orderId, p, staff);
  });
}

/** Full order for the management drawer (loaded on demand, nothing navigates away). */
export async function orderDrawerAction(orderId: string, locale: string) {
  return adminRun("orders.view", async (staff) => {
    const o = await orderDetail(idSchema.parse(orderId), z.enum(["ar", "en"]).parse(locale), staff);
    if (!o) throw new AppError("not_found", 404);
    return o;
  }, { revalidate: false });
}

const bulkOrderOp = z.discriminatedUnion("type", [
  z.object({ type: z.literal("status"), status: z.string().min(1).max(40), notify: z.boolean() }),
  z.object({ type: z.literal("markPaid") }),
  z.object({ type: z.literal("note"), body: z.string().trim().min(1).max(4000), internal: z.boolean() }),
]);

/**
 * Apply one operation to many orders. Each order goes through the same code
 * path as a single change (history, stock, notifications), and failures are
 * reported per order instead of aborting the whole batch.
 */
export async function bulkOrdersAction(orderIds: string[], op: unknown) {
  return adminRun("orders.manage", (staff) => runBulkOrders(z.array(idSchema).min(1).max(200).parse(orderIds), op, staff));
}

const orderFilter = z.object({ q: z.string().max(200).optional(), status: z.string().max(40).optional(), payment: z.string().max(40).optional(), from: z.string().max(10).optional(), to: z.string().max(10).optional() });

/** Same operations on every order matching the list's current filters (capped at 1,000). */
export async function bulkOrdersMatchingAction(filter: unknown, op: unknown) {
  return adminRun("orders.manage", async (staff) => {
    const ids = (await db.order.findMany({ where: orderWhere(orderFilter.parse(filter)), select: { id: true }, take: 1000 })).map((o) => o.id);
    return runBulkOrders(ids, op, staff);
  });
}

/**
 * Apply one operation to many orders. Each order goes through the same code
 * path as a single change (history, stock, notifications); failures are
 * reported per order instead of aborting the batch.
 */
async function runBulkOrders(ids: string[], op: unknown, staff: CurrentStaff) {
  {
    const p = bulkOrderOp.parse(op);
    const orders = await db.order.findMany({ where: { id: { in: ids } }, select: { id: true, number: true, paymentStatus: true } });
    let done = 0;
    let skipped = 0;
    const failed: { number: string; error: string }[] = [];
    for (const o of orders) {
      try {
        if (p.type === "status") await changeOrderStatus(o.id, p.status, { notifyCustomer: p.notify, actor: staff });
        else if (p.type === "markPaid") {
          if (o.paymentStatus === "PAID" || o.paymentStatus === "REFUNDED" || o.paymentStatus === "PARTIALLY_REFUNDED") {
            skipped++;
            continue;
          }
          await markPaidManually(o.id, staff);
        } else await addOrderNote(o.id, p.body, p.internal, staff);
        done++;
      } catch (e) {
        failed.push({ number: o.number, error: e instanceof AppError ? e.code : "error" });
      }
    }
    return { done, skipped, failed };
  }
}

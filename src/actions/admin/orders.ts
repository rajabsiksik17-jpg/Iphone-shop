"use server";

import { z } from "zod";
import { changeOrderStatus, markPaidManually, addOrderNote, refundOrder } from "@/server/commerce/orders";
import { idSchema } from "../helpers";
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

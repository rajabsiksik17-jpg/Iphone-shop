import "server-only";
import { db } from "../db";
import { getSettings } from "../settings/service";
import { hasPermission } from "@/config/permissions";
import type { CurrentStaff } from "../auth/session";
import type { CounterKey } from "../realtime/emitter";

/**
 * Live sidebar badges. Each number is something actionable (not vanity):
 * orders to fulfil, reviews to moderate, customers waiting in chat, unread
 * messages, products below their stock threshold, unread notifications and
 * customers who joined since this admin last looked.
 */
export async function adminCounters(staff: CurrentStaff): Promise<Record<CounterKey, number>> {
  const p = staff.permissions;
  const prefs = (staff.preferences ?? {}) as { seen?: Record<string, string> };
  const seenCustomers = prefs.seen?.customers ? new Date(prefs.seen.customers) : new Date(Date.now() - 7 * 86_400_000);
  const { lowStockThreshold } = await getSettings("store");

  const [orders, reviews, chats, messages, customers, inventory, notifications] = await Promise.all([
    hasPermission(p, "orders.view") ? db.order.count({ where: { statusKey: { in: ["pending", "paid", "processing"] } } }) : 0,
    hasPermission(p, "reviews.moderate") ? db.review.count({ where: { status: "PENDING" } }) : 0,
    hasPermission(p, "support.chat")
      ? db.conversation.count({ where: { OR: [{ status: "WAITING" }, { assignedAgentId: staff.id, status: { in: ["ASSIGNED", "ACTIVE"] }, OR: [{ agentLastRead: null }, { lastMessageAt: { gt: db.conversation.fields.agentLastRead } }] }] } }).catch(() =>
          db.conversation.count({ where: { status: "WAITING" } }),
        )
      : 0,
    hasPermission(p, "support.messages") ? db.contactSubmission.count({ where: { status: "NEW" } }) : 0,
    hasPermission(p, "customers.view") ? db.user.count({ where: { type: "CUSTOMER", createdAt: { gt: seenCustomers } } }) : 0,
    hasPermission(p, "inventory.manage")
      ? db.product.count({ where: { status: "ACTIVE", trackInventory: true, OR: [{ stockStatus: { in: ["LOW_STOCK", "OUT_OF_STOCK"] } }, { type: "SIMPLE", stock: { lte: lowStockThreshold } }] } })
      : 0,
    db.notification.count({
      where: {
        audience: "STAFF",
        createdAt: { gt: new Date(Date.now() - 30 * 86_400_000) },
        reads: { none: { userId: staff.id } },
        ...(p.includes("*") ? {} : { permission: { in: [...p] } }),
      },
    }),
  ]);
  return { orders, reviews, chats, messages, customers, inventory, notifications };
}

/** Remember when this admin last viewed a section (clears "new since" badges). */
export async function markSeen(staff: CurrentStaff, key: string) {
  const prefs = (staff.preferences ?? {}) as { seen?: Record<string, string> };
  await db.user.update({ where: { id: staff.id }, data: { preferences: { ...prefs, seen: { ...prefs.seen, [key]: new Date().toISOString() } } } });
}

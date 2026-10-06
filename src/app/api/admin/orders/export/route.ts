import { db } from "@/server/db";
import { getCurrentStaff } from "@/server/auth/session";
import { hasPermission } from "@/config/permissions";
import { orderWhere } from "@/server/admin/orders";
import { audit } from "@/server/audit";
import { baseCurrency } from "@/server/commerce/currency";

export const dynamic = "force-dynamic";

/** CSV export honouring the current list filters. Formula-injection safe. */
export async function GET(req: Request) {
  const staff = await getCurrentStaff();
  if (!staff || !hasPermission(staff.permissions, "orders.view")) return new Response("Forbidden", { status: 403 });
  const url = new URL(req.url);
  const q = Object.fromEntries(url.searchParams.entries());
  const rows = await db.order.findMany({ where: orderWhere(q), orderBy: { placedAt: "desc" }, take: 10_000, include: { _count: { select: { items: true } } } });
  const base = await baseCurrency();
  const money = (n: number) => (n / 10 ** base.decimals).toFixed(base.decimals);
  // Prefix cells that spreadsheets would treat as formulas.
  const cell = (v: unknown) => {
    let s = String(v ?? "");
    if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const pii = hasPermission(staff.permissions, "customers.pii");
  const header = ["number", "placed_at", "status", "payment_status", "payment_method", "customer", "email", "phone", "items", "subtotal", "discount", "shipping", "tax", "total", "refunded", "currency"];
  const lines = rows.map((o) =>
    [o.number, o.placedAt.toISOString(), o.statusKey, o.paymentStatus, o.paymentMethod, o.customerName, pii ? o.email : "", pii ? o.phone : "", o._count.items, money(o.subtotal), money(o.discountTotal), money(o.shippingTotal), money(o.taxTotal), money(o.total), money(o.refundedTotal), o.currency]
      .map(cell)
      .join(","),
  );
  await audit({ actor: staff, action: "orders.exported", summary: `${rows.length} orders exported` });
  return new Response(`﻿${[header.join(","), ...lines].join("\n")}`, {
    headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="orders-${new Date().toISOString().slice(0, 10)}.csv"`, "Cache-Control": "no-store" },
  });
}

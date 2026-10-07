import "server-only";
import { paymentMethodTitle } from "@/server/integrations/registry";
import { db, Prisma } from "../db";
import { t } from "@/lib/i18n-text";
import { hasPermission } from "@/config/permissions";
import type { CurrentStaff } from "../auth/session";

export const ORDER_PAGE_SIZE = 25;
const OPEN = ["pending", "paid", "processing"];

export type OrderListQuery = { q?: string; status?: string; payment?: string; method?: string; from?: string; to?: string; page?: number; customerId?: string; /** Comma-separated order ids (export of a selection). */ ids?: string };

export function orderWhere(q: OrderListQuery): Prisma.OrderWhereInput {
  const and: Prisma.OrderWhereInput[] = [];
  if (q.status === "open") and.push({ statusKey: { in: OPEN } });
  else if (q.status) and.push({ statusKey: q.status });
  if (q.payment) and.push({ paymentStatus: q.payment as Prisma.EnumPaymentStatusFilter["equals"] });
  if (q.method) and.push({ paymentMethod: q.method });
  if (q.customerId) and.push({ userId: q.customerId });
  if (q.ids) and.push({ id: { in: q.ids.split(",").filter((x) => /^[a-z0-9]{8,40}$/i.test(x)).slice(0, 500) } });
  if (q.from) and.push({ placedAt: { gte: new Date(`${q.from}T00:00:00`) } });
  if (q.to) and.push({ placedAt: { lt: new Date(new Date(`${q.to}T00:00:00`).getTime() + 86_400_000) } });
  if (q.q) {
    const like = { contains: q.q.trim(), mode: "insensitive" as const };
    and.push({ OR: [{ number: like }, { email: like }, { customerName: like }, { phone: { contains: q.q.replace(/\s/g, "") } }, { items: { some: { sku: like } } }] });
  }
  return and.length ? { AND: and } : {};
}

export async function listOrders(q: OrderListQuery, locale: string) {
  const page = Math.max(1, q.page ?? 1);
  const where = orderWhere(q);
  const [rows, total, statuses, counts] = await Promise.all([
    db.order.findMany({ where, orderBy: { placedAt: "desc" }, skip: (page - 1) * ORDER_PAGE_SIZE, take: ORDER_PAGE_SIZE, include: { status: true, _count: { select: { items: true } } } }),
    db.order.count({ where }),
    db.orderStatus.findMany({ orderBy: { position: "asc" } }),
    db.order.groupBy({ by: ["statusKey"], _count: { _all: true } }),
  ]);
  const countMap = Object.fromEntries(counts.map((c) => [c.statusKey, c._count._all]));
  return {
    rows: rows.map((o) => ({
      id: o.id,
      number: o.number,
      customer: o.customerName,
      email: o.email,
      itemCount: o._count.items,
      total: o.total,
      status: { key: o.statusKey, label: t(o.status.label, locale), color: o.status.color },
      paymentStatus: o.paymentStatus,
      paymentMethod: o.paymentMethod,
      placedAt: o.placedAt.toISOString(),
    })),
    total,
    page,
    pageCount: Math.max(1, Math.ceil(total / ORDER_PAGE_SIZE)),
    statuses: statuses.map((s) => ({ key: s.key, label: t(s.label, locale), color: s.color, count: countMap[s.key] ?? 0, notify: s.notifyCustomer, isFinal: s.isFinal })),
    openCount: OPEN.reduce((s, k) => s + (countMap[k] ?? 0), 0),
    allCount: Object.values(countMap).reduce((a, b) => a + b, 0),
  };
}

export async function orderDetail(id: string, locale: string, staff: CurrentStaff) {
  const o = await db.order.findUnique({
    where: { id },
    include: {
      status: true,
      items: { include: { product: { select: { id: true, slug: true } } } },
      history: { orderBy: { createdAt: "asc" }, include: { user: { select: { name: true } } } },
      notes: { orderBy: { createdAt: "desc" }, include: { author: { select: { name: true } } } },
      discounts: true,
      payments: { orderBy: { createdAt: "desc" } },
      refunds: { orderBy: { createdAt: "desc" }, include: { createdBy: { select: { name: true } } } },
      user: { select: { id: true, name: true, email: true, createdAt: true, _count: { select: { orders: true } } } },
    },
  });
  if (!o) return null;
  const [statuses, integration] = await Promise.all([db.orderStatus.findMany({ orderBy: { position: "asc" } }), db.integration.findUnique({ where: { key: o.paymentMethod }, select: { config: true } })]);
  const pii = hasPermission(staff.permissions, "customers.pii") || hasPermission(staff.permissions, "orders.manage");
  const statusLabel = (k: string | null) => (k ? t(statuses.find((s) => s.key === k)?.label, locale) || k : "");
  const address = o.shippingAddress as Record<string, string>;
  const cfg = (integration?.config ?? {}) as Record<string, string>;
  return {
    id: o.id,
    number: o.number,
    locale: o.locale,
    status: { key: o.statusKey, label: t(o.status.label, locale), color: o.status.color },
    paymentStatus: o.paymentStatus,
    paymentMethod: paymentMethodTitle(o.paymentMethod, cfg, locale),
    paymentMethodKey: o.paymentMethod,
    placedAt: o.placedAt.toISOString(),
    customer: {
      name: o.customerName,
      email: pii ? o.email : maskEmailPart(o.email),
      phone: pii ? o.phone : o.phone.replace(/\d(?=\d{3})/g, "•"),
      user: o.user ? { id: o.user.id, orders: o.user._count.orders, since: o.user.createdAt.toISOString() } : null,
    },
    address: pii ? address : { ...address, line1: "•••", line2: "", phone: "•••" },
    shippingMethod: t(o.shippingMethodName, locale),
    customerNote: o.customerNote,
    tracking: { number: o.trackingNumber ?? "", url: o.trackingUrl ?? "", carrier: o.carrier ?? "" },
    items: o.items.map((i) => ({
      id: i.id,
      productId: i.productId,
      name: t(i.name, locale),
      variant: i.variantLabel ? t(i.variantLabel, locale) : null,
      sku: i.sku,
      image: i.imageUrl,
      unitPrice: i.unitPrice,
      regularUnitPrice: i.regularUnitPrice,
      quantity: i.quantity,
      refundedQty: i.refundedQty,
      total: i.total,
    })),
    totals: { subtotal: o.subtotal, discount: o.discountTotal, shipping: o.shippingTotal, tax: o.taxTotal, total: o.total, refunded: o.refundedTotal },
    discounts: o.discounts.map((d) => ({ id: d.id, label: t(d.label, locale) || d.code || "", code: d.code, amount: d.amount })),
    history: o.history.map((h) => ({ id: h.id, from: statusLabel(h.fromStatus), to: statusLabel(h.toStatus), toKey: h.toStatus, note: h.note, by: h.user?.name ?? null, notified: h.notifiedCustomer, at: h.createdAt.toISOString() })),
    notes: o.notes.map((n) => ({ id: n.id, body: n.body, isInternal: n.isInternal, author: n.author?.name ?? "—", createdAt: n.createdAt.toISOString() })),
    payments: o.payments.map((p) => ({ id: p.id, provider: p.provider, mode: p.mode, ref: p.providerRef, amount: p.amount, status: p.status, error: p.errorMessage, at: p.createdAt.toISOString() })),
    refunds: o.refunds.map((r) => ({ id: r.id, amount: r.amount, reason: r.reason, status: r.status, by: r.createdBy?.name ?? null, at: r.createdAt.toISOString() })),
    statuses: statuses.map((s) => ({ key: s.key, label: t(s.label, locale), color: s.color, notifyCustomer: s.notifyCustomer })),
    pii,
  };
}

function maskEmailPart(email: string) {
  const [u, d] = email.split("@");
  return `${u.slice(0, 2)}•••@${d ?? ""}`;
}

export type OrderDetail = NonNullable<Awaited<ReturnType<typeof orderDetail>>>;

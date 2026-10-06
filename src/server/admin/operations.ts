import "server-only";
import { z } from "zod";
import { db, Prisma } from "../db";
import { Errors } from "../errors";
import { audit } from "../audit";
import { revokeAllSessions } from "../auth/session";
import { getSettings } from "../settings/service";
import { localized, t } from "@/lib/i18n-text";
import { hasPermission } from "@/config/permissions";
import type { CurrentStaff } from "../auth/session";

const PAGE = 30;
const pageOf = (n?: number) => Math.max(1, n ?? 1);

// ──────────────────────────────── Inventory ─────────────────────────────────

/** One row per stock-keeping unit (simple product or variant). */
export async function inventoryList(q: { q?: string; filter?: string; page?: number }, locale: string) {
  const page = pageOf(q.page);
  const { lowStockThreshold } = await getSettings("store");
  const search = q.q ? { OR: [{ searchText: { contains: q.q.toLowerCase() } }, { sku: { contains: q.q, mode: "insensitive" as const } }, { variants: { some: { sku: { contains: q.q, mode: "insensitive" as const } } } }] } : {};
  const products = await db.product.findMany({
    where: { trackInventory: true, status: { not: "ARCHIVED" }, ...search },
    orderBy: { stock: "asc" },
    include: { images: { take: 1, orderBy: { position: "asc" }, include: { media: { select: { url: true } } } }, variants: { where: { isActive: true }, include: { options: { include: { value: { select: { label: true } } } } }, orderBy: { position: "asc" } } },
  });
  type Row = { id: string; productId: string; variantId: string | null; name: string; variant: string | null; sku: string | null; image: string | null; stock: number; threshold: number; state: "out" | "low" | "ok" };
  const rows: Row[] = [];
  for (const p of products) {
    const threshold = p.lowStockThreshold ?? lowStockThreshold;
    const state = (s: number) => (s <= 0 ? "out" : s <= threshold ? "low" : "ok") as Row["state"];
    if (p.type === "VARIABLE" && p.variants.length) {
      for (const v of p.variants) rows.push({ id: v.id, productId: p.id, variantId: v.id, name: t(p.name, locale), variant: v.options.map((o) => t(o.value.label, locale)).join(" · "), sku: v.sku, image: p.images[0]?.media.url ?? null, stock: v.stock, threshold, state: state(v.stock) });
    } else rows.push({ id: p.id, productId: p.id, variantId: null, name: t(p.name, locale), variant: null, sku: p.sku, image: p.images[0]?.media.url ?? null, stock: p.stock, threshold, state: state(p.stock) });
  }
  const filtered = rows.filter((r) => (q.filter === "low" ? r.state === "low" : q.filter === "out" ? r.state === "out" : true)).sort((a, b) => a.stock - b.stock);
  const counts = { all: rows.length, low: rows.filter((r) => r.state === "low").length, out: rows.filter((r) => r.state === "out").length };
  return { rows: filtered.slice((page - 1) * PAGE, page * PAGE), total: filtered.length, page, pageCount: Math.max(1, Math.ceil(filtered.length / PAGE)), counts };
}

export async function recentMovements(locale: string) {
  const rows = await db.inventoryMovement.findMany({ orderBy: { createdAt: "desc" }, take: 25, include: { product: { select: { name: true } }, variant: { select: { sku: true } }, user: { select: { name: true } } } });
  return rows.map((m) => ({ id: m.id, product: t(m.product.name, locale), variant: m.variant?.sku ?? null, delta: m.delta, balance: m.balanceAfter, reason: m.reason, note: m.note, user: m.user?.name ?? null, at: m.createdAt.toISOString() }));
}

// ───────────────────────────────── Reviews ──────────────────────────────────

export async function reviewList(q: { status?: string; q?: string; page?: number }, locale: string) {
  const page = pageOf(q.page);
  const where: Prisma.ReviewWhereInput = {
    ...(q.status ? { status: q.status as "PENDING" } : {}),
    ...(q.q ? { OR: [{ body: { contains: q.q, mode: "insensitive" } }, { authorName: { contains: q.q, mode: "insensitive" } }, { title: { contains: q.q, mode: "insensitive" } }] } : {}),
  };
  const [rows, total, counts] = await Promise.all([
    db.review.findMany({ where, orderBy: [{ reportCount: "desc" }, { createdAt: "desc" }], skip: (page - 1) * PAGE, take: PAGE, include: { product: { select: { id: true, slug: true, name: true, images: { take: 1, include: { media: { select: { url: true } } } } } }, user: { select: { id: true, email: true } } } }),
    db.review.count({ where }),
    db.review.groupBy({ by: ["status"], _count: { _all: true } }),
  ]);
  return {
    rows: rows.map((r) => ({
      id: r.id,
      rating: r.rating,
      title: r.title,
      body: r.body,
      author: r.authorName,
      userId: r.user?.id ?? null,
      verified: r.isVerifiedPurchase,
      status: r.status,
      reports: r.reportCount,
      helpful: r.helpfulCount,
      reply: r.adminReply,
      locale: r.locale,
      createdAt: r.createdAt.toISOString(),
      product: { id: r.product.id, slug: r.product.slug, name: t(r.product.name, locale), image: r.product.images[0]?.media.url ?? null },
    })),
    total,
    page,
    pageCount: Math.max(1, Math.ceil(total / PAGE)),
    counts: Object.fromEntries(counts.map((c) => [c.status, c._count._all])) as Record<string, number>,
  };
}

/** Keep product rating aggregates in sync with approved reviews only. */
async function refreshRating(productId: string) {
  const agg = await db.review.aggregate({ where: { productId, status: "APPROVED" }, _avg: { rating: true }, _count: { _all: true } });
  await db.product.update({ where: { id: productId }, data: { ratingAvg: Math.round((agg._avg.rating ?? 0) * 10) / 10, ratingCount: agg._count._all } });
}

export async function moderateReview(id: string, input: { status?: "APPROVED" | "REJECTED" | "SPAM" | "PENDING"; reply?: string | null; delete?: boolean }, staff: CurrentStaff) {
  const r = await db.review.findUnique({ where: { id } });
  if (!r) throw Errors.notFound();
  if (input.delete) {
    await db.review.delete({ where: { id } });
  } else {
    await db.review.update({
      where: { id },
      data: {
        ...(input.status ? { status: input.status } : {}),
        ...(input.reply !== undefined ? { adminReply: input.reply?.trim() || null, repliedAt: input.reply?.trim() ? new Date() : null } : {}),
      },
    });
  }
  await refreshRating(r.productId);
  await audit({ actor: staff, action: input.delete ? "review.deleted" : "review.moderated", entityType: "review", entityId: id, changes: { status: input.status, replied: Boolean(input.reply) } });
}

// ──────────────────────────────── Customers ─────────────────────────────────

export async function customerList(q: { q?: string; status?: string; sort?: string; page?: number }, staff: CurrentStaff) {
  const page = pageOf(q.page);
  const pii = hasPermission(staff.permissions, "customers.pii");
  const where: Prisma.UserWhereInput = {
    type: "CUSTOMER",
    ...(q.status === "suspended" ? { status: "SUSPENDED" } : q.status === "subscribed" ? { marketingOptIn: true } : {}),
    ...(q.q ? { OR: [{ name: { contains: q.q, mode: "insensitive" } }, { email: { contains: q.q, mode: "insensitive" } }, { phone: { contains: q.q.replace(/\s/g, "") } }] } : {}),
  };
  const [rows, total] = await Promise.all([
    db.user.findMany({ where, orderBy: q.sort === "name" ? { name: "asc" } : { createdAt: "desc" }, skip: (page - 1) * PAGE, take: PAGE, select: { id: true, name: true, email: true, phone: true, status: true, createdAt: true, lastLoginAt: true, pointsBalance: true, marketingOptIn: true } }),
    db.user.count({ where }),
  ]);
  const stats = await db.order.groupBy({ by: ["userId"], where: { userId: { in: rows.map((r) => r.id) }, status: { countsAsSale: true } }, _sum: { total: true }, _count: { _all: true }, _max: { placedAt: true } });
  const byUser = new Map(stats.map((s) => [s.userId, s]));
  return {
    rows: rows.map((u) => ({
      id: u.id,
      name: u.name,
      email: pii ? u.email : u.email.replace(/^(.{2}).*(@.*)$/, "$1•••$2"),
      phone: pii ? u.phone : null,
      status: u.status,
      createdAt: u.createdAt.toISOString(),
      lastLoginAt: u.lastLoginAt?.toISOString() ?? null,
        subscribed: u.marketingOptIn,
      orders: byUser.get(u.id)?._count._all ?? 0,
      spent: byUser.get(u.id)?._sum.total ?? 0,
      lastOrder: byUser.get(u.id)?._max.placedAt?.toISOString() ?? null,
    })),
    total,
    page,
    pageCount: Math.max(1, Math.ceil(total / PAGE)),
  };
}

export async function customerDetail(id: string, staff: CurrentStaff, locale: string) {
  const u = await db.user.findFirst({
    where: { id, type: "CUSTOMER" },
    include: {
      addresses: { orderBy: { isDefault: "desc" } },
      orders: { orderBy: { placedAt: "desc" }, take: 20, include: { status: true, _count: { select: { items: true } } } },
      reviews: { orderBy: { createdAt: "desc" }, take: 10, include: { product: { select: { name: true } } } },
      pointsTransactions: { orderBy: { createdAt: "desc" }, take: 20 },
      wishlist: { take: 12, include: { product: { select: { id: true, name: true } } } },
      cart: { include: { items: { include: { product: { select: { name: true } } } } } },
      conversations: { orderBy: { createdAt: "desc" }, take: 10 },
    },
  });
  if (!u) return null;
  const pii = hasPermission(staff.permissions, "customers.pii");
  const agg = await db.order.aggregate({ where: { userId: id, status: { countsAsSale: true } }, _sum: { total: true }, _count: { _all: true } });
  return {
    id: u.id,
    name: u.name,
    email: pii ? u.email : u.email.replace(/^(.{2}).*(@.*)$/, "$1•••$2"),
    phone: pii ? u.phone : null,
    pii,
    status: u.status,
    locale: u.locale,
    marketingOptIn: u.marketingOptIn,
    createdAt: u.createdAt.toISOString(),
    lastLoginAt: u.lastLoginAt?.toISOString() ?? null,
    stats: { orders: agg._count._all, spent: agg._sum.total ?? 0, aov: agg._count._all ? Math.round((agg._sum.total ?? 0) / agg._count._all) : 0 },
    addresses: pii ? u.addresses.map((a) => ({ id: a.id, label: a.label, text: [a.fullName, a.line1, a.line2, a.area, a.city, a.country, a.phone].filter(Boolean).join(", "), isDefault: a.isDefault })) : [],
    orders: u.orders.map((o) => ({ id: o.id, number: o.number, total: o.total, items: o._count.items, status: { label: t(o.status.label, locale), color: o.status.color }, placedAt: o.placedAt.toISOString() })),
    reviews: u.reviews.map((r) => ({ id: r.id, rating: r.rating, body: r.body, status: r.status, product: t(r.product.name, locale) })),
    points: { balance: u.pointsBalance, history: u.pointsTransactions.map((p) => ({ id: p.id, delta: p.delta, reason: p.reason, note: p.note, at: p.createdAt.toISOString() })) },
    wishlist: u.wishlist.map((w) => ({ id: w.product.id, name: t(w.product.name, locale) })),
    cart: u.cart?.items.map((i) => ({ name: t(i.product.name, locale), quantity: i.quantity })) ?? [],
    conversations: u.conversations.map((c) => ({ id: c.id, subject: c.subject, status: c.status, at: c.createdAt.toISOString() })),
  };
}

export type CustomerDetail = NonNullable<Awaited<ReturnType<typeof customerDetail>>>;

export async function setCustomerStatus(id: string, status: "ACTIVE" | "SUSPENDED", staff: CurrentStaff) {
  await db.user.update({ where: { id, type: "CUSTOMER" } as Prisma.UserWhereUniqueInput, data: { status } });
  if (status === "SUSPENDED") await revokeAllSessions(id);
  await audit({ actor: staff, action: `customer.${status === "SUSPENDED" ? "suspended" : "reactivated"}`, entityType: "user", entityId: id });
}

export async function adjustPoints(id: string, delta: number, note: string, staff: CurrentStaff) {
  await db.$transaction(async (tx) => {
    const u = await tx.user.findUniqueOrThrow({ where: { id } });
    const next = Math.max(0, u.pointsBalance + delta);
    await tx.user.update({ where: { id }, data: { pointsBalance: next } });
    await tx.pointsTransaction.create({ data: { userId: id, delta: next - u.pointsBalance, balanceAfter: next, reason: "ADJUSTMENT", note } });
  });
  await audit({ actor: staff, action: "customer.points_adjusted", entityType: "user", entityId: id, changes: { delta, note } });
}

// ───────────────────────────────── Coupons ──────────────────────────────────

export async function couponList(locale: string) {
  const [rows, categories, brands] = await Promise.all([
    db.coupon.findMany({ orderBy: { createdAt: "desc" } }),
    db.category.findMany({ select: { id: true, name: true, path: true, position: true, depth: true } }),
    db.brand.findMany({ select: { id: true, name: true } }),
  ]);
  const now = new Date();
  const productIds = [...new Set(rows.filter((c) => c.scope === "PRODUCTS").flatMap((c) => c.targetIds))];
  const products = productIds.length
    ? await db.product.findMany({ where: { id: { in: productIds } }, select: { id: true, name: true, images: { take: 1, orderBy: { position: "asc" }, select: { media: { select: { url: true } } } } } })
    : [];
  return {
    products: products.map((p) => ({ id: p.id, name: t(p.name, locale), image: p.images[0]?.media.url ?? null })),
    rows: rows.map((c) => ({
      id: c.id,
      code: c.code,
      name: c.name as Record<string, string>,
      label: t(c.name, locale) || c.code || "",
      description: c.description as Record<string, string>,
      type: c.type,
      value: c.value,
      maxDiscount: c.maxDiscount,
      minSubtotal: c.minSubtotal,
      scope: c.scope,
      targetIds: c.targetIds,
      excludeSaleItems: c.excludeSaleItems,
      firstOrderOnly: c.firstOrderOnly,
      allowedEmails: c.allowedEmails,
      usageLimit: c.usageLimit,
      usageLimitPerCustomer: c.usageLimitPerCustomer,
      usedCount: c.usedCount,
      startsAt: c.startsAt?.toISOString() ?? null,
      endsAt: c.endsAt?.toISOString() ?? null,
      isActive: c.isActive,
      isAutomatic: c.isAutomatic,
      state: !c.isActive ? "inactive" : c.endsAt && c.endsAt < now ? "expired" : c.startsAt && c.startsAt > now ? "scheduled" : c.usageLimit != null && c.usedCount >= c.usageLimit ? "exhausted" : "active",
    })),
    categories: (await import("./products")).sortTree(categories).map((c) => ({ id: c.id, name: `${"— ".repeat(c.depth)}${t(c.name, locale)}` })),
    brands: brands.map((b) => ({ id: b.id, name: t(b.name, locale) })),
  };
}

export const couponSchema = z
  .object({
    code: z.string().trim().toUpperCase().regex(/^[A-Z0-9_-]{3,40}$/).nullable(),
    name: localized({ max: 120 }),
    description: localized({ max: 500 }),
    type: z.enum(["PERCENT", "FIXED", "FREE_SHIPPING"]),
    value: z.number().int().min(0),
    maxDiscount: z.number().int().min(0).nullable(),
    minSubtotal: z.number().int().min(0).nullable(),
    scope: z.enum(["ALL", "PRODUCTS", "CATEGORIES", "BRANDS"]),
    targetIds: z.array(z.string()).max(200),
    excludeSaleItems: z.boolean(),
    firstOrderOnly: z.boolean(),
    allowedEmails: z.array(z.string().email()).max(500),
    usageLimit: z.number().int().min(1).nullable(),
    usageLimitPerCustomer: z.number().int().min(1).nullable(),
    startsAt: z.string().datetime().nullable(),
    endsAt: z.string().datetime().nullable(),
    isActive: z.boolean(),
    isAutomatic: z.boolean(),
  })
  .superRefine((c, ctx) => {
    if (!c.isAutomatic && !c.code) ctx.addIssue({ code: "custom", path: ["code"], message: "required" });
    if (c.type === "PERCENT" && (c.value < 1 || c.value > 10_000)) ctx.addIssue({ code: "custom", path: ["value"], message: "percent_range" });
    if (c.type === "FIXED" && c.value < 1) ctx.addIssue({ code: "custom", path: ["value"], message: "required" });
    if (c.scope !== "ALL" && !c.targetIds.length) ctx.addIssue({ code: "custom", path: ["targetIds"], message: "required" });
    if (c.startsAt && c.endsAt && c.startsAt >= c.endsAt) ctx.addIssue({ code: "custom", path: ["endsAt"], message: "end_before_start" });
  });

export async function saveCoupon(id: string | null, raw: unknown, staff: CurrentStaff) {
  const p = couponSchema.parse(raw);
  const code = p.isAutomatic ? null : p.code;
  if (code && (await db.coupon.findFirst({ where: { code, ...(id ? { id: { not: id } } : {}) } }))) throw Errors.invalid({ code: ["code_taken"] });
  const data = { ...p, code, startsAt: p.startsAt ? new Date(p.startsAt) : null, endsAt: p.endsAt ? new Date(p.endsAt) : null, value: p.type === "FREE_SHIPPING" ? 0 : p.value };
  const c = id ? await db.coupon.update({ where: { id }, data }) : await db.coupon.create({ data });
  await audit({ actor: staff, action: id ? "coupon.updated" : "coupon.created", entityType: "coupon", entityId: c.id, summary: code ?? t(p.name, "en") });
  return { id: c.id };
}

export async function deleteCoupon(id: string, staff: CurrentStaff) {
  const c = await db.coupon.delete({ where: { id } });
  await audit({ actor: staff, action: "coupon.deleted", entityType: "coupon", entityId: id, summary: c.code ?? "" });
}

// ──────────────────────────────── Newsletter ────────────────────────────────

export async function subscriberList(q: { q?: string; status?: string; page?: number }) {
  const page = pageOf(q.page);
  const where: Prisma.NewsletterSubscriberWhereInput = { ...(q.status ? { status: q.status } : {}), ...(q.q ? { email: { contains: q.q, mode: "insensitive" } } : {}) };
  const [rows, total, counts] = await Promise.all([
    db.newsletterSubscriber.findMany({ where, orderBy: { createdAt: "desc" }, skip: (page - 1) * PAGE, take: PAGE }),
    db.newsletterSubscriber.count({ where }),
    db.newsletterSubscriber.groupBy({ by: ["status"], _count: { _all: true } }),
  ]);
  return {
    rows: rows.map((s) => ({ id: s.id, email: s.email, locale: s.locale, status: s.status, source: s.source, createdAt: s.createdAt.toISOString() })),
    total,
    page,
    pageCount: Math.max(1, Math.ceil(total / PAGE)),
    counts: Object.fromEntries(counts.map((c) => [c.status, c._count._all])) as Record<string, number>,
  };
}

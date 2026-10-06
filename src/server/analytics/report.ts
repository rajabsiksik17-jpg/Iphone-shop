import "server-only";
import { db } from "../db";
import { getSettings } from "../settings/service";
import { t } from "@/lib/i18n-text";

export type RangeKey = "today" | "yesterday" | "7d" | "30d" | "90d" | "month" | "lastMonth" | "custom";

/** Resolve a named range into [from, to) in the store's timezone. */
export async function resolveRange(key: RangeKey, from?: string, to?: string) {
  const { timezone } = await getSettings("localization");
  // Midnight "today" in the store timezone, expressed as a UTC Date.
  const now = new Date();
  const local = new Date(now.toLocaleString("en-US", { timeZone: timezone }));
  const offset = local.getTime() - now.getTime();
  const startOfDay = (d: Date) => {
    const l = new Date(d.getTime() + offset);
    l.setHours(0, 0, 0, 0);
    return new Date(l.getTime() - offset);
  };
  const today = startOfDay(now);
  const day = 86_400_000;
  let start: Date;
  let end = new Date(today.getTime() + day);
  switch (key) {
    case "today":
      start = today;
      break;
    case "yesterday":
      start = new Date(today.getTime() - day);
      end = today;
      break;
    case "7d":
      start = new Date(today.getTime() - 6 * day);
      break;
    case "90d":
      start = new Date(today.getTime() - 89 * day);
      break;
    case "month": {
      const l = new Date(today.getTime() + offset);
      start = new Date(new Date(l.getFullYear(), l.getMonth(), 1).getTime() - offset);
      break;
    }
    case "lastMonth": {
      const l = new Date(today.getTime() + offset);
      start = new Date(new Date(l.getFullYear(), l.getMonth() - 1, 1).getTime() - offset);
      end = new Date(new Date(l.getFullYear(), l.getMonth(), 1).getTime() - offset);
      break;
    }
    case "custom": {
      const f = from ? new Date(`${from}T00:00:00`) : new Date(today.getTime() - 29 * day);
      const tt = to ? new Date(`${to}T00:00:00`) : today;
      start = new Date(f.getTime() - offset);
      end = new Date(tt.getTime() - offset + day);
      break;
    }
    default:
      start = new Date(today.getTime() - 29 * day);
  }
  const length = end.getTime() - start.getTime();
  return { start, end, prevStart: new Date(start.getTime() - length), prevEnd: start, timezone, days: Math.max(1, Math.round(length / day)) };
}

async function saleStatuses() {
  return (await db.orderStatus.findMany({ where: { countsAsSale: true }, select: { key: true } })).map((s) => s.key);
}

async function kpis(start: Date, end: Date, statuses: string[]) {
  const where = { placedAt: { gte: start, lt: end }, statusKey: { in: statuses } };
  const [agg, customers, visitors, purchases] = await Promise.all([
    db.order.aggregate({ where, _sum: { total: true, refundedTotal: true, shippingTotal: true, taxTotal: true }, _count: { _all: true } }),
    db.user.count({ where: { type: "CUSTOMER", createdAt: { gte: start, lt: end } } }),
    db.analyticsEvent.findMany({ where: { createdAt: { gte: start, lt: end }, type: "PAGE_VIEW" }, distinct: ["visitorId"], select: { visitorId: true } }).then((r) => r.length),
    db.order.count({ where: { placedAt: { gte: start, lt: end } } }),
  ]);
  const revenue = agg._sum.total ?? 0;
  const orders = agg._count._all;
  return {
    revenue,
    netRevenue: revenue - (agg._sum.refundedTotal ?? 0) - (agg._sum.shippingTotal ?? 0) - (agg._sum.taxTotal ?? 0),
    orders,
    aov: orders ? Math.round(revenue / orders) : 0,
    customers,
    visitors,
    conversion: visitors ? (purchases / visitors) * 100 : 0,
  };
}

const pct = (cur: number, prev: number) => (prev ? ((cur - prev) / prev) * 100 : cur ? 100 : 0);

export async function dashboardReport(key: RangeKey, locale: string, custom?: { from?: string; to?: string }) {
  const r = await resolveRange(key, custom?.from, custom?.to);
  const statuses = await saleStatuses();
  const [cur, prev] = await Promise.all([kpis(r.start, r.end, statuses), kpis(r.prevStart, r.prevEnd, statuses)]);

  // Daily series bucketed in the store timezone (hourly for single-day ranges).
  const bucket = r.days <= 1 ? "hour" : "day";
  const series = await db.$queryRaw<{ bucket: Date; revenue: bigint; orders: bigint }[]>`
    SELECT date_trunc(${bucket}, "placedAt" AT TIME ZONE ${r.timezone}) AS bucket,
           COALESCE(SUM(total) FILTER (WHERE "statusKey" = ANY(${statuses})), 0) AS revenue,
           COUNT(*) AS orders
    FROM "Order" WHERE "placedAt" >= ${r.start} AND "placedAt" < ${r.end}
    GROUP BY 1 ORDER BY 1`;
  const prevSeries = await db.$queryRaw<{ bucket: Date; revenue: bigint }[]>`
    SELECT date_trunc(${bucket}, "placedAt" AT TIME ZONE ${r.timezone}) AS bucket,
           COALESCE(SUM(total) FILTER (WHERE "statusKey" = ANY(${statuses})), 0) AS revenue
    FROM "Order" WHERE "placedAt" >= ${r.prevStart} AND "placedAt" < ${r.prevEnd}
    GROUP BY 1 ORDER BY 1`;

  // Fill gaps so charts have a point for every bucket.
  const step = bucket === "hour" ? 3_600_000 : 86_400_000;
  const points: { label: string; revenue: number; orders: number; previous: number }[] = [];
  const startLocal = new Date(new Date(r.start).toLocaleString("en-US", { timeZone: r.timezone }));
  const count = bucket === "hour" ? 24 : r.days;
  const byKey = new Map(series.map((s) => [new Date(s.bucket).getTime(), s]));
  const prevByIdx = prevSeries.map((s) => Number(s.revenue));
  for (let i = 0; i < count; i++) {
    const ts = new Date(startLocal.getTime() + i * step);
    const k = new Date(Date.UTC(ts.getFullYear(), ts.getMonth(), ts.getDate(), bucket === "hour" ? ts.getHours() : 0)).getTime();
    const row = byKey.get(k);
    points.push({
      label: bucket === "hour" ? `${String(ts.getHours()).padStart(2, "0")}:00` : ts.toISOString().slice(0, 10),
      revenue: row ? Number(row.revenue) : 0,
      orders: row ? Number(row.orders) : 0,
      previous: prevByIdx[i] ?? 0,
    });
  }

  const [topProducts, topCategories, topBrands, funnel, recentOrders, recentCustomers, lowStock, byMethod] = await Promise.all([
    db.$queryRaw<{ productId: string; name: unknown; image: string | null; units: bigint; revenue: bigint }[]>`
      SELECT i."productId", MAX(i.name::text)::json AS name, MAX(i."imageUrl") AS image, SUM(i.quantity) AS units, SUM(i.total) AS revenue
      FROM "OrderItem" i JOIN "Order" o ON o.id = i."orderId"
      WHERE o."placedAt" >= ${r.start} AND o."placedAt" < ${r.end} AND o."statusKey" = ANY(${statuses}) AND i."productId" IS NOT NULL
      GROUP BY i."productId" ORDER BY revenue DESC LIMIT 6`,
    db.$queryRaw<{ id: string; name: unknown; revenue: bigint }[]>`
      SELECT root.id, root.name, SUM(i.total) AS revenue
      FROM "OrderItem" i JOIN "Order" o ON o.id = i."orderId"
      JOIN "ProductCategory" pc ON pc."productId" = i."productId" AND pc."isPrimary" = true
      JOIN "Category" c ON c.id = pc."categoryId"
      JOIN "Category" root ON root.id = split_part(trim(both '/' from c.path), '/', 1)
      WHERE o."placedAt" >= ${r.start} AND o."placedAt" < ${r.end} AND o."statusKey" = ANY(${statuses})
      GROUP BY root.id, root.name ORDER BY revenue DESC LIMIT 6`,
    db.$queryRaw<{ id: string; name: unknown; revenue: bigint }[]>`
      SELECT b.id, b.name, SUM(i.total) AS revenue
      FROM "OrderItem" i JOIN "Order" o ON o.id = i."orderId" JOIN "Product" p ON p.id = i."productId" JOIN "Brand" b ON b.id = p."brandId"
      WHERE o."placedAt" >= ${r.start} AND o."placedAt" < ${r.end} AND o."statusKey" = ANY(${statuses})
      GROUP BY b.id, b.name ORDER BY revenue DESC LIMIT 6`,
    db.$queryRaw<{ type: string; n: bigint }[]>`
      SELECT type, COUNT(DISTINCT "visitorId") AS n FROM "AnalyticsEvent"
      WHERE "createdAt" >= ${r.start} AND "createdAt" < ${r.end} GROUP BY type`,
    db.order.findMany({ orderBy: { placedAt: "desc" }, take: 7, include: { status: true } }),
    db.user.findMany({ where: { type: "CUSTOMER" }, orderBy: { createdAt: "desc" }, take: 6, select: { id: true, name: true, email: true, createdAt: true, _count: { select: { orders: true } } } }),
    db.product.findMany({ where: { status: "ACTIVE", trackInventory: true, stockStatus: { in: ["LOW_STOCK", "OUT_OF_STOCK"] } }, orderBy: { stock: "asc" }, take: 6, select: { id: true, name: true, stock: true, stockStatus: true, images: { take: 1, select: { media: { select: { url: true } } } } } }),
    db.order.groupBy({ by: ["paymentMethod"], where: { placedAt: { gte: r.start, lt: r.end }, statusKey: { in: statuses } }, _sum: { total: true }, _count: { _all: true } }),
  ]);
  const f = Object.fromEntries(funnel.map((x) => [x.type, Number(x.n)]));

  return {
    range: { start: r.start.toISOString(), end: r.end.toISOString(), days: r.days, bucket },
    kpis: {
      revenue: { value: cur.revenue, delta: pct(cur.revenue, prev.revenue) },
      netRevenue: { value: cur.netRevenue, delta: pct(cur.netRevenue, prev.netRevenue) },
      orders: { value: cur.orders, delta: pct(cur.orders, prev.orders) },
      aov: { value: cur.aov, delta: pct(cur.aov, prev.aov) },
      customers: { value: cur.customers, delta: pct(cur.customers, prev.customers) },
      visitors: { value: cur.visitors, delta: pct(cur.visitors, prev.visitors) },
      conversion: { value: cur.conversion, delta: cur.conversion - prev.conversion },
    },
    series: points,
    topProducts: topProducts.map((p) => ({ id: p.productId, name: t(p.name, locale), image: p.image, units: Number(p.units), revenue: Number(p.revenue) })),
    topCategories: topCategories.map((c) => ({ id: c.id, name: t(c.name, locale), revenue: Number(c.revenue) })),
    topBrands: topBrands.map((b) => ({ id: b.id, name: t(b.name, locale), revenue: Number(b.revenue) })),
    funnel: {
      visitors: f.PAGE_VIEW ?? 0,
      views: f.PRODUCT_VIEW ?? 0,
      carts: f.ADD_TO_CART ?? 0,
      checkouts: f.BEGIN_CHECKOUT ?? 0,
      purchases: f.PURCHASE ?? 0,
    },
    byMethod: byMethod.map((m) => ({ method: m.paymentMethod, revenue: m._sum.total ?? 0, orders: m._count._all })),
    recentOrders: recentOrders.map((o) => ({ id: o.id, number: o.number, customer: o.customerName, total: o.total, status: { label: t(o.status.label, locale), color: o.status.color }, placedAt: o.placedAt.toISOString(), paymentStatus: o.paymentStatus })),
    recentCustomers: recentCustomers.map((c) => ({ id: c.id, name: c.name, email: c.email, createdAt: c.createdAt.toISOString(), orders: c._count.orders })),
    lowStock: lowStock.map((p) => ({ id: p.id, name: t(p.name, locale), stock: p.stock, status: p.stockStatus, image: p.images[0]?.media.url ?? null })),
  };
}

export type DashboardReport = Awaited<ReturnType<typeof dashboardReport>>;

/** Extra analytics for the Analytics page. */
export async function analyticsExtras(key: RangeKey, locale: string, custom?: { from?: string; to?: string }) {
  const r = await resolveRange(key, custom?.from, custom?.to);
  const [devices, referrers, searches, zero, growth, ga, gsc] = await Promise.all([
    db.$queryRaw<{ device: string; n: bigint }[]>`SELECT COALESCE(device,'unknown') device, COUNT(DISTINCT "visitorId") n FROM "AnalyticsEvent" WHERE "createdAt" >= ${r.start} AND "createdAt" < ${r.end} AND type = 'PAGE_VIEW' GROUP BY 1 ORDER BY 2 DESC`,
    db.$queryRaw<{ referrer: string | null; n: bigint }[]>`SELECT referrer, COUNT(DISTINCT "visitorId") n FROM "AnalyticsEvent" WHERE "createdAt" >= ${r.start} AND "createdAt" < ${r.end} AND type = 'PAGE_VIEW' GROUP BY 1 ORDER BY 2 DESC LIMIT 8`,
    db.searchTerm.findMany({ orderBy: { count: "desc" }, take: 10 }),
    db.searchTerm.findMany({ where: { lastResults: 0 }, orderBy: { count: "desc" }, take: 8 }),
    db.$queryRaw<{ bucket: Date; n: bigint }[]>`SELECT date_trunc('day', "createdAt" AT TIME ZONE ${r.timezone}) bucket, COUNT(*) n FROM "User" WHERE type = 'CUSTOMER' AND "createdAt" >= ${r.start} AND "createdAt" < ${r.end} GROUP BY 1 ORDER BY 1`,
    db.integration.findUnique({ where: { key: "google_analytics" }, select: { syncData: true, lastSyncAt: true, isEnabled: true } }),
    db.integration.findUnique({ where: { key: "google_search_console" }, select: { syncData: true, lastSyncAt: true, isEnabled: true } }),
  ]);
  void locale;
  return {
    devices: devices.map((d) => ({ device: d.device, visitors: Number(d.n) })),
    referrers: referrers.map((x) => ({ referrer: x.referrer, visitors: Number(x.n) })),
    searches: searches.map((s) => ({ term: s.term, count: s.count, results: s.lastResults })),
    zeroResults: zero.map((s) => ({ term: s.term, count: s.count })),
    growth: growth.map((g) => ({ date: new Date(g.bucket).toISOString().slice(0, 10), customers: Number(g.n) })),
    ga: ga?.isEnabled && ga.lastSyncAt ? { syncedAt: ga.lastSyncAt.toISOString(), data: ga.syncData as { daily?: { date: string; users: number; sessions: number; purchases: number }[] } } : null,
    gsc: gsc?.isEnabled && gsc.lastSyncAt ? { syncedAt: gsc.lastSyncAt.toISOString(), data: gsc.syncData as { queries?: { key: string; clicks: number; impressions: number; ctr: number; position: number }[]; pages?: { key: string; clicks: number; impressions: number }[] } } : null,
  };
}

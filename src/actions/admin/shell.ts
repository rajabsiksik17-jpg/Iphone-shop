"use server";

import { z } from "zod";
import { db } from "@/server/db";
import { adminCounters, markSeen } from "@/server/admin/counters";
import { realtime } from "@/server/realtime/emitter";
import { adminRun } from "./_base";
import { t } from "@/lib/i18n-text";
import { hasPermission } from "@/config/permissions";

export async function countersAction() {
  return adminRun(null, (staff) => adminCounters(staff), { revalidate: false });
}

export async function markSeenAction(key: "customers") {
  return adminRun(null, (staff) => markSeen(staff, z.enum(["customers"]).parse(key)), { revalidate: false });
}

function visibleTo(permissions: string[]) {
  return permissions.includes("*") ? {} : { permission: { in: permissions } };
}

export async function notificationsAction(opts: { take?: number; unreadOnly?: boolean } = {}) {
  return adminRun(
    null,
    async (staff) => {
      const rows = await db.notification.findMany({
        where: { audience: "STAFF", ...visibleTo([...staff.permissions]), ...(opts.unreadOnly ? { reads: { none: { userId: staff.id } } } : {}) },
        orderBy: { createdAt: "desc" },
        take: Math.min(opts.take ?? 20, 100),
        include: { reads: { where: { userId: staff.id }, select: { readAt: true } } },
      });
      return rows.map((n) => ({ id: n.id, event: n.event, title: n.title as Record<string, string>, body: n.body as Record<string, string>, link: n.link, severity: n.severity, createdAt: n.createdAt.toISOString(), read: n.reads.length > 0 }));
    },
    { revalidate: false },
  );
}

export async function markNotificationsAction(ids: string[] | "all") {
  return adminRun(
    null,
    async (staff) => {
      const targets =
        ids === "all"
          ? await db.notification.findMany({ where: { audience: "STAFF", ...visibleTo([...staff.permissions]), reads: { none: { userId: staff.id } } }, select: { id: true } })
          : await db.notification.findMany({ where: { id: { in: z.array(z.string()).max(200).parse(ids) }, audience: "STAFF" }, select: { id: true } });
      await db.notificationRead.createMany({ data: targets.map((n) => ({ notificationId: n.id, userId: staff.id })), skipDuplicates: true });
      realtime.toUser(staff.id, "counters:invalidate", { keys: ["notifications"] });
    },
    { revalidate: false },
  );
}

export async function setAgentStatusAction(status: "ONLINE" | "AWAY" | "OFFLINE") {
  return adminRun(
    "support.chat",
    async (staff) => {
      await db.user.update({ where: { id: staff.id }, data: { agentStatus: z.enum(["ONLINE", "AWAY", "OFFLINE"]).parse(status) } });
      realtime.toPermission("support.chat", "agents:changed", { userId: staff.id, status });
    },
    { revalidate: false },
  );
}

/** Global ⌘K search across the entities this admin may see. */
export async function adminSearchAction(q: string, locale: string) {
  return adminRun(
    null,
    async (staff) => {
      const term = z.string().trim().max(100).parse(q);
      if (term.length < 2) return [];
      const p = staff.permissions;
      const like = { contains: term, mode: "insensitive" as const };
      const [orders, products, customers, categories, brands, pages] = await Promise.all([
        hasPermission(p, "orders.view") ? db.order.findMany({ where: { OR: [{ number: like }, { email: like }, { customerName: like }, { phone: { contains: term } }] }, take: 5, orderBy: { placedAt: "desc" }, select: { id: true, number: true, customerName: true } }) : [],
        hasPermission(p, "catalog.view") ? db.product.findMany({ where: { OR: [{ searchText: { contains: term.toLowerCase() } }, { sku: like }] }, take: 6, select: { id: true, name: true, sku: true } }) : [],
        hasPermission(p, "customers.view") ? db.user.findMany({ where: { type: "CUSTOMER", OR: [{ name: like }, { email: like }, { phone: { contains: term } }] }, take: 5, select: { id: true, name: true, email: true } }) : [],
        hasPermission(p, "catalog.view") ? db.$queryRaw<{ id: string; name: unknown }[]>`SELECT id, name FROM "Category" WHERE lower(name->>'en') LIKE ${"%" + term.toLowerCase() + "%"} OR name->>'ar' LIKE ${"%" + term + "%"} LIMIT 4` : [],
        hasPermission(p, "catalog.view") ? db.brand.findMany({ where: { slug: { contains: term.toLowerCase() } }, take: 3, select: { id: true, name: true } }) : [],
        hasPermission(p, "content.manage") ? db.page.findMany({ where: { slug: { contains: term.toLowerCase() } }, take: 3, select: { id: true, slug: true, title: true } }) : [],
      ]);
      return [
        ...orders.map((o) => ({ type: "order" as const, id: o.id, label: o.number, sub: o.customerName, href: `/admin/orders/${o.id}` })),
        ...products.map((x) => ({ type: "product" as const, id: x.id, label: t(x.name, locale), sub: x.sku ?? "", href: `/admin/products/${x.id}` })),
        ...customers.map((c) => ({ type: "customer" as const, id: c.id, label: c.name, sub: c.email, href: `/admin/customers/${c.id}` })),
        ...categories.map((c) => ({ type: "category" as const, id: c.id, label: t(c.name, locale), sub: "", href: `/admin/categories?edit=${c.id}` })),
        ...brands.map((b) => ({ type: "brand" as const, id: b.id, label: t(b.name, locale), sub: "", href: `/admin/brands?edit=${b.id}` })),
        ...pages.map((pg) => ({ type: "page" as const, id: pg.id, label: t(pg.title, locale), sub: `/${pg.slug}`, href: `/admin/pages/${pg.slug}` })),
      ];
    },
    { revalidate: false },
  );
}

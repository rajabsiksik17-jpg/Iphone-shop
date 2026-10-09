import "server-only";
import { visibleStaffWhere } from "../auth/protect";
import { z } from "zod";
import { db, Prisma } from "../db";
import { Errors } from "../errors";
import { audit } from "../audit";
import { getSettings } from "../settings/service";
import { realtime } from "../realtime/emitter";
import { messageDTO } from "../chat/service";
import { sendMail } from "../email/mailer";
import { emailLayout, escapeHtml } from "../email/render";
import { hasPermission } from "@/config/permissions";
import { t } from "@/lib/i18n-text";
import type { CurrentStaff } from "../auth/session";

// ──────────────────────────────── Live chat ─────────────────────────────────

const OPEN = ["WAITING", "ASSIGNED", "ACTIVE"] as const;
export type InboxTab = "waiting" | "mine" | "active" | "closed";

export async function chatInbox(staff: CurrentStaff) {
  const select = {
    id: true,
    subject: true,
    status: true,
    guestName: true,
    locale: true,
    createdAt: true,
    lastMessageAt: true,
    agentLastRead: true,
    assignedAgentId: true,
    rating: true,
    customer: { select: { name: true } },
    assignedAgent: { select: { name: true } },
    messages: { orderBy: { createdAt: "desc" as const }, take: 1, select: { body: true, sender: true } },
  } satisfies Prisma.ConversationSelect;
  const [waiting, open, closed, agents] = await Promise.all([
    db.conversation.findMany({ where: { status: "WAITING" }, orderBy: { createdAt: "asc" }, select, take: 100 }),
    db.conversation.findMany({ where: { status: { in: ["ASSIGNED", "ACTIVE"] } }, orderBy: { lastMessageAt: "desc" }, select, take: 200 }),
    db.conversation.findMany({ where: { status: { notIn: [...OPEN] } }, orderBy: { closedAt: "desc" }, select, take: 50 }),
    db.user.findMany({ where: { type: "STAFF", status: "ACTIVE", OR: [{ role: { permissions: { hasSome: ["support.chat", "*"] } } }], ...visibleStaffWhere(staff.permissions) }, select: { id: true, name: true, agentStatus: true }, orderBy: { name: "asc" } }),
  ]);
  const dto = (c: (typeof waiting)[number]) => ({
    id: c.id,
    subject: c.subject,
    status: c.status,
    name: c.customer?.name ?? c.guestName ?? null,
    isGuest: !c.customer,
    locale: c.locale,
    createdAt: c.createdAt.toISOString(),
    lastMessageAt: c.lastMessageAt.toISOString(),
    unread: !c.agentLastRead || c.lastMessageAt > c.agentLastRead,
    assignedAgentId: c.assignedAgentId,
    agent: c.assignedAgent?.name ?? null,
    rating: c.rating,
    preview: c.messages[0] ? { body: c.messages[0].body.slice(0, 120), sender: c.messages[0].sender } : null,
  });
  return {
    waiting: waiting.map(dto),
    mine: open.filter((c) => c.assignedAgentId === staff.id).map(dto),
    active: open.map(dto),
    closed: closed.map(dto),
    agents: agents.map((a) => ({ id: a.id, name: a.name, status: a.agentStatus })),
    me: { id: staff.id, status: (await db.user.findUnique({ where: { id: staff.id }, select: { agentStatus: true } }))?.agentStatus ?? "OFFLINE" },
  };
}
export type ChatInbox = Awaited<ReturnType<typeof chatInbox>>;

export async function chatThread(id: string, staff: CurrentStaff, locale: string) {
  const c = await db.conversation.findUnique({
    where: { id },
    include: {
      messages: { orderBy: { createdAt: "asc" }, take: 500 },
      customer: { select: { id: true, name: true, email: true, phone: true, createdAt: true } },
      assignedAgent: { select: { id: true, name: true } },
    },
  });
  if (!c) return null;
  const pii = hasPermission(staff.permissions, "customers.pii");
  const [orders, cart] = c.customer
    ? await Promise.all([
        db.order.findMany({ where: { userId: c.customer.id }, orderBy: { placedAt: "desc" }, take: 5, select: { id: true, number: true, total: true, placedAt: true, status: { select: { label: true, color: true } } } }),
        db.cart.findFirst({ where: { userId: c.customer.id }, select: { items: { take: 10, select: { quantity: true, product: { select: { name: true } } } } } }),
      ])
    : [[], null];
  return {
    id: c.id,
    subject: c.subject,
    status: c.status,
    locale: c.locale,
    pageUrl: c.pageUrl,
    rating: c.rating,
    createdAt: c.createdAt.toISOString(),
    acceptedAt: c.acceptedAt?.toISOString() ?? null,
    customerLastRead: c.customerLastRead?.toISOString() ?? null,
    agent: c.assignedAgent,
    customer: c.customer
      ? { id: c.customer.id, name: c.customer.name, email: pii ? c.customer.email : null, phone: pii ? c.customer.phone : null, since: c.customer.createdAt.toISOString() }
      : { id: null, name: c.guestName ?? null, email: pii ? c.guestEmail : null, phone: null, since: null },
    orders: orders.map((o) => ({ id: o.id, number: o.number, total: o.total, placedAt: o.placedAt.toISOString(), status: { label: t(o.status.label, locale), color: o.status.color } })),
    cart: cart?.items.map((i) => ({ name: t(i.product.name, locale), quantity: i.quantity })) ?? [],
    messages: c.messages.map(messageDTO),
  };
}
export type ChatThread = NonNullable<Awaited<ReturnType<typeof chatThread>>>;

// ───────────────────────────── Contact messages ─────────────────────────────

const PAGE = 30;
type Reply = { at: string; by: string; body: string; ok: boolean };

export async function contactList(q: { status?: string; q?: string; page?: number }) {
  const page = Math.max(1, q.page ?? 1);
  const statuses = ["NEW", "READ", "REPLIED", "ARCHIVED", "SPAM"] as const;
  const status = statuses.find((s) => s === q.status);
  const where: Prisma.ContactSubmissionWhereInput = {
    ...(status ? { status } : { status: { notIn: ["ARCHIVED", "SPAM"] } }),
    ...(q.q ? { OR: [{ name: { contains: q.q, mode: "insensitive" } }, { email: { contains: q.q, mode: "insensitive" } }, { subject: { contains: q.q, mode: "insensitive" } }, { message: { contains: q.q, mode: "insensitive" } }] } : {}),
  };
  const [rows, total, counts] = await Promise.all([
    db.contactSubmission.findMany({ where, orderBy: { createdAt: "desc" }, skip: (page - 1) * PAGE, take: PAGE }),
    db.contactSubmission.count({ where }),
    db.contactSubmission.groupBy({ by: ["status"], _count: { _all: true } }),
  ]);
  return {
    rows: rows.map((m) => ({ id: m.id, name: m.name, email: m.email, subject: m.subject, preview: m.message.slice(0, 140), status: m.status, createdAt: m.createdAt.toISOString() })),
    total,
    page,
    pageCount: Math.max(1, Math.ceil(total / PAGE)),
    counts: Object.fromEntries(counts.map((c) => [c.status, c._count._all])) as Record<string, number>,
  };
}

export async function contactDetail(id: string, staff: CurrentStaff) {
  const m = await db.contactSubmission.findUnique({ where: { id }, include: { user: { select: { id: true, name: true } } } });
  if (!m) return null;
  // Opening a new message marks it read (and clears the sidebar badge).
  if (m.status === "NEW") {
    await db.contactSubmission.update({ where: { id }, data: { status: "READ" } });
    realtime.invalidateCounters(["messages"]);
  }
  const extra = (m.extra ?? {}) as { orderNumber?: string; replies?: Reply[]; locale?: string };
  const pii = hasPermission(staff.permissions, "customers.pii");
  return {
    id: m.id,
    name: m.name,
    email: pii ? m.email : m.email.replace(/^(.{2}).*(@.*)$/, "$1•••$2"),
    phone: pii ? m.phone : null,
    pii,
    subject: m.subject,
    message: m.message,
    orderNumber: extra.orderNumber ?? null,
    status: m.status === "NEW" ? "READ" : m.status,
    createdAt: m.createdAt.toISOString(),
    customer: m.user,
    replies: extra.replies ?? [],
  };
}
export type ContactDetail = NonNullable<Awaited<ReturnType<typeof contactDetail>>>;

export async function setContactStatus(ids: string[], status: "NEW" | "READ" | "REPLIED" | "ARCHIVED" | "SPAM", staff: CurrentStaff) {
  await db.contactSubmission.updateMany({ where: { id: { in: ids } }, data: { status } });
  realtime.invalidateCounters(["messages"]);
  await audit({ actor: staff, action: "message.status", summary: `${ids.length} → ${status}` });
}

export const replySchema = z.object({ subject: z.string().trim().min(1).max(200), body: z.string().trim().min(1).max(10_000) });

/** Email a reply to the sender (via the configured SMTP) and keep it on the thread. */
export async function replyToContact(id: string, raw: unknown, staff: CurrentStaff) {
  const p = replySchema.parse(raw);
  const m = await db.contactSubmission.findUnique({ where: { id } });
  if (!m) throw Errors.notFound("message");
  const [store, email] = await Promise.all([getSettings("store"), getSettings("email")]);
  const extra = (m.extra ?? {}) as { replies?: Reply[]; locale?: string };
  const dir = extra.locale === "en" ? "ltr" : /[؀-ۿ]/.test(m.message) ? "rtl" : "ltr";
  const quoted = `<blockquote style="margin:24px 0 0;padding:12px 16px;border-inline-start:3px solid #e5e7eb;color:#6b7280">${escapeHtml(m.message).replace(/\n/g, "<br>")}</blockquote>`;
  const html = emailLayout({
    dir,
    storeName: t(store.name, dir === "rtl" ? "ar" : "en"),
    logoUrl: store.logoUrl ? new URL(store.logoUrl, process.env.APP_URL ?? "http://localhost:3000").toString() : undefined,
    accent: email.branding.accentColor,
    body: `${escapeHtml(p.body).replace(/\n/g, "<br>")}${quoted}`,
    footer: escapeHtml(t(email.branding.footer, dir === "rtl" ? "ar" : "en") || t(store.name, dir === "rtl" ? "ar" : "en")),
  });
  const res = await sendMail({ to: m.email, subject: p.subject, html, text: p.body, template: "contact_reply", userId: m.userId ?? undefined, replyTo: email.smtp.replyTo || undefined });
  const replies: Reply[] = [...(extra.replies ?? []), { at: new Date().toISOString(), by: staff.name, body: p.body, ok: res.ok }];
  await db.contactSubmission.update({ where: { id }, data: { extra: { ...extra, replies } as Prisma.InputJsonValue, ...(res.ok ? { status: "REPLIED" } : {}) } });
  realtime.invalidateCounters(["messages"]);
  await audit({ actor: staff, action: "message.replied", entityType: "contact", entityId: id, summary: res.ok ? `Reply sent to ${m.email}` : `Reply failed: ${res.code}` });
  if (!res.ok) throw Errors.conflict(`mail_${res.code}`);
}

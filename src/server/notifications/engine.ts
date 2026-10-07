import "server-only";
import { paymentMethodTitle } from "../integrations/registry";
import { db } from "../db";
import { env } from "../env";
import { logger } from "../logger";
import { on, isRegistered, type DomainEvents } from "../events/bus";
import { realtime } from "../realtime/emitter";
import { getSettings } from "../settings/service";
import { sendTemplate } from "../email/mailer";
import { escapeHtml } from "../email/render";
import { formatBase } from "../commerce/currency";
import { activeIntegration } from "../integrations/service";
import { sendWhatsAppTemplate } from "../integrations/providers/whatsapp";
import { t, type LocalizedText } from "@/lib/i18n-text";
import type { NotificationEventKey } from "../settings/schemas";
import type { StaffMessage } from "./types";
import { STAFF_CHANNELS } from "./channels";

/**
 *            DomainEvent
 *                 │
 *        ┌────────┴────────┐
 *   staff builders    customer handlers
 *        │                 │
 *  rules (settings)   preferences
 *        │
 *  ┌─────┼──────────┐
 * inApp email   whatsapp   (+ realtime counters)
 */
async function dispatchStaff(message: StaffMessage) {
  const rules = (await getSettings("notifications")).staff;
  const rule = rules[message.event as keyof typeof rules];
  if (!rule) return;
  const results = await Promise.all(
    STAFF_CHANNELS.filter((c) => rule[c.key]).map((c) =>
      c.deliver(message).catch((e) => ({ channel: c.key, ok: false, error: String(e) })),
    ),
  );
  // Counters must update even if the in-app channel is switched off.
  if (!rule.inApp && message.counters?.length) realtime.invalidateCounters(message.counters);
  for (const r of results) if (!r.ok && !("skipped" in r && r.skipped)) logger.warn("notifications", `${message.event} via ${r.channel} failed`, { error: r.error });
}

// ─────────────────────────────── Builders ───────────────────────────────────

const L = (en: string, ar: string): LocalizedText => ({ en, ar });

async function orderSummary(orderId: string) {
  return db.order.findUnique({
    where: { id: orderId },
    include: { items: true, status: true, user: { select: { id: true, locale: true, preferences: true } } },
  });
}

type Builder<E extends keyof DomainEvents> = (p: DomainEvents[E]) => Promise<StaffMessage | null>;

const builders: { [E in NotificationEventKey]?: Builder<E> } = {
  async ORDER_CREATED({ orderId }) {
    const o = await orderSummary(orderId);
    if (!o) return null;
    const [en, ar] = await Promise.all([formatBase(o.total, "en"), formatBase(o.total, "ar")]);
    return {
      event: "ORDER_CREATED",
      permission: "orders.view",
      title: L(`New order ${o.number}`, `طلب جديد ${o.number}`),
      body: L(`${o.customerName} · ${o.items.length} item(s) · ${en}`, `${o.customerName} · ${o.items.length} منتج · ${ar}`),
      link: `/admin/orders/${o.id}`,
      entityType: "order",
      entityId: o.id,
      severity: "SUCCESS",
      counters: ["orders"],
    };
  },
  async ORDER_PAID({ orderId }) {
    const o = await orderSummary(orderId);
    if (!o) return null;
    const amount = await formatBase(o.total, "en");
    return {
      event: "ORDER_PAID",
      permission: "orders.view",
      title: L(`Payment received · ${o.number}`, `تم استلام الدفعة · ${o.number}`),
      body: L(`${amount} via ${paymentMethodTitle(o.paymentMethod, null, "en")}`, `${await formatBase(o.total, "ar")} عبر ${paymentMethodTitle(o.paymentMethod, null, "ar")}`),
      link: `/admin/orders/${o.id}`,
      entityType: "order",
      entityId: o.id,
      severity: "SUCCESS",
      counters: ["orders"],
    };
  },
  async ORDER_STATUS_CHANGED({ orderId, to }) {
    const o = await orderSummary(orderId);
    if (!o) return null;
    return {
      event: "ORDER_STATUS_CHANGED",
      permission: "orders.view",
      title: L(`Order ${o.number} → ${t(o.status.label, "en")}`, `الطلب ${o.number} ← ${t(o.status.label, "ar")}`),
      body: L(`Status changed to ${to}`, `تم تغيير الحالة`),
      link: `/admin/orders/${o.id}`,
      entityType: "order",
      entityId: o.id,
      severity: "INFO",
      counters: ["orders"],
    };
  },
  async PAYMENT_FAILED({ orderId, provider, message }) {
    const o = await db.order.findUnique({ where: { id: orderId } });
    return {
      event: "PAYMENT_FAILED",
      permission: "orders.view",
      title: L(`Payment failed · ${o?.number ?? ""}`, `فشل الدفع · ${o?.number ?? ""}`),
      body: L(`${provider}: ${message}`, `${provider}: ${message}`),
      link: o ? `/admin/orders/${o.id}` : "/admin/orders",
      entityType: "order",
      entityId: orderId,
      severity: "CRITICAL",
    };
  },
  async USER_REGISTERED({ userId }) {
    const u = await db.user.findUnique({ where: { id: userId } });
    if (!u) return null;
    return {
      event: "USER_REGISTERED",
      permission: "customers.view",
      title: L("New customer", "عميل جديد"),
      body: L(`${u.name} created an account`, `قام ${u.name} بإنشاء حساب`),
      link: `/admin/customers/${u.id}`,
      entityType: "user",
      entityId: u.id,
      severity: "INFO",
      counters: ["customers"],
    };
  },
  async REVIEW_CREATED({ reviewId }) {
    const r = await db.review.findUnique({ where: { id: reviewId }, include: { product: { select: { name: true } } } });
    if (!r) return null;
    return {
      event: "REVIEW_CREATED",
      permission: "reviews.moderate",
      title: L(`New ${r.rating}★ review`, `تقييم جديد ${r.rating}★`),
      body: L(`${r.authorName} on ${t(r.product.name, "en")}`, `${r.authorName} على ${t(r.product.name, "ar")}`),
      link: `/admin/reviews?status=PENDING`,
      entityType: "review",
      entityId: r.id,
      severity: "INFO",
      counters: ["reviews"],
    };
  },
  async PRODUCT_LOW_STOCK({ productId, stock }) {
    const p = await db.product.findUnique({ where: { id: productId }, select: { id: true, name: true } });
    if (!p) return null;
    return {
      event: "PRODUCT_LOW_STOCK",
      permission: "inventory.manage",
      title: L("Low stock", "مخزون منخفض"),
      body: L(`${t(p.name, "en")} — ${stock} left`, `${t(p.name, "ar")} — متبقي ${stock}`),
      link: `/admin/products/${p.id}?tab=inventory`,
      entityType: "product",
      entityId: p.id,
      severity: "WARNING",
      counters: ["inventory"],
    };
  },
  async PRODUCT_OUT_OF_STOCK({ productId }) {
    const p = await db.product.findUnique({ where: { id: productId }, select: { id: true, name: true } });
    if (!p) return null;
    return {
      event: "PRODUCT_OUT_OF_STOCK",
      permission: "inventory.manage",
      title: L("Out of stock", "نفد المخزون"),
      body: L(`${t(p.name, "en")} is out of stock`, `نفد مخزون ${t(p.name, "ar")}`),
      link: `/admin/products/${p.id}?tab=inventory`,
      entityType: "product",
      entityId: p.id,
      severity: "CRITICAL",
      counters: ["inventory"],
    };
  },
  async CONTACT_SUBMITTED({ submissionId }) {
    const s = await db.contactSubmission.findUnique({ where: { id: submissionId } });
    if (!s) return null;
    return {
      event: "CONTACT_SUBMITTED",
      permission: "support.messages",
      title: L("New contact message", "رسالة تواصل جديدة"),
      body: L(`${s.name}: ${s.subject ?? s.message.slice(0, 80)}`, `${s.name}: ${s.subject ?? s.message.slice(0, 80)}`),
      link: `/admin/messages/${s.id}`,
      entityType: "contact",
      entityId: s.id,
      severity: "INFO",
      counters: ["messages"],
    };
  },
  async CHAT_STARTED({ conversationId }) {
    const c = await db.conversation.findUnique({ where: { id: conversationId }, include: { customer: { select: { name: true } } } });
    if (!c) return null;
    const who = c.customer?.name ?? c.guestName ?? "Visitor";
    return {
      event: "CHAT_STARTED",
      permission: "support.chat",
      title: L("New live chat request", "طلب محادثة مباشرة جديد"),
      body: L(`${who}: ${c.subject}`, `${who}: ${c.subject}`),
      link: `/admin/chat?c=${c.id}`,
      entityType: "conversation",
      entityId: c.id,
      severity: "WARNING",
      counters: ["chats"],
    };
  },
  async ADMIN_LOGIN_FAILED({ email, ip, reason }) {
    return {
      event: "ADMIN_LOGIN_FAILED",
      permission: "audit.view",
      title: L("Failed admin sign-in", "محاولة دخول فاشلة للوحة التحكم"),
      body: L(`${email} from ${ip ?? "unknown IP"} (${reason})`, `${email} من ${ip ?? "عنوان غير معروف"} (${reason})`),
      link: `/admin/security`,
      entityType: "security",
      severity: "WARNING",
    };
  },
  async ADMIN_LOGIN({ userId, ip }) {
    const u = await db.user.findUnique({ where: { id: userId } });
    if (!u) return null;
    return {
      event: "ADMIN_LOGIN",
      permission: "audit.view",
      title: L("Admin sign-in", "تسجيل دخول للوحة التحكم"),
      body: L(`${u.name} signed in from ${ip ?? "unknown IP"}`, `سجّل ${u.name} الدخول من ${ip ?? "عنوان غير معروف"}`),
      link: `/admin/security`,
      entityType: "security",
      severity: "INFO",
    };
  },
  async INTEGRATION_FAILED({ key, message }) {
    return {
      event: "INTEGRATION_FAILED",
      permission: "settings.integrations",
      title: L(`Integration error: ${key}`, `خطأ في التكامل: ${key}`),
      body: L(message.slice(0, 200), message.slice(0, 200)),
      link: `/admin/integrations?focus=${key}`,
      entityType: "integration",
      entityId: key,
      severity: "CRITICAL",
    };
  },
};

// ─────────────────────────── Customer messaging ─────────────────────────────

async function notifyCustomer(userId: string, n: { event: string; title: LocalizedText; body: LocalizedText; link?: string; entityType?: string; entityId?: string }) {
  const created = await db.notification.create({
    data: { audience: "CUSTOMER", userId, event: n.event, title: n.title, body: n.body, link: n.link, entityType: n.entityType, entityId: n.entityId },
  });
  realtime.toUser(userId, "notification:new", { id: created.id, title: n.title, body: n.body, link: n.link, createdAt: created.createdAt.toISOString() });
}

async function orderEmailBlocks(orderId: string, locale: string) {
  const o = await db.order.findUniqueOrThrow({ where: { id: orderId }, include: { items: true } });
  const rows = await Promise.all(
    o.items.map(
      async (i) =>
        `<tr><td style="padding:10px 0;border-bottom:1px solid #f0f1f4">${escapeHtml(t(i.name, locale))}${i.variantLabel ? `<br><span style="color:#6b7280;font-size:13px">${escapeHtml(t(i.variantLabel, locale))}</span>` : ""}</td><td style="padding:10px 8px;border-bottom:1px solid #f0f1f4;color:#6b7280" align="center">×${i.quantity}</td><td style="padding:10px 0;border-bottom:1px solid #f0f1f4" align="${locale === "ar" ? "left" : "right"}">${escapeHtml(await formatBase(i.total, locale))}</td></tr>`,
    ),
  );
  return `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:16px 0;font-size:14px">${rows.join("")}</table>`;
}

async function orderVars(orderId: string, locale: string) {
  const o = await db.order.findUniqueOrThrow({ where: { id: orderId }, include: { status: true } });
  return {
    order: o,
    vars: {
      customer_name: o.customerName,
      order_number: o.number,
      order_total: await formatBase(o.total, locale),
      order_status: t(o.status.label, locale),
      payment_method: o.paymentMethod,
      tracking_number: o.trackingNumber ?? "—",
      tracking_url: o.trackingUrl ?? "",
      carrier: o.carrier ?? "—",
      order_url: `${env().APP_URL}/${locale}/account/orders/${o.number}`,
    },
  };
}

async function customerWhatsApp(phone: string, text: string) {
  const cfg = await getSettings("notifications");
  if (!cfg.customer.whatsappOrderUpdates) return;
  const ctx = await activeIntegration("whatsapp_cloud");
  if (!ctx) return;
  const r = await sendWhatsAppTemplate(ctx, phone, text);
  await db.deliveryLog.create({ data: { channel: "WHATSAPP", recipient: phone, subject: text.slice(0, 120), status: r.ok ? "SENT" : "FAILED", error: r.ok ? null : r.message, providerRef: r.id } });
}

function register() {
  if (isRegistered("__nqNotificationEngine")) return;

  for (const [event, build] of Object.entries(builders)) {
    on(event as NotificationEventKey, (async (payload: unknown) => {
      const message = await (build as (p: unknown) => Promise<StaffMessage | null>)(payload);
      if (message) await dispatchStaff(message);
    }) as never);
  }

  // Customer-facing reactions
  on("ORDER_CREATED", async ({ orderId }) => {
    const cfg = (await getSettings("notifications")).customer;
    const o = await db.order.findUnique({ where: { id: orderId } });
    if (!o) return;
    if (cfg.orderConfirmation) {
      const { vars } = await orderVars(orderId, o.locale);
      await sendTemplate({
        template: "order_confirmation",
        to: o.email,
        locale: o.locale,
        orderId,
        userId: o.userId ?? undefined,
        vars,
        blocks: { order_items_block: await orderEmailBlocks(orderId, o.locale) },
        action: o.userId ? { label: o.locale === "ar" ? "عرض الطلب" : "View order", url: vars.order_url } : undefined,
      });
    }
    if (o.userId) {
      await notifyCustomer(o.userId, {
        event: "ORDER_CREATED",
        title: L(`Order ${o.number} placed`, `تم استلام الطلب ${o.number}`),
        body: L("We'll notify you as it progresses.", "سنبلغك بكل تحديث على الطلب."),
        link: `/account/orders/${o.number}`,
        entityType: "order",
        entityId: o.id,
      });
    }
  });

  on("ORDER_PAID", async ({ orderId }) => {
    const cfg = (await getSettings("notifications")).customer;
    const o = await db.order.findUnique({ where: { id: orderId } });
    if (!o || !cfg.paymentConfirmation) return;
    // Offline methods marked paid later still deserve a receipt; online ones got the confirmation already.
    const { vars } = await orderVars(orderId, o.locale);
    await sendTemplate({ template: "payment_confirmation", to: o.email, locale: o.locale, orderId, vars, action: o.userId ? { label: o.locale === "ar" ? "عرض الطلب" : "View order", url: vars.order_url } : undefined });
  });

  on("ORDER_STATUS_CHANGED", async ({ orderId, notifyCustomer: shouldNotify }) => {
    const cfg = (await getSettings("notifications")).customer;
    const { order, vars } = await orderVars(orderId, (await db.order.findUniqueOrThrow({ where: { id: orderId } })).locale);
    if (order.userId) {
      await notifyCustomer(order.userId, {
        event: "ORDER_STATUS_CHANGED",
        title: L(`Order ${order.number}: ${t(order.status.label, "en")}`, `الطلب ${order.number}: ${t(order.status.label, "ar")}`),
        body: L("Tap to see details.", "اضغط لعرض التفاصيل."),
        link: `/account/orders/${order.number}`,
        entityType: "order",
        entityId: order.id,
      });
    }
    if (!shouldNotify || !cfg.orderStatus) return;
    await sendTemplate({
      template: order.status.emailTemplate ?? "order_status",
      to: order.email,
      locale: order.locale,
      orderId,
      vars,
      action: order.trackingUrl
        ? { label: order.locale === "ar" ? "تتبع الشحنة" : "Track package", url: order.trackingUrl }
        : order.userId
          ? { label: order.locale === "ar" ? "عرض الطلب" : "View order", url: vars.order_url }
          : undefined,
    });
    await customerWhatsApp(order.phone, `${vars.order_number}: ${vars.order_status}`);
  });

  on("USER_REGISTERED", async ({ userId }) => {
    const cfg = (await getSettings("notifications")).customer;
    const u = await db.user.findUnique({ where: { id: userId } });
    if (!u || !cfg.welcome || u.type !== "CUSTOMER") return;
    await sendTemplate({
      template: "welcome",
      to: u.email,
      locale: u.locale,
      userId,
      vars: { customer_name: u.name },
      action: { label: u.locale === "ar" ? "ابدأ التسوق" : "Start shopping", url: `${env().APP_URL}/${u.locale}/shop` },
    });
  });

  on("CONTACT_SUBMITTED", async ({ submissionId }) => {
    const s = await db.contactSubmission.findUnique({ where: { id: submissionId } });
    if (!s) return;
    const locale = (s.extra as { locale?: string })?.locale ?? "ar";
    await sendTemplate({ template: "contact_receipt", to: s.email, locale, vars: { customer_name: s.name, subject: s.subject ?? "" } });
  });

  // Live counters that aren't tied to a staff notification.
  on("CHAT_MESSAGE", () => realtime.invalidateCounters(["chats"]));
  on("CHAT_CLOSED", () => realtime.invalidateCounters(["chats"]));
  on("CHAT_ACCEPTED", () => realtime.invalidateCounters(["chats"]));
  on("STOCK_CHANGED", () => realtime.invalidateCounters(["inventory"]));
}

register();

export { notifyCustomer };

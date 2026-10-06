import "server-only";
import { db } from "../../db";
import { env } from "../../env";
import { realtime } from "../../realtime/emitter";
import { getSettings } from "../../settings/service";
import { sendTemplate } from "../../email/mailer";
import { activeIntegration } from "../../integrations/service";
import { sendWhatsAppTemplate } from "../../integrations/providers/whatsapp";
import { hasPermission } from "@/config/permissions";
import { t } from "@/lib/i18n-text";
import type { StaffChannel, StaffMessage } from "../types";

/** Staff members who should receive a message gated by a permission. */
async function staffWith(permission: StaffMessage["permission"]) {
  const staff = await db.user.findMany({ where: { type: "STAFF", status: "ACTIVE" }, include: { role: true } });
  return staff.filter((s) => hasPermission(s.role?.permissions ?? [], permission));
}

export const inAppChannel: StaffChannel = {
  key: "inApp",
  async deliver(m) {
    const n = await db.notification.create({
      data: {
        audience: "STAFF",
        permission: m.permission,
        event: m.event,
        title: m.title,
        body: m.body,
        link: m.link,
        entityType: m.entityType,
        entityId: m.entityId,
        severity: m.severity,
      },
    });
    realtime.toPermission(m.permission, "notification:new", {
      id: n.id,
      event: n.event,
      title: n.title,
      body: n.body,
      link: n.link,
      severity: n.severity,
      createdAt: n.createdAt.toISOString(),
    });
    realtime.invalidateCounters(["notifications", ...(m.counters ?? [])]);
    return { channel: "inApp", ok: true };
  },
};

export const emailChannel: StaffChannel = {
  key: "email",
  async deliver(m) {
    const cfg = await getSettings("notifications");
    const recipients = cfg.staffEmails.length
      ? cfg.staffEmails.map((email) => ({ email, locale: "en" }))
      : (await staffWith(m.permission)).map((s) => ({ email: s.email, locale: s.locale }));
    if (!recipients.length) return { channel: "email", ok: true, skipped: true };
    const results = await Promise.all(
      recipients.map((r) =>
        sendTemplate({
          template: "staff_alert",
          to: r.email,
          locale: r.locale,
          vars: { alert_title: t(m.title, r.locale), alert_body: t(m.body, r.locale) },
          action: m.link ? { label: r.locale === "ar" ? "فتح في لوحة التحكم" : "Open in admin", url: `${env().APP_URL}/${r.locale}${m.link}` } : undefined,
        }),
      ),
    );
    // Not configured is a known state (shown in the admin), not a delivery failure.
    if (results.every((r) => !r.ok && r.code === "not_configured")) return { channel: "email", ok: true, skipped: true };
    const failed = results.filter((r) => !r.ok);
    return { channel: "email", ok: failed.length === 0, error: failed[0] && !failed[0].ok ? failed[0].message : undefined };
  },
};

export const whatsappChannel: StaffChannel = {
  key: "whatsapp",
  async deliver(m) {
    const cfg = await getSettings("notifications");
    if (!cfg.staffWhatsapp.length) return { channel: "whatsapp", ok: true, skipped: true };
    const ctx = await activeIntegration("whatsapp_cloud");
    if (!ctx) return { channel: "whatsapp", ok: false, skipped: true, error: "WhatsApp integration not enabled" };
    const text = `${t(m.title, "en")} — ${t(m.body, "en")}${m.link ? ` ${env().APP_URL}/en${m.link}` : ""}`;
    const results = await Promise.all(
      cfg.staffWhatsapp.map(async (to) => {
        const r = await sendWhatsAppTemplate(ctx, to, text);
        await db.deliveryLog.create({
          data: { channel: "WHATSAPP", recipient: to, subject: t(m.title, "en"), template: m.event, status: r.ok ? "SENT" : "FAILED", error: r.ok ? null : r.message, providerRef: r.id },
        });
        return r;
      }),
    );
    const failed = results.find((r) => !r.ok);
    return { channel: "whatsapp", ok: !failed, error: failed?.message };
  },
};

export const STAFF_CHANNELS: StaffChannel[] = [inAppChannel, emailChannel, whatsappChannel];

"use server";

import { z } from "zod";
import { getSettings, saveSettings } from "@/server/settings/service";
import { settingsSchemas, SETTINGS_PERMISSIONS, SECRET_FIELDS, type SettingsGroup } from "@/server/settings/schemas";
import { testSmtp, testImap, sendMail } from "@/server/email/mailer";
import { emailLayout, escapeHtml } from "@/server/email/render";
import { audit } from "@/server/audit";
import { t } from "@/lib/i18n-text";
import * as data from "@/server/admin/settings-data";
import { adminRun } from "./_base";

const groupSchema = z.enum(Object.keys(settingsSchemas) as [SettingsGroup, ...SettingsGroup[]]);

/**
 * Save one settings group. Permission is per group; secret fields are never
 * echoed back (the service keeps the stored value when left blank).
 */
export async function saveSettingsAction(group: SettingsGroup, input: unknown, clearSecrets: string[] = []) {
  const g = groupSchema.parse(group);
  return adminRun(SETTINGS_PERMISSIONS[g], async (staff) => {
    const allowedClear = z.array(z.enum((SECRET_FIELDS[g] ?? ["__none__"]) as [string, ...string[]])).max(10).parse(clearSecrets);
    let value = input;
    // Connection status is written only by the test actions, never by the form.
    if (g === "email" && input && typeof input === "object") {
      const current = await getSettings("email");
      value = { ...(input as object), smtpStatus: current.smtpStatus, imapStatus: current.imapStatus };
    }
    await saveSettings(g, value, { userId: staff.id, clearSecrets: allowedClear });
    await audit({ actor: staff, action: "settings.updated", entityType: "settings", entityId: g, summary: g });
  });
}

export async function testSmtpAction() {
  return adminRun("settings.email", () => testSmtp(), { revalidate: false });
}

export async function testImapAction() {
  return adminRun("settings.email", () => testImap(), { revalidate: false });
}

export async function sendTestEmailAction(to: string, locale: string) {
  return adminRun(
    "settings.email",
    async (staff) => {
      const email = z.string().trim().email().parse(to);
      const [store, settings] = await Promise.all([getSettings("store"), getSettings("email")]);
      const ar = locale === "ar";
      const name = t(store.name, ar ? "ar" : "en");
      const html = emailLayout({
        dir: ar ? "rtl" : "ltr",
        storeName: name,
        accent: settings.branding.accentColor,
        body: `<h1 style="margin:0 0 12px;font-size:20px">${ar ? "بريد تجريبي" : "Test email"}</h1><p>${escapeHtml(ar ? `إذا وصلتك هذه الرسالة فإن إعدادات البريد في ${name} تعمل بشكل صحيح.` : `If you can read this, email delivery for ${name} is working.`)}</p>`,
        footer: escapeHtml(t(settings.branding.footer, ar ? "ar" : "en") || name),
      });
      const r = await sendMail({ to: email, subject: ar ? `بريد تجريبي من ${name}` : `Test email from ${name}`, html, template: "test" });
      await audit({ actor: staff, action: "email.test_sent", summary: `${email}: ${r.ok ? "sent" : r.code}` });
      return r;
    },
    { revalidate: false },
  );
}

// ─────────────── Table-backed settings (currencies, shipping, statuses, templates) ───────────────


export async function saveCurrenciesAction(input: unknown) {
  return adminRun("settings.general", (s) => data.saveCurrencies(input, s));
}

export async function saveShippingAction(input: unknown) {
  return adminRun("settings.shipping", (s) => data.saveShipping(input, s));
}

export async function saveOrderStatusesAction(input: unknown) {
  return adminRun("settings.general", (s) => data.saveOrderStatuses(input, s));
}

const templateKey = z.string().regex(/^[a-z_]{2,60}$/);

export async function saveTemplateAction(key: string, input: unknown) {
  return adminRun("settings.email", (s) => data.saveTemplate(templateKey.parse(key), input, s), { revalidate: false });
}

export async function resetTemplateAction(key: string) {
  return adminRun("settings.email", (s) => data.resetTemplate(templateKey.parse(key), s), { revalidate: false });
}

export async function previewTemplateAction(key: string, locale: string, override: { subject: string; body: string }) {
  return adminRun(
    "settings.email",
    () => data.previewTemplate(templateKey.parse(key), z.enum(["ar", "en"]).parse(locale), z.object({ subject: z.string().max(200), body: z.string().max(50_000) }).parse(override)),
    { revalidate: false },
  );
}

export async function saveFxSettingsAction(input: unknown) {
  return adminRun("settings.general", (s) => data.saveFxSettings(input, s));
}

/** Fetch exchange rates now (ignores the schedule). */
export async function refreshRatesAction() {
  return adminRun("settings.general", (s) => data.refreshRatesNow(s));
}

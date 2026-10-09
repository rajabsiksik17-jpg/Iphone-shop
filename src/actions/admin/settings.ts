"use server";

import { z } from "zod";
import { getSettings, saveSettings } from "@/server/settings/service";
import { settingsSchemas, SETTINGS_PERMISSIONS, SECRET_FIELDS, type SettingsGroup, PINNED_FIELDS } from "@/server/settings/schemas";
import { testSmtp, testImap, sendMail } from "@/server/email/mailer";
import { emailLayout, escapeHtml } from "@/server/email/render";
import { audit } from "@/server/audit";
import { t } from "@/lib/i18n-text";
import * as data from "@/server/admin/settings-data";
import * as storeType from "@/server/admin/store-type";
import * as regions from "@/server/admin/regions";
import * as profiles from "@/server/admin/store-profiles";
import * as country from "@/server/admin/country";
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
    // Platform-owned fields keep their stored value whatever the form sends.
    const pinned = PINNED_FIELDS[g];
    if (pinned && input && typeof input === "object") {
      const current = (await getSettings(g)) as Record<string, unknown>;
      value = { ...(input as object), ...Object.fromEntries(pinned.map((k) => [k, current[k]])) };
    }
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

export async function saveStoreTypeAction(input: unknown) {
  return adminRun("platform.storeType", (s) => storeType.saveStoreType(input, s));
}

export async function setCardAttributesAction(ids: string[]) {
  return adminRun("catalog.edit", (s) => storeType.setCardAttributes(ids, s));
}

// ─────────────── Countries & cities ───────────────

export async function countryRegionsAction(country: string, locale: string) {
  return adminRun("settings.shipping", () => regions.countryRegions(country, z.enum(["ar", "en"]).parse(locale)), { revalidate: false });
}

export async function saveCountriesAction(input: { countries: string[] }) {
  return adminRun("settings.shipping", (s) => regions.saveCountries(input, s));
}

export async function importRegionsAction(country: string) {
  return adminRun("settings.shipping", (s) => regions.importPresetRegions(country, s));
}

export async function saveRegionAction(id: string | null, input: unknown) {
  return adminRun("settings.shipping", (s) => regions.saveRegion(id, input, s));
}

export async function bulkRegionsAction(ids: string[], op: "activate" | "deactivate" | "delete") {
  return adminRun("settings.shipping", (s) => regions.bulkRegions(ids, op, s));
}

export async function reorderRegionsAction(ids: string[]) {
  return adminRun("settings.shipping", () => regions.reorderRegions(ids));
}

export async function saveRegionRatesAction(regionIds: string[], rates: unknown) {
  return adminRun("settings.shipping", (s) => regions.saveRegionRates(regionIds, rates, s));
}

export async function setMethodLimitAction(methodId: string, limit: boolean) {
  return adminRun("settings.shipping", (s) => regions.setMethodLimit(methodId, limit, s));
}

// ─────────────── Platform (super-admin only) ───────────────
// "platform.*" permissions are held only by the wildcard super-admin role and
// can't be granted to any other role (see config/permissions).

export async function planSwitchStoreTypeAction(key: string, locale: string) {
  return adminRun("platform.storeType", () => profiles.planSwitch(z.string().max(60).parse(key), z.enum(["ar", "en"]).parse(locale)), { revalidate: false });
}

export async function switchStoreTypeAction(key: string) {
  return adminRun("platform.storeType", (s) => profiles.switchStoreType(z.string().max(60).parse(key), s));
}

export async function applyTemplateUpdateAction(key: string) {
  return adminRun("platform.storeType", (s) => profiles.applyTemplateUpdate(z.string().max(60).parse(key), s));
}

export async function removeDemoProductsAction(key: string) {
  return adminRun("platform.storeType", (s) => profiles.removeDemoProducts(z.string().max(60).parse(key), s));
}

export async function customTypeAction(key: string) {
  return adminRun("platform.storeType", () => profiles.customTypeData(z.string().max(60).parse(key)), { revalidate: false });
}

export async function saveCustomTypeAction(key: string | null, input: unknown) {
  return adminRun("platform.storeType", (s) => profiles.saveCustomType(key === null ? null : z.string().max(60).parse(key), input, s));
}

export async function planCountryChangeAction(code: string) {
  return adminRun("platform.country", () => country.planCountryChange(code), { revalidate: false });
}

export async function applyCountryChangeAction(input: unknown) {
  return adminRun("platform.country", (s) => country.applyCountryChange(input, s));
}

export async function setDetectionAction(on: boolean) {
  return adminRun("platform.country", (s) => country.setDetection(on, s));
}

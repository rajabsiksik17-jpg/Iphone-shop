import "server-only";
import { z } from "zod";
import { db } from "../db";
import { AppError } from "../errors";
import { audit } from "../audit";
import { getManySettings, patchSettings } from "../settings/service";
import { zoneForCountry } from "../commerce/shipping";
import { invalidateDestinations } from "../commerce/regions";
import { COUNTRY_PROFILES, countryProfile, isSupportedPrimaryCountry } from "@/config/countries";
import { CURRENCY_CATALOG, currencyMeta } from "@/config/currencies";
import { REGION_PRESETS, regionPresetCount } from "@/config/regions-data";
import { t } from "@/lib/i18n-text";
import type { CurrentStaff } from "../auth/session";

/**
 * Primary store country (super-admin only). It sets the store's business
 * defaults — never rewrites history: addresses, orders (with their own
 * currency and totals), payments and product prices stay exactly as they are.
 * A change is planned first (dry run listing every affected setting), then
 * applied with the options the super-admin confirmed.
 */

export async function countryPage(locale: string) {
  const s = await getManySettings(["geo", "localization", "tax", "checkout", "appearance"]);
  const base = await db.currency.findFirst({ where: { isBase: true }, select: { code: true } });
  const regionCounts = await db.region.groupBy({ by: ["country"], _count: { _all: true } });
  return {
    primary: s.geo.defaultCountry,
    detectFromHeaders: s.geo.detectFromHeaders,
    baseCurrency: base?.code ?? "SAR",
    countries: COUNTRY_PROFILES.map((c) => ({
      code: c.code,
      name: t(c.name, locale),
      currency: c.currency,
      dialCode: c.dialCode,
      timezone: c.timezone,
      taxRateBp: c.tax.rateBp,
      cityPreset: regionPresetCount(c.code),
      cities: regionCounts.find((r) => r.country === c.code)?._count._all ?? 0,
    })),
  };
}

export type CountryChange = { key: ChangeKey; label: { en: string; ar: string }; from: string; to: string; recommended: boolean };
type ChangeKey = "timezone" | "tax" | "currency" | "allowedCountries" | "postalCode" | "paymentBadges" | "cities";

/** Dry run: what switching the primary country would change, and what needs attention afterwards. */
export async function planCountryChange(raw: string) {
  const code = z.string().length(2).parse(raw).toUpperCase();
  if (!isSupportedPrimaryCountry(code)) throw new AppError("unsupported_country", 400);
  const p = countryProfile(code);
  const s = await getManySettings(["geo", "localization", "tax", "checkout", "appearance"]);
  const base = await db.currency.findFirst({ where: { isBase: true }, select: { code: true } });
  const currencyRow = await db.currency.findUnique({ where: { code: p.currency }, select: { code: true, isActive: true } });
  const cities = await db.region.count({ where: { country: code } });
  const zone = await zoneForCountry(code);
  const pct = (bp: number) => `${bp / 100}%`;

  const changes: CountryChange[] = [];
  if (s.localization.timezone !== p.timezone) changes.push({ key: "timezone", label: { en: "Store timezone", ar: "المنطقة الزمنية" }, from: s.localization.timezone, to: p.timezone, recommended: true });
  if (s.tax.rateBp !== p.tax.rateBp || t(s.tax.label, "en") !== p.tax.label.en)
    changes.push({ key: "tax", label: { en: "Tax rate & label", ar: "نسبة الضريبة ومسماها" }, from: `${t(s.tax.label, "en")} ${pct(s.tax.rateBp)}`, to: p.tax.rateBp ? `${p.tax.label.en} ${pct(p.tax.rateBp)}` : "None", recommended: true });
  const displayOk = !s.localization.displayCurrencies.length || s.localization.displayCurrencies.includes(p.currency);
  if (p.currency !== base?.code && (!currencyRow?.isActive || !displayOk))
    changes.push({ key: "currency", label: { en: "Enable the country's currency", ar: "تفعيل عملة الدولة" }, from: currencyRow?.isActive && displayOk ? "on" : "off", to: p.currency, recommended: true });
  if (s.checkout.allowedCountries.length && !s.checkout.allowedCountries.includes(code))
    changes.push({ key: "allowedCountries", label: { en: "Add to shipping countries", ar: "إضافة لدول الشحن" }, from: s.checkout.allowedCountries.join(", "), to: [...s.checkout.allowedCountries, code].join(", "), recommended: true });
  if (s.checkout.postalCode !== p.address.postalCode) changes.push({ key: "postalCode", label: { en: "Postal code at checkout", ar: "الرمز البريدي في الدفع" }, from: s.checkout.postalCode, to: p.address.postalCode, recommended: true });
  if (s.appearance.footer.paymentIcons.join() !== p.payments.badges.join())
    changes.push({ key: "paymentBadges", label: { en: "Footer payment badges", ar: "شعارات الدفع في التذييل" }, from: s.appearance.footer.paymentIcons.join(", "), to: p.payments.badges.join(", "), recommended: true });
  if (!cities && REGION_PRESETS[code]) changes.push({ key: "cities", label: { en: "Import governorates", ar: "استيراد المحافظات" }, from: "0", to: String(regionPresetCount(code)), recommended: true });

  // Not changed automatically — shown so nothing is a surprise.
  const attention: { en: string; ar: string }[] = [];
  if (base && base.code !== p.currency) {
    const cur = currencyMeta(p.currency);
    attention.push({
      en: `Product prices stay stored in ${base.code} (the base currency) and aren't converted. Visitors without a saved preference see ${p.currency} converted at the live exchange rate. Re-price the catalog in ${cur?.code ?? p.currency} if you want ${p.currency} to be the base.`,
      ar: `تبقى أسعار المنتجات محفوظة بـ ${base.code} (العملة الأساسية) ولا تُحوَّل. يرى الزوار بدون تفضيل محفوظ الأسعار بـ ${p.currency} حسب سعر الصرف. أعد تسعير المنتجات إن أردت أن تكون ${p.currency} هي الأساسية.`,
    });
  }
  if (!zone) attention.push({ en: `No shipping zone covers ${t(p.name, "en")} yet — add one in Settings → Shipping.`, ar: `لا توجد منطقة شحن تغطي ${t(p.name, "ar")} — أضفها من الإعدادات ← الشحن.` });
  if (p.payments.local.length)
    attention.push({ en: `Popular local payment methods: ${p.payments.local.map((x) => x.en).join(", ")}. Enable the ones your gateway supports in Integrations → Payments.`, ar: `طرق دفع محلية شائعة: ${p.payments.local.map((x) => x.ar).join("، ")}. فعّل ما يدعمه مزوّد الدفع من التكاملات ← المدفوعات.` });

  return {
    code,
    from: s.geo.defaultCountry,
    profile: { name: p.name, currency: p.currency, dialCode: p.dialCode, timezone: p.timezone, cityLabel: p.address.cityLabel },
    changes,
    attention,
    preserved: [
      { en: "Customer accounts and saved addresses", ar: "حسابات العملاء وعناوينهم المحفوظة" },
      { en: "Past orders keep their currency, totals and taxes", ar: "الطلبات السابقة تحتفظ بعملتها ومبالغها وضرائبها" },
      { en: "Products and their prices", ar: "المنتجات وأسعارها" },
      { en: "Payment records and refunds", ar: "سجلات المدفوعات والمبالغ المستردة" },
    ],
  };
}

const applySchema = z.object({ code: z.string().length(2), apply: z.array(z.enum(["timezone", "tax", "currency", "allowedCountries", "postalCode", "paymentBadges", "cities"])).max(10) });

/** Apply a planned change. Visitor detection never calls this — only the super-admin does. */
export async function applyCountryChange(raw: unknown, staff: CurrentStaff) {
  const input = applySchema.parse(raw);
  const plan = await planCountryChange(input.code);
  const p = countryProfile(plan.code);
  const chosen = new Set(input.apply.filter((k) => plan.changes.some((c) => c.key === k)));
  const s = await getManySettings(["checkout", "appearance", "localization"]);

  await patchSettings("geo", { defaultCountry: plan.code });
  await patchSettings("store", { defaultCountry: plan.code });
  if (chosen.has("timezone")) await patchSettings("localization", { timezone: p.timezone });
  if (chosen.has("tax")) await patchSettings("tax", { enabled: p.tax.rateBp > 0, rateBp: p.tax.rateBp, label: p.tax.label, pricesIncludeTax: p.tax.pricesIncludeTax });
  if (chosen.has("postalCode")) await patchSettings("checkout", { postalCode: p.address.postalCode });
  if (chosen.has("allowedCountries")) await patchSettings("checkout", { allowedCountries: [...s.checkout.allowedCountries, plan.code] });
  if (chosen.has("paymentBadges")) await patchSettings("appearance", { footer: { ...s.appearance.footer, paymentIcons: p.payments.badges } });
  if (chosen.has("currency")) {
    const meta = CURRENCY_CATALOG.find((c) => c.code === p.currency);
    if (meta) {
      await db.currency.upsert({
        where: { code: meta.code },
        create: { code: meta.code, name: meta.name, symbol: meta.symbol, decimals: meta.decimals, flag: meta.flag, symbolPosition: "AFTER", rate: 1, autoRate: true, isActive: true, position: 99 },
        update: { isActive: true },
      });
      if (s.localization.displayCurrencies.length && !s.localization.displayCurrencies.includes(meta.code)) await patchSettings("localization", { displayCurrencies: [...s.localization.displayCurrencies, meta.code] });
    }
  }
  if (chosen.has("cities") && REGION_PRESETS[plan.code] && !(await db.region.count({ where: { country: plan.code } }))) {
    let position = 0;
    await db.region.createMany({ data: REGION_PRESETS[plan.code].flatMap((g) => g.cities.map((c) => ({ country: plan.code, name: c, group: g.group, position: position++ }))) });
  }
  invalidateDestinations();
  await audit({ actor: staff, action: "platform.country_changed", entityType: "settings", entityId: "geo", summary: `${plan.from} → ${plan.code}`, changes: { from: plan.from, to: plan.code, applied: [...chosen] } });
  return { code: plan.code, applied: [...chosen] };
}

/** Visitor-country detection toggle (platform-level). */
export async function setDetection(on: boolean, staff: CurrentStaff) {
  await patchSettings("geo", { detectFromHeaders: z.boolean().parse(on) });
  await audit({ actor: staff, action: "settings.updated", entityType: "settings", entityId: "geo", summary: `detectFromHeaders=${on}` });
}

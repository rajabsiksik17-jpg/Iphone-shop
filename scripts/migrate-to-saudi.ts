/**
 * One-time migration of an existing database from the original Jordan setup
 * (JOD base) to the Saudi setup (SAR base). Idempotent: running it again
 * after success changes nothing.
 *
 *   npm run migrate:saudi                 # catalogue, settings, content
 *   npm run migrate:saudi -- --orders     # also convert historical orders (demo data)
 *
 * Money: every stored amount is in minor units of the base currency, so the
 * base can't simply be relabelled. Catalogue prices are converted with retail
 * rounding (whole riyals, ending in 9 above 100 SAR); orders and payments are
 * converted exactly so historical totals stay consistent. Only run --orders on
 * demo data: real historical orders should keep the currency they were paid in.
 */
import "dotenv/config";
import { db } from "../src/server/db";
import { CURRENCY_CATALOG } from "../src/config/currencies";
import { refreshProductDerived } from "../src/server/catalog/derived";
import { getSettings, saveSettings, invalidateSettings } from "../src/server/settings/service";
import { invalidateCurrencies } from "../src/server/commerce/currency";
import { refreshRates } from "../src/server/commerce/fx";
import { SAUDI_TEXT_PAIRS } from "./saudi-text-pairs";
import { swapContent } from "./lib/content-swap";

const withOrders = process.argv.includes("--orders");
const log = (...a: unknown[]) => console.log("  ·", ...a);

async function jodToSarRate() {
  try {
    const r = await fetch("https://open.er-api.com/v6/latest/JOD", { signal: AbortSignal.timeout(10_000) });
    const j = (await r.json()) as { rates?: Record<string, number> };
    if (j.rates?.SAR && j.rates.SAR > 4 && j.rates.SAR < 7) return j.rates.SAR;
  } catch {
    /* fall through */
  }
  return 5.29; // both currencies are pegged to USD
}

async function rebaseMoney() {
  const base = await db.currency.findFirst({ where: { isBase: true } });
  if (base?.code === "SAR") return log("Base currency is already SAR — money unchanged");
  if (base && base.code !== "JOD") throw new Error(`Unexpected base currency ${base.code}`);
  const rate = await jodToSarRate();
  // JOD minor (fils, 3 dp) → SAR minor (halalas, 2 dp).
  const f = (rate * 100) / 1000;
  log(`Converting JOD → SAR at ${rate.toFixed(4)}`);

  // Retail rounding in SQL so each table converts in one round trip.
  const retail = (col: string) => `CASE WHEN ${col} IS NULL THEN NULL WHEN ${col} * ${f} >= 10000 THEN (ROUND(${col} * ${f} / 1000.0) * 10 - 1) * 100 ELSE ROUND(${col} * ${f} / 100.0) * 100 END`;
  const exact = (col: string) => `ROUND(${col} * ${f})`;
  const q = (sql: string) => db.$executeRawUnsafe(sql);

  await q(`UPDATE "Product" SET "price" = ${retail('"price"')}, "salePrice" = ${retail('"salePrice"')}, "costPrice" = ${exact('"costPrice"')}`);
  await q(`UPDATE "Product" SET "salePrice" = NULL WHERE "salePrice" >= "price"`);
  await q(`UPDATE "ProductVariant" SET "price" = ${retail('"price"')}, "salePrice" = ${retail('"salePrice"')}, "costPrice" = ${exact('"costPrice"')}`);
  await q(`UPDATE "ProductVariant" SET "salePrice" = NULL WHERE "salePrice" IS NOT NULL AND "salePrice" >= COALESCE("price", (SELECT p."price" FROM "Product" p WHERE p."id" = "ProductVariant"."productId"))`);
  // Coupons: FIXED values to whole riyals, thresholds to tens of riyals. Percentages are unitless.
  await q(`UPDATE "Coupon" SET "value" = ROUND("value" * ${f} / 100.0) * 100 WHERE "type" = 'FIXED'`);
  await q(`UPDATE "Coupon" SET "maxDiscount" = ROUND("maxDiscount" * ${f} / 1000.0) * 1000 WHERE "maxDiscount" IS NOT NULL`);
  await q(`UPDATE "Coupon" SET "minSubtotal" = ROUND("minSubtotal" * ${f} / 1000.0) * 1000 WHERE "minSubtotal" IS NOT NULL`);

  if (withOrders) {
    await q(`UPDATE "Order" SET "subtotal" = ${exact('"subtotal"')}, "discountTotal" = ${exact('"discountTotal"')}, "shippingTotal" = ${exact('"shippingTotal"')}, "taxTotal" = ${exact('"taxTotal"')}, "total" = ${exact('"total"')}, "refundedTotal" = ${exact('"refundedTotal"')}, "currency" = 'SAR' WHERE "currency" = 'JOD'`);
    await q(`UPDATE "OrderItem" SET "unitPrice" = ${exact('"unitPrice"')}, "regularUnitPrice" = ${exact('"regularUnitPrice"')}, "discountTotal" = ${exact('"discountTotal"')}, "total" = ${exact('"total"')} WHERE "orderId" IN (SELECT "id" FROM "Order" WHERE "currency" = 'SAR')`);
    await q(`UPDATE "OrderDiscount" SET "amount" = ${exact('"amount"')}`);
    await q(`UPDATE "Payment" SET "amount" = ${exact('"amount"')}, "currency" = 'SAR' WHERE "currency" = 'JOD'`);
    await q(`UPDATE "Refund" SET "amount" = ${exact('"amount"')}`);
    await q(`UPDATE "CouponRedemption" SET "amount" = ${exact('"amount"')}`);
    await q(`UPDATE "AnalyticsEvent" SET "value" = ${exact('"value"')} WHERE "value" IS NOT NULL`);
    log("Orders, payments and refunds converted");
  } else {
    const orders = await db.order.count({ where: { currency: "JOD" } });
    if (orders) log(`${orders} historical orders keep JOD (re-run with --orders for demo data)`);
  }

  const products = await db.product.findMany({ select: { id: true } });
  for (const p of products) await refreshProductDerived(p.id);
  log(`Prices converted for ${products.length} products`);

  // Currency table: SAR becomes the base.
  for (const [position, c] of CURRENCY_CATALOG.entries()) {
    const data = { name: c.name, symbol: c.symbol, decimals: c.decimals, flag: c.flag, position };
    await db.currency.upsert({
      where: { code: c.code },
      create: { code: c.code, ...data, symbolPosition: ["USD", "EUR", "GBP", "TRY"].includes(c.code) ? "BEFORE" : "AFTER", rate: 1, isBase: false, isActive: true, autoRate: true },
      update: data,
    });
  }
  await db.currency.updateMany({ data: { isBase: false } });
  await db.currency.update({ where: { code: "SAR" }, data: { isBase: true, rate: 1, autoRate: false, isActive: true } });
  await db.currency.update({ where: { code: "JOD" }, data: { rate: 1 / rate } });
  // Old rates were relative to JOD: mark them as placeholders so the next
  // provider refresh replaces them all.
  await db.currency.updateMany({ where: { isBase: false }, data: { rateUpdatedAt: null } });
}

async function saudiSettings() {
  const [store, contact, widgets, geo, l10n, appearance, loyalty, checkout] = await Promise.all([
    getSettings("store"), getSettings("contact"), getSettings("widgets"), getSettings("geo"), getSettings("localization"), getSettings("appearance"), getSettings("loyalty"), getSettings("checkout"),
  ]);
  const swap = <T>(v: T): T => {
    let s = JSON.stringify(v);
    for (const [a, b] of SAUDI_TEXT_PAIRS) s = s.split(JSON.stringify(a).slice(1, -1)).join(JSON.stringify(b).slice(1, -1));
    return JSON.parse(s) as T;
  };
  await saveSettings("store", swap({ ...store, defaultCountry: "SA", phone: store.phone.startsWith("+962") ? "+966 11 500 0000" : store.phone }));
  await saveSettings("contact", swap({
    ...contact,
    phone: contact.phone.startsWith("+962") ? "+966 11 500 0000" : contact.phone,
    whatsapp: contact.whatsapp.startsWith("+962") ? "+966500000000" : contact.whatsapp,
    mapEmbedUrl: contact.mapEmbedUrl.includes("35.9") ? "https://www.openstreetmap.org/export/embed.html?bbox=46.665%2C24.700%2C46.695%2C24.720&layer=mapnik&marker=24.7106%2C46.6799" : contact.mapEmbedUrl,
  }));
  await saveSettings("widgets", { ...widgets, whatsapp: { ...widgets.whatsapp, number: widgets.whatsapp.number.replace(/\D/g, "").startsWith("962") ? "966500000000" : widgets.whatsapp.number } });
  await saveSettings("geo", { ...geo, defaultCountry: "SA" });
  await saveSettings("localization", { ...l10n, timezone: l10n.timezone === "Asia/Amman" ? "Asia/Riyadh" : l10n.timezone, displayCurrencies: [] });
  await saveSettings("tax", { enabled: true, rateBp: 1500, pricesIncludeTax: true, label: { en: "VAT", ar: "ضريبة القيمة المضافة" } });
  await saveSettings("appearance", swap({ ...appearance, footer: { ...appearance.footer, paymentIcons: [...new Set(["mada", ...appearance.footer.paymentIcons])] } }));
  // 1 point per riyal, each point worth 1 halala (1% back).
  await saveSettings("loyalty", { ...loyalty, pointsPerUnit: 1, pointValue: 1, signupBonus: loyalty.signupBonus });
  await saveSettings("checkout", { ...checkout, minOrderAmount: 0 });
  const seo = await getSettings("seo");
  await saveSettings("seo", swap(seo));
  invalidateSettings();
  log("Saudi settings applied (country, timezone, VAT 15%, contact, loyalty)");
}

async function shipping() {
  const zones = await db.shippingZone.findMany({ include: { methods: { orderBy: { position: "asc" } } }, orderBy: { position: "asc" } });
  if (zones.some((z) => z.countries.length === 1 && z.countries[0] === "SA")) return log("Saudi shipping zone already present");
  const L = (en: string, ar: string) => ({ en, ar });
  const jo = zones.find((z) => z.countries.includes("JO"));
  const methods = [
    { name: L("Standard delivery", "التوصيل العادي"), description: L("Free on orders over 299 SAR", "مجاني للطلبات فوق 299 ريال"), type: "FREE_OVER" as const, cost: 2500, freeOver: 29900, perKg: null, minDays: 2, maxDays: 5 },
    { name: L("Express (Riyadh, Jeddah, Dammam)", "توصيل سريع (الرياض، جدة، الدمام)"), description: L("Next working day for orders before 4 pm", "يوم العمل التالي للطلبات قبل 4 مساءً"), type: "FLAT" as const, cost: 4500, freeOver: null, perKg: null, minDays: 1, maxDays: 2 },
    { name: L("Store pickup", "الاستلام من المتجر"), description: L("King Fahd Road, Riyadh", "طريق الملك فهد، الرياض"), type: "PICKUP" as const, cost: 0, freeOver: null, perKg: null, minDays: 0, maxDays: 1 },
  ];
  // Reuse the Jordan zone (orders may reference its methods) as the Saudi zone.
  const zone = jo ? await db.shippingZone.update({ where: { id: jo.id }, data: { name: "Saudi Arabia", countries: ["SA"], position: 0 } }) : await db.shippingZone.create({ data: { name: "Saudi Arabia", countries: ["SA"], position: 0 } });
  const existing = jo?.methods ?? [];
  for (const [i, m] of methods.entries()) {
    if (existing[i]) await db.shippingMethod.update({ where: { id: existing[i].id }, data: { ...m, position: i } });
    else await db.shippingMethod.create({ data: { ...m, zoneId: zone.id, position: i } });
  }
  for (const z of zones.filter((z) => z.id !== jo?.id)) {
    if (z.countries.includes("SA")) await db.shippingZone.update({ where: { id: z.id }, data: { name: "GCC", countries: z.countries.filter((c) => c !== "SA") } });
    for (const m of z.methods) {
      const gcc = z.countries.includes("AE");
      await db.shippingMethod.update({ where: { id: m.id }, data: gcc ? { name: L("GCC express", "شحن خليجي سريع"), cost: 6900, perKg: 1500, minDays: 3, maxDays: 6 } : { cost: 11900, perKg: 2500, minDays: 5, maxDays: 12 } });
    }
  }
  log("Shipping zones: Saudi Arabia, GCC, rest of world");
}

/** Replace Jordan-specific copy in every content table (JSON-safe). */
async function content() {
  const n = await swapContent(SAUDI_TEXT_PAIRS);
  // Automatic promotion copy that mentions JOD amounts.
  await db.coupon.updateMany({ where: { isAutomatic: true, name: { path: ["en"], equals: "Spend 500, save 20 JOD" } }, data: { name: { en: "Spend 2,500 SAR, save 100 SAR", ar: "أنفق 2,500 ريال ووفّر 100 ريال" }, value: 10000, minSubtotal: 250000 } });
  log(`Content updated in ${n} records`);
}

async function main() {
  console.log(`Migrating to Saudi setup${withOrders ? " (including orders)" : ""}…`);
  await rebaseMoney();
  invalidateCurrencies();
  await saudiSettings();
  await shipping();
  await content();
  const fx = await refreshRates({ force: true });
  log(`Exchange rates: ${fx.message}`);
  console.log("Done.");
}

main()
  .then(() => db.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await db.$disconnect();
    process.exit(1);
  });

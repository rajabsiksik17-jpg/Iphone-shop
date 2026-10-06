import "server-only";
import { z } from "zod";
import { db } from "../db";
import { Errors } from "../errors";
import { audit } from "../audit";
import { invalidateCurrencies } from "../commerce/currency";
import { EMAIL_TEMPLATES, templateDef } from "../email/defaults";
import { renderTemplate } from "../email/mailer";
import { sanitizeTemplateHtml } from "../email/render";
import { localized, t } from "@/lib/i18n-text";
import type { CurrentStaff } from "../auth/session";

const lt = (max = 200) => localized({ max }).prefault({});
const hex = z.string().regex(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);

// ──────────────────────────────── Currencies ────────────────────────────────

export async function currencyList() {
  const rows = await db.currency.findMany({ orderBy: { position: "asc" } });
  return rows.map((c) => ({ ...c, name: c.name as Record<string, string>, symbol: c.symbol as Record<string, string> }));
}

const currencySchema = z.object({
  code: z.string().trim().toUpperCase().regex(/^[A-Z]{3}$/),
  name: localized({ required: true, max: 60 }),
  symbol: localized({ required: true, max: 8 }),
  decimals: z.number().int().min(0).max(4),
  symbolPosition: z.enum(["BEFORE", "AFTER"]),
  thousandsSep: z.string().max(2),
  decimalSep: z.string().min(1).max(2),
  rate: z.number().positive().max(1_000_000),
  isActive: z.boolean(),
  isBase: z.boolean(),
});

/**
 * Replace the currency table. Exactly one base currency (rate 1, always
 * active). The base currency's decimals can't change once orders exist,
 * because every stored amount is in its minor units.
 */
export async function saveCurrencies(raw: unknown, staff: CurrentStaff) {
  const list = z.array(currencySchema).min(1).max(30).parse(raw);
  const bases = list.filter((c) => c.isBase);
  if (bases.length !== 1) throw Errors.invalid({ base: ["exactly_one_base"] });
  const codes = new Set(list.map((c) => c.code));
  if (codes.size !== list.length) throw Errors.invalid({ code: ["duplicate"] });
  const currentBase = await db.currency.findFirst({ where: { isBase: true } });
  const hasOrders = (await db.order.count()) > 0;
  if (currentBase && hasOrders && (bases[0].code !== currentBase.code || bases[0].decimals !== currentBase.decimals)) throw Errors.conflict("base_locked");
  await db.$transaction(async (tx) => {
    await tx.currency.deleteMany({ where: { code: { notIn: [...codes] } } });
    for (const [position, c] of list.entries()) {
      const data = { ...c, rate: c.isBase ? 1 : c.rate, isActive: c.isBase ? true : c.isActive, position };
      await tx.currency.upsert({ where: { code: c.code }, create: data, update: data });
    }
  });
  invalidateCurrencies();
  await audit({ actor: staff, action: "currencies.updated", summary: list.map((c) => `${c.code}${c.isBase ? "*" : ""}:${c.rate}`).join(", ") });
}

// ───────────────────────────────── Shipping ─────────────────────────────────

export async function shippingZones() {
  const zones = await db.shippingZone.findMany({ orderBy: { position: "asc" }, include: { methods: { orderBy: { position: "asc" } } } });
  return zones.map((z) => ({
    id: z.id,
    name: z.name,
    countries: z.countries,
    isActive: z.isActive,
    methods: z.methods.map((m) => ({ id: m.id, name: m.name as Record<string, string>, description: m.description as Record<string, string>, type: m.type, cost: m.cost, freeOver: m.freeOver, perKg: m.perKg, minDays: m.minDays, maxDays: m.maxDays, isActive: m.isActive })),
  }));
}

const methodSchema = z
  .object({
    id: z.string().max(64).optional(),
    name: localized({ required: true, max: 80 }),
    description: lt(200),
    type: z.enum(["FLAT", "FREE", "FREE_OVER", "WEIGHT", "PICKUP"]),
    cost: z.number().int().min(0),
    freeOver: z.number().int().min(0).nullable(),
    perKg: z.number().int().min(0).nullable(),
    minDays: z.number().int().min(0).max(90).nullable(),
    maxDays: z.number().int().min(0).max(90).nullable(),
    isActive: z.boolean(),
  })
  .refine((m) => m.type !== "FREE_OVER" || (m.freeOver ?? 0) > 0, { path: ["freeOver"], message: "required" })
  .refine((m) => m.minDays == null || m.maxDays == null || m.minDays <= m.maxDays, { path: ["maxDays"], message: "min_gt_max" });

const zoneSchema = z.object({
  id: z.string().max(64).optional(),
  name: z.string().trim().min(1).max(80),
  countries: z.array(z.string().trim().toUpperCase().regex(/^[A-Z]{2}$/)).max(250),
  isActive: z.boolean(),
  methods: z.array(methodSchema).max(20),
});

export async function saveShipping(raw: unknown, staff: CurrentStaff) {
  const zones = z.array(zoneSchema).max(50).parse(raw);
  await db.$transaction(async (tx) => {
    const keepZones = zones.filter((z) => z.id).map((z) => z.id!);
    await tx.shippingZone.deleteMany({ where: { id: { notIn: keepZones } } });
    for (const [position, z] of zones.entries()) {
      const zoneData = { name: z.name, countries: z.countries, isActive: z.isActive, position };
      const zone = z.id && (await tx.shippingZone.findUnique({ where: { id: z.id } })) ? await tx.shippingZone.update({ where: { id: z.id }, data: zoneData }) : await tx.shippingZone.create({ data: zoneData });
      await tx.shippingMethod.deleteMany({ where: { zoneId: zone.id, id: { notIn: z.methods.filter((m) => m.id).map((m) => m.id!) } } });
      for (const [mp, m] of z.methods.entries()) {
        const { id, ...rest } = m;
        const data = { ...rest, position: mp, freeOver: m.type === "FREE_OVER" ? m.freeOver : null, perKg: m.type === "WEIGHT" ? m.perKg : null, cost: m.type === "FREE" ? 0 : m.cost };
        if (id && (await tx.shippingMethod.findFirst({ where: { id, zoneId: zone.id } }))) await tx.shippingMethod.update({ where: { id }, data });
        else await tx.shippingMethod.create({ data: { ...data, zoneId: zone.id } });
      }
    }
  });
  await audit({ actor: staff, action: "shipping.updated", summary: zones.map((z) => `${z.name} (${z.methods.length})`).join(", ") });
}

// ────────────────────────────── Order statuses ──────────────────────────────

export async function orderStatusList(locale: string) {
  const rows = await db.orderStatus.findMany({ orderBy: { position: "asc" }, include: { _count: { select: { orders: true } } } });
  return {
    statuses: rows.map((s) => ({ key: s.key, label: s.label as Record<string, string>, color: s.color, isSystem: s.isSystem, isFinal: s.isFinal, restocks: s.restocks, countsAsSale: s.countsAsSale, notifyCustomer: s.notifyCustomer, emailTemplate: s.emailTemplate, orders: s._count.orders })),
    templates: EMAIL_TEMPLATES.filter((d) => d.audience === "customer").map((d) => ({ key: d.key, name: t(d.subject, locale) })),
  };
}

const statusSchema = z.object({
  key: z.string().trim().toLowerCase().regex(/^[a-z][a-z0-9_]{1,30}$/),
  label: localized({ required: true, max: 60 }),
  color: hex,
  isFinal: z.boolean(),
  restocks: z.boolean(),
  countsAsSale: z.boolean(),
  notifyCustomer: z.boolean(),
  emailTemplate: z.string().max(60).nullable(),
});

/** Save the workflow. System statuses can't be removed; statuses in use can't be removed. */
export async function saveOrderStatuses(raw: unknown, staff: CurrentStaff) {
  const list = z.array(statusSchema).min(1).max(30).parse(raw);
  const current = await db.orderStatus.findMany({ include: { _count: { select: { orders: true } } } });
  const keys = new Set(list.map((s) => s.key));
  if (keys.size !== list.length) throw Errors.invalid({ key: ["duplicate"] });
  for (const s of current) {
    if (!keys.has(s.key) && (s.isSystem || s._count.orders > 0)) throw Errors.conflict(s.isSystem ? "system_status" : "status_in_use");
  }
  await db.$transaction(async (tx) => {
    await tx.orderStatus.deleteMany({ where: { key: { notIn: [...keys] }, isSystem: false } });
    for (const [position, s] of list.entries()) {
      const existing = current.find((c) => c.key === s.key);
      // System statuses keep their behavioural flags; only label/colour/notification are editable.
      const data = existing?.isSystem ? { label: s.label, color: s.color, notifyCustomer: s.notifyCustomer, emailTemplate: s.emailTemplate, position } : { ...s, position };
      await tx.orderStatus.upsert({ where: { key: s.key }, create: { ...s, position }, update: data });
    }
  });
  await audit({ actor: staff, action: "order_statuses.updated", summary: list.map((s) => s.key).join(" → ") });
}

// ───────────────────────────── Email templates ──────────────────────────────

export async function templateList() {
  const rows = await db.emailTemplate.findMany();
  return EMAIL_TEMPLATES.map((d) => {
    const row = rows.find((r) => r.key === d.key);
    return {
      key: d.key,
      audience: d.audience,
      variables: d.variables,
      subject: (row?.subject ?? d.subject) as Record<string, string>,
      body: (row?.body ?? d.body) as Record<string, string>,
      isEnabled: row?.isEnabled ?? true,
      customized: Boolean(row && (JSON.stringify(row.subject) !== JSON.stringify(d.subject) || JSON.stringify(row.body) !== JSON.stringify(d.body))),
      updatedAt: row?.updatedAt.toISOString() ?? null,
    };
  });
}

const templateSchema = z.object({ subject: localized({ required: true, max: 200 }), body: localized({ required: true, max: 50_000 }), isEnabled: z.boolean() });

export async function saveTemplate(key: string, raw: unknown, staff: CurrentStaff) {
  if (!templateDef(key)) throw Errors.notFound("template");
  const p = templateSchema.parse(raw);
  // Stored sanitised, so even a direct DB read never yields unsafe markup.
  const body = Object.fromEntries(Object.entries(p.body).map(([l, v]) => [l, sanitizeTemplateHtml(v ?? "")]));
  await db.emailTemplate.upsert({ where: { key }, create: { key, subject: p.subject, body, isEnabled: p.isEnabled }, update: { subject: p.subject, body, isEnabled: p.isEnabled } });
  await audit({ actor: staff, action: "email_template.updated", entityType: "email_template", entityId: key, summary: key });
}

export async function resetTemplate(key: string, staff: CurrentStaff) {
  const def = templateDef(key);
  if (!def) throw Errors.notFound("template");
  await db.emailTemplate.upsert({ where: { key }, create: { key, subject: def.subject, body: def.body, isEnabled: true }, update: { subject: def.subject, body: def.body } });
  await audit({ actor: staff, action: "email_template.reset", entityType: "email_template", entityId: key, summary: key });
}

/** Sample values so previews look like a real message. */
const SAMPLE: Record<string, string> = {
  customer_name: "Sara",
  order_number: "NQ-100245",
  order_total: "349.500 JOD",
  order_status: "Shipped",
  payment_method: "Cash on delivery",
  tracking_number: "JO123456789",
  code: "482913",
  minutes: "10",
  product_name: "iPhone 17 Pro",
  points: "350",
};

export async function previewTemplate(key: string, locale: string, override: { subject: string; body: string }) {
  if (!templateDef(key)) throw Errors.notFound("template");
  const base = process.env.APP_URL ?? "http://localhost:3000";
  return renderTemplate({
    template: key,
    locale,
    vars: { ...SAMPLE, order_url: `${base}/account/orders/NQ-100245` },
    blocks: {
      order_items_block:
        '<table role="presentation" width="100%" style="margin:16px 0;border-collapse:collapse;font-size:14px"><tr><td style="padding:6px 0">iPhone 17 Pro · 256GB × 1</td><td style="padding:6px 0;text-align:end">349.500</td></tr></table>',
    },
    action: { label: locale === "ar" ? "عرض الطلب" : "View order", url: `${base}/account/orders` },
    override,
  });
}

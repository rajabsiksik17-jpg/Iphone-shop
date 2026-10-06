import { db } from "@/server/db";
import { getCurrentStaff } from "@/server/auth/session";
import { hasPermission } from "@/config/permissions";
import { getManySettings } from "@/server/settings/service";
import { formatBase } from "@/server/commerce/currency";
import { escapeHtml } from "@/server/email/render";
import { t } from "@/lib/i18n-text";

export const dynamic = "force-dynamic";

/** Printable, bilingual-aware invoice (HTML + print stylesheet → "Save as PDF"). */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const staff = await getCurrentStaff();
  if (!staff || !hasPermission(staff.permissions, "orders.view")) return new Response("Forbidden", { status: 403 });
  const locale = new URL(req.url).searchParams.get("locale") === "ar" ? "ar" : "en";
  const o = await db.order.findUnique({ where: { id: (await params).id }, include: { items: true, discounts: true } });
  if (!o) return new Response("Not found", { status: 404 });
  const { store, contact } = await getManySettings(["store", "contact"]);
  const f = (n: number) => formatBase(n, locale);
  const a = o.shippingAddress as Record<string, string>;
  const L = (en: string, ar: string) => (locale === "ar" ? ar : en);
  const rows = await Promise.all(
    o.items.map(async (i) => `<tr><td>${escapeHtml(t(i.name, locale))}${i.variantLabel ? `<br><small>${escapeHtml(t(i.variantLabel, locale))}</small>` : ""}</td><td>${escapeHtml(i.sku ?? "")}</td><td class="n">${i.quantity}</td><td class="n">${escapeHtml(await f(i.unitPrice))}</td><td class="n">${escapeHtml(await f(i.total))}</td></tr>`),
  );
  const discounts = await Promise.all(o.discounts.map(async (d) => `<tr><td colspan="4">${escapeHtml(t(d.label, locale) || d.code || "")}</td><td class="n">-${escapeHtml(await f(d.amount))}</td></tr>`));
  const html = `<!doctype html><html lang="${locale}" dir="${locale === "ar" ? "rtl" : "ltr"}"><head><meta charset="utf-8"><title>${escapeHtml(o.number)}</title>
<style>body{font-family:system-ui,-apple-system,"Segoe UI",Tahoma,sans-serif;color:#111;margin:40px;font-size:14px}h1{font-size:22px;margin:0}table{width:100%;border-collapse:collapse;margin-top:24px}th,td{padding:8px;border-bottom:1px solid #e5e7eb;text-align:start;vertical-align:top}th{font-size:12px;color:#6b7280;text-transform:uppercase}.n{text-align:end;white-space:nowrap}.grid{display:flex;justify-content:space-between;gap:32px;margin-top:24px}.muted{color:#6b7280}.tot td{border:0}.grand td{font-weight:700;font-size:16px;border-top:2px solid #111}@media print{body{margin:16px}button{display:none}}</style></head><body>
<button onclick="print()" style="float:inline-end;padding:8px 14px">${L("Print / Save PDF", "طباعة / حفظ PDF")}</button>
<h1>${escapeHtml(t(store.name, locale))}</h1><p class="muted">${escapeHtml(t(store.address, locale) || t(contact.address, locale))}<br>${escapeHtml(store.email || contact.email)} ${store.taxNumber ? `· ${L("Tax no.", "الرقم الضريبي")} ${escapeHtml(store.taxNumber)}` : ""}</p>
<div class="grid"><div><strong>${L("Invoice", "فاتورة")} ${escapeHtml(o.number)}</strong><br><span class="muted">${o.placedAt.toLocaleDateString(locale === "ar" ? "ar-JO" : "en-GB", { dateStyle: "long" })}</span></div>
<div><strong>${L("Bill to", "إلى")}</strong><br>${escapeHtml(a.fullName ?? o.customerName)}<br>${escapeHtml(a.line1 ?? "")} ${escapeHtml(a.line2 ?? "")}<br>${escapeHtml([a.area, a.city, a.country].filter(Boolean).join(", "))}<br><span dir="ltr">${escapeHtml(o.phone)}</span><br>${escapeHtml(o.email)}</div></div>
<table><thead><tr><th>${L("Item", "المنتج")}</th><th>SKU</th><th class="n">${L("Qty", "الكمية")}</th><th class="n">${L("Price", "السعر")}</th><th class="n">${L("Total", "الإجمالي")}</th></tr></thead><tbody>${rows.join("")}</tbody>
<tbody class="tot"><tr><td colspan="4">${L("Subtotal", "المجموع الفرعي")}</td><td class="n">${escapeHtml(await f(o.subtotal))}</td></tr>${discounts.join("")}<tr><td colspan="4">${L("Shipping", "الشحن")}</td><td class="n">${escapeHtml(await f(o.shippingTotal))}</td></tr>${o.taxTotal ? `<tr><td colspan="4">${L("Tax", "الضريبة")}</td><td class="n">${escapeHtml(await f(o.taxTotal))}</td></tr>` : ""}<tr class="grand"><td colspan="4">${L("Total", "الإجمالي")}</td><td class="n">${escapeHtml(await f(o.total))}</td></tr></tbody></table>
<p class="muted" style="margin-top:32px">${L("Payment", "الدفع")}: ${escapeHtml(o.paymentMethod)} · ${escapeHtml(o.paymentStatus)}</p></body></html>`;
  return new Response(html, { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store", "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'" } });
}

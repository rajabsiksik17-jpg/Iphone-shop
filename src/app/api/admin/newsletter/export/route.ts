import { db } from "@/server/db";
import { getCurrentStaff } from "@/server/auth/session";
import { hasPermission } from "@/config/permissions";
import { audit } from "@/server/audit";

export const dynamic = "force-dynamic";

/** CSV of active subscribers. Contains email addresses, so it also requires customers.pii. */
export async function GET() {
  const staff = await getCurrentStaff();
  if (!staff || !hasPermission(staff.permissions, "marketing.manage") || !hasPermission(staff.permissions, "customers.pii")) return new Response("Forbidden", { status: 403 });
  const rows = await db.newsletterSubscriber.findMany({ where: { status: "subscribed" }, orderBy: { createdAt: "desc" }, take: 50_000 });
  const cell = (v: unknown) => {
    let s = String(v ?? "");
    if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = rows.map((r) => [r.email, r.locale, r.source, r.createdAt.toISOString()].map(cell).join(","));
  await audit({ actor: staff, action: "newsletter.exported", summary: `${rows.length} subscribers exported` });
  return new Response(`﻿${["email,locale,source,subscribed_at", ...lines].join("\n")}`, {
    headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="subscribers-${new Date().toISOString().slice(0, 10)}.csv"`, "Cache-Control": "no-store" },
  });
}

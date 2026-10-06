import { adminPage } from "@/server/admin/guard";
import { dashboardReport, type RangeKey } from "@/server/analytics/report";
import { getManySettings } from "@/server/settings/service";
import { db } from "@/server/db";
import { DashboardView } from "@/components/admin/dashboard-view";
import { Forbidden } from "@/components/admin/ui";

export const metadata = { title: "Dashboard" };

const RANGES: RangeKey[] = ["today", "yesterday", "7d", "30d", "90d", "month", "lastMonth", "custom"];

export default async function AdminDashboard({ searchParams }: { searchParams: Promise<{ range?: string; from?: string; to?: string }> }) {
  const { allowed, locale } = await adminPage("dashboard.view");
  if (!allowed) return <Forbidden />;
  const sp = await searchParams;
  const range = (RANGES.includes(sp.range as RangeKey) ? sp.range : "30d") as RangeKey;
  const [report, settings, onlinePayments, ga] = await Promise.all([
    dashboardReport(range, locale, { from: sp.from, to: sp.to }),
    getManySettings(["email", "store", "security"]),
    db.integration.count({ where: { category: "payments", isEnabled: true, key: { in: ["stripe", "paypal"] }, status: "CONNECTED" } }),
    db.integration.findUnique({ where: { key: "google_analytics" }, select: { isEnabled: true } }),
  ]);
  // Honest setup checklist derived from real configuration state.
  const setup = [
    { key: "dash.setup.smtp" as const, done: Boolean(settings.email.smtpStatus?.ok), href: "/admin/settings/email" },
    { key: "dash.setup.payments" as const, done: onlinePayments > 0, href: "/admin/integrations?category=payments" },
    { key: "dash.setup.analytics" as const, done: Boolean(ga?.isEnabled), href: "/admin/integrations?category=analytics" },
    { key: "dash.setup.logo" as const, done: Boolean(settings.store.logoUrl), href: "/admin/settings/store" },
    { key: "dash.setup.otp" as const, done: settings.security.adminOtp.enabled, href: "/admin/settings/security" },
  ];
  return <DashboardView report={report} setup={setup} />;
}

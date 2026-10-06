import { adminPage } from "@/server/admin/guard";
import { dashboardReport, analyticsExtras, type RangeKey } from "@/server/analytics/report";
import { AnalyticsView } from "@/components/admin/analytics-view";
import { Forbidden } from "@/components/admin/ui";

export const metadata = { title: "Analytics" };

const RANGES: RangeKey[] = ["today", "yesterday", "7d", "30d", "90d", "month", "lastMonth", "custom"];

export default async function AnalyticsPage({ searchParams }: { searchParams: Promise<{ range?: string; from?: string; to?: string }> }) {
  const { allowed, locale } = await adminPage("analytics.view");
  if (!allowed) return <Forbidden />;
  const sp = await searchParams;
  const range = (RANGES.includes(sp.range as RangeKey) ? sp.range : "30d") as RangeKey;
  const custom = { from: sp.from, to: sp.to };
  const [report, extras] = await Promise.all([dashboardReport(range, locale, custom), analyticsExtras(range, locale, custom)]);
  // The CSV export uses the same window as the report.
  const rangeQuery = new URLSearchParams({ from: report.range.start.slice(0, 10), to: new Date(new Date(report.range.end).getTime() - 1).toISOString().slice(0, 10) }).toString();
  return <AnalyticsView report={report} extras={extras} rangeQuery={rangeQuery} />;
}

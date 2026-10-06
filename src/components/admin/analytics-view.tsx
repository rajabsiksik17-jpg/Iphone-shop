"use client";

import { BarChart3, ExternalLink, Laptop, Smartphone, Tablet, Search, SearchX, Plug } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { useAdmin } from "./admin-context";
import { PageHeader, Panel, StatCard, AdminEmpty } from "./ui";
import { RangePicker } from "./range-picker";
import { RevenueChart, OrdersChart, SimpleBars, Funnel } from "./charts";
import type { DashboardReport, analyticsExtras } from "@/server/analytics/report";

type Extras = Awaited<ReturnType<typeof analyticsExtras>>;

/** Proportional bar rows for ranked lists (categories, brands, referrers…). */
function RankList({ rows, format, empty }: { rows: { key: string; label: React.ReactNode; value: number }[]; format?: (v: number) => string; empty?: React.ReactNode }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  if (!rows.length) return <>{empty ?? <AdminEmpty />}</>;
  return (
    <ul className="space-y-2.5">
      {rows.map((r) => (
        <li key={r.key}>
          <div className="mb-1 flex items-center justify-between gap-3 text-[13px]">
            <span className="min-w-0 truncate">{r.label}</span>
            <span className="tabular shrink-0 font-medium">{format ? format(r.value) : r.value.toLocaleString()}</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-ad-sunken">
            <div className="h-full rounded-full bg-ad-accent/80" style={{ width: `${(r.value / max) * 100}%` }} />
          </div>
        </li>
      ))}
    </ul>
  );
}

const METHOD_LABEL: Record<string, [string, string]> = { cod: ["Cash on delivery", "الدفع عند الاستلام"], bank_transfer: ["Bank transfer", "تحويل بنكي"], stripe: ["Card (Stripe)", "بطاقة (Stripe)"], paypal: ["PayPal", "PayPal"], store_pickup: ["Pay at pickup", "الدفع عند الاستلام من المتجر"] };

export function AnalyticsView({ report, extras, rangeQuery }: { report: DashboardReport; extras: Extras; rangeQuery: string }) {
  const { t, fmt, locale } = useAdmin();
  const ar = locale === "ar";
  const k = report.kpis;
  const deviceIcon = (d: string) => (d === "mobile" ? <Smartphone className="size-3.5" /> : d === "tablet" ? <Tablet className="size-3.5" /> : <Laptop className="size-3.5" />);
  const host = (r: string | null) => {
    if (!r) return t("an.direct");
    try {
      return new URL(r).hostname.replace(/^www\./, "");
    } catch {
      return r;
    }
  };

  return (
    <>
      <PageHeader
        title={t("an.title")}
        description={t("an.firstParty")}
        actions={
          <>
            <RangePicker />
            <Button asChild size="sm" variant="outline">
              <a href={`/api/admin/orders/export?${rangeQuery}`}>{t("c.export")}</a>
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-7">
        <StatCard label={t("dash.revenue")} value={fmt(k.revenue.value)} delta={k.revenue.delta} />
        <StatCard label={t("dash.netRevenue")} value={fmt(k.netRevenue.value)} delta={k.netRevenue.delta} />
        <StatCard label={t("dash.orders")} value={k.orders.value.toLocaleString()} delta={k.orders.delta} />
        <StatCard label={t("dash.aov")} value={fmt(k.aov.value)} delta={k.aov.delta} />
        <StatCard label={t("dash.customers")} value={k.customers.value.toLocaleString()} delta={k.customers.delta} />
        <StatCard label={t("dash.visitors")} value={k.visitors.value.toLocaleString()} delta={k.visitors.delta} />
        <StatCard label={t("dash.conversion")} value={`${k.conversion.value.toFixed(2)}%`} delta={k.conversion.delta} />
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-3">
        <Panel title={t("dash.salesOverTime")} className="xl:col-span-2">
          <RevenueChart data={report.series} />
        </Panel>
        <Panel title={t("dash.funnel")}>
          <Funnel
            steps={[
              { label: t("dash.funnel.visitors"), value: report.funnel.visitors },
              { label: t("dash.funnel.views"), value: report.funnel.views },
              { label: t("dash.funnel.carts"), value: report.funnel.carts },
              { label: t("dash.funnel.checkouts"), value: report.funnel.checkouts },
              { label: t("dash.funnel.purchases"), value: report.funnel.purchases },
            ]}
          />
        </Panel>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
        <Panel title={t("dash.ordersOverTime")}>
          <OrdersChart data={report.series} />
        </Panel>
        <Panel title={t("an.revenueByMethod")}>
          <RankList rows={report.byMethod.map((m) => ({ key: m.method, label: `${(METHOD_LABEL[m.method] ?? [m.method, m.method])[ar ? 1 : 0]} · ${m.orders}`, value: m.revenue }))} format={fmt} />
        </Panel>
        <Panel title={t("an.customersGrowth")}>
          {extras.growth.length ? <SimpleBars data={extras.growth.map((g) => ({ label: g.date, value: g.customers }))} valueLabel={t("dash.customers")} /> : <AdminEmpty />}
        </Panel>
        <Panel title={t("dash.topProducts")} padded={false}>
          {report.topProducts.length ? (
            <ul className="divide-y divide-ad-border">
              {report.topProducts.map((p) => (
                <li key={p.id}>
                  <Link href={`/admin/products/${p.id}`} className="flex items-center gap-3 px-5 py-2.5 hover:bg-ad-hover">
                    {p.image ? <img src={p.image} alt="" className="size-9 rounded-lg object-cover" /> : <span className="size-9 rounded-lg bg-ad-sunken" />}
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px] font-medium">{p.name}</span>
                      <span className="text-xs text-ad-muted">{t("dash.units", { n: p.units })}</span>
                    </span>
                    <span className="tabular text-[13px] font-semibold">{fmt(p.revenue)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <AdminEmpty />
          )}
        </Panel>
        <Panel title={t("dash.topCategories")}>
          <RankList rows={report.topCategories.map((c) => ({ key: c.id, label: c.name, value: c.revenue }))} format={fmt} />
        </Panel>
        <Panel title={t("dash.topBrands")}>
          <RankList rows={report.topBrands.map((b) => ({ key: b.id, label: b.name, value: b.revenue }))} format={fmt} />
        </Panel>
        <Panel title={t("an.devices")}>
          <RankList
            rows={extras.devices.map((d) => ({
              key: d.device,
              label: (
                <span className="flex items-center gap-2 capitalize">
                  {deviceIcon(d.device)} {d.device}
                </span>
              ),
              value: d.visitors,
            }))}
          />
        </Panel>
        <Panel title={t("an.referrers")}>
          <RankList rows={extras.referrers.map((r, i) => ({ key: `${r.referrer}-${i}`, label: host(r.referrer), value: r.visitors }))} />
        </Panel>
        <Panel title={t("an.searches")}>
          <RankList
            rows={extras.searches.map((s) => ({
              key: s.term,
              label: (
                <span className="flex items-center gap-2">
                  <Search className="size-3.5 text-ad-muted" /> {s.term}
                </span>
              ),
              value: s.count,
            }))}
          />
        </Panel>
        <Panel title={t("an.zeroResults")} description={ar ? "فرص لإضافة منتجات أو مرادفات" : "Opportunities for new products or synonyms"}>
          <RankList
            rows={extras.zeroResults.map((s) => ({
              key: s.term,
              label: (
                <span className="flex items-center gap-2">
                  <SearchX className="size-3.5 text-red-500" /> {s.term}
                </span>
              ),
              value: s.count,
            }))}
            empty={<p className="py-6 text-center text-sm text-ad-muted">{ar ? "لا توجد عمليات بحث فاشلة 🎉" : "No failed searches 🎉"}</p>}
          />
        </Panel>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Panel title={t("an.ga")}>
          {extras.ga?.data.daily?.length ? (
            <>
              <SimpleBars data={extras.ga.data.daily.map((d) => ({ label: d.date, value: d.users }))} valueLabel="Users" />
              <p className="mt-2 text-xs text-ad-muted">
                {ar ? "آخر مزامنة" : "Last synced"} {new Date(extras.ga.syncedAt).toLocaleString(locale)}
              </p>
            </>
          ) : (
            <ConnectCta category="analytics" text={ar ? "اربط Google Analytics 4 لعرض المستخدمين والجلسات هنا." : "Connect Google Analytics 4 to see users and sessions here."} />
          )}
        </Panel>
        <Panel title="Google Search Console">
          {extras.gsc?.data.queries?.length ? (
            <div className="overflow-x-auto">
              <table className="w-full text-[13px]">
                <thead>
                  <tr className="text-xs text-ad-muted">
                    <th className="py-1.5 text-start font-medium">{ar ? "عبارة البحث" : "Query"}</th>
                    <th className="py-1.5 text-end font-medium">{ar ? "نقرات" : "Clicks"}</th>
                    <th className="py-1.5 text-end font-medium">{ar ? "ظهور" : "Impr."}</th>
                    <th className="py-1.5 text-end font-medium">{ar ? "الترتيب" : "Pos."}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-ad-border">
                  {extras.gsc.data.queries.slice(0, 10).map((q) => (
                    <tr key={q.key}>
                      <td className="max-w-[16rem] truncate py-1.5">{q.key}</td>
                      <td className="tabular py-1.5 text-end">{q.clicks}</td>
                      <td className="tabular py-1.5 text-end">{q.impressions}</td>
                      <td className="tabular py-1.5 text-end">{q.position.toFixed(1)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <ConnectCta category="search" text={ar ? "اربط Search Console لعرض عبارات البحث والنقرات." : "Connect Search Console to see search queries and clicks."} />
          )}
        </Panel>
      </div>
    </>
  );
}

function ConnectCta({ category, text }: { category: string; text: string }) {
  const { locale } = useAdmin();
  return (
    <div className="flex flex-col items-center gap-3 py-8 text-center">
      <span className="grid size-11 place-items-center rounded-xl bg-ad-sunken text-ad-muted">
        <BarChart3 className="size-5" />
      </span>
      <p className="max-w-xs text-sm text-ad-muted">{text}</p>
      <Button asChild size="sm" variant="outline" leftIcon={<Plug />} rightIcon={<ExternalLink />}>
        <Link href={`/admin/integrations?category=${category}`}>{locale === "ar" ? "التكاملات" : "Integrations"}</Link>
      </Button>
    </div>
  );
}

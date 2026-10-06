"use client";

import { useEffect } from "react";
import { DollarSign, ShoppingBag, Users, Percent, Receipt, Eye, ChevronRight, AlertTriangle, MessagesSquare, Star, Inbox, PackageX, CheckCircle2, Circle } from "lucide-react";
import { useRouter } from "@/i18n/navigation";
import { Link } from "@/i18n/navigation";
import { useAdmin } from "./admin-context";
import { PageHeader, Panel, StatCard, ColorPill, Pill } from "./ui";
import { RangePicker } from "./range-picker";
import { RevenueChart, OrdersChart, Funnel } from "./charts";
import { timeAgo } from "@/lib/time";
import type { DashboardReport } from "@/server/analytics/report";
import type { AdminKey } from "@/admin/i18n";

export function DashboardView({ report, setup }: { report: DashboardReport; setup: { key: AdminKey; done: boolean; href: string }[] }) {
  const { t, fmt, user, counters, socket, locale, can } = useAdmin();
  const router = useRouter();

  // Live dashboard: new orders/payments refresh the numbers in place.
  useEffect(() => {
    if (!socket) return;
    const onNotif = (n: { event?: string }) => {
      if (n.event === "ORDER_CREATED" || n.event === "ORDER_PAID") router.refresh();
    };
    socket.on("notification:new", onNotif);
    return () => void socket.off("notification:new", onNotif);
  }, [socket, router]);

  const hour = new Date().getHours();
  const greet = hour < 12 ? "dash.greeting.morning" : hour < 18 ? "dash.greeting.afternoon" : "dash.greeting.evening";
  const k = report.kpis;
  const attention = [
    { n: counters.orders, key: "dash.pendingOrders" as const, href: "/admin/orders?status=open", icon: ShoppingBag, show: can("orders.view") },
    { n: counters.chats, key: "dash.waitingChats" as const, href: "/admin/chat", icon: MessagesSquare, show: can("support.chat") },
    { n: counters.reviews, key: "dash.pendingReviews" as const, href: "/admin/reviews?status=PENDING", icon: Star, show: can("reviews.moderate") },
    { n: counters.messages, key: "dash.newMessages" as const, href: "/admin/messages", icon: Inbox, show: can("support.messages") },
    { n: counters.inventory, key: "dash.lowStockItems" as const, href: "/admin/inventory?filter=low", icon: PackageX, show: can("inventory.manage") },
  ].filter((a) => a.show && a.n > 0);
  const pendingSetup = setup.filter((s) => !s.done);

  return (
    <>
      <PageHeader title={t(greet, { name: user.name.split(" ")[0] })} description={t("dash.subtitle")} actions={<RangePicker />} />

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <StatCard label={t("dash.revenue")} value={fmt(k.revenue.value)} delta={k.revenue.delta} icon={<DollarSign />} />
        <StatCard label={t("dash.orders")} value={k.orders.value.toLocaleString()} delta={k.orders.delta} icon={<ShoppingBag />} />
        <StatCard label={t("dash.aov")} value={fmt(k.aov.value)} delta={k.aov.delta} icon={<Receipt />} />
        <StatCard label={t("dash.conversion")} value={`${k.conversion.value.toFixed(2)}%`} delta={k.conversion.delta} icon={<Percent />} />
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-3">
        <Panel
          className="xl:col-span-2"
          title={t("dash.salesOverTime")}
          actions={
            <span className="tabular text-xs text-ad-muted">
              {t("dash.netRevenue")}: <b className="text-ad-fg">{fmt(k.netRevenue.value)}</b>
            </span>
          }
        >
          <RevenueChart data={report.series} />
        </Panel>
        <Panel title={t("dash.needsAttention")}>
          {attention.length ? (
            <ul className="space-y-2">
              {attention.map((a) => (
                <li key={a.key}>
                  <Link href={a.href} className="flex items-center gap-3 rounded-lg border border-ad-border px-3 py-2.5 text-sm transition hover:bg-ad-hover">
                    <span className="grid size-8 place-items-center rounded-lg bg-amber-500/10 text-amber-600">
                      <a.icon className="size-4" />
                    </span>
                    <span className="flex-1">{t(a.key, { n: a.n })}</span>
                    <ChevronRight className="flip-rtl size-4 text-ad-muted" />
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="flex items-center gap-2 py-6 text-sm text-ad-muted">
              <CheckCircle2 className="size-5 text-emerald-500" /> {t("dash.allGood")}
            </p>
          )}
          {pendingSetup.length > 0 && (
            <div className="mt-5 border-t border-ad-border pt-4">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-ad-muted">{t("dash.setup")}</p>
              <ul className="space-y-1">
                {setup.map((s) => (
                  <li key={s.key}>
                    <Link href={s.href} className="flex items-center gap-2.5 rounded-lg px-2 py-1.5 text-[13px] hover:bg-ad-hover">
                      {s.done ? <CheckCircle2 className="size-4 text-emerald-500" /> : <Circle className="size-4 text-ad-muted" />}
                      <span className={s.done ? "text-ad-muted line-through" : ""}>{t(s.key)}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Panel>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Panel title={t("dash.ordersOverTime")} className="lg:col-span-2">
          <OrdersChart data={report.series} />
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
          <div className="mt-5 grid grid-cols-2 gap-3 border-t border-ad-border pt-4 text-xs">
            <div>
              <p className="text-ad-muted">{t("dash.visitors")}</p>
              <p className="tabular text-lg font-semibold">{k.visitors.value.toLocaleString()}</p>
            </div>
            <div>
              <p className="text-ad-muted">{t("dash.customers")}</p>
              <p className="tabular flex items-center gap-1.5 text-lg font-semibold">
                <Users className="size-4 text-ad-muted" />
                {k.customers.value}
              </p>
            </div>
          </div>
        </Panel>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
        <Panel title={t("dash.recentOrders")} padded={false} actions={<Link href="/admin/orders" className="text-xs text-ad-muted hover:text-ad-fg">{t("c.view")}</Link>} className="xl:col-span-2">
          <ul className="divide-y divide-ad-border">
            {report.recentOrders.map((o) => (
              <li key={o.id}>
                <Link href={`/admin/orders/${o.id}`} className="flex items-center gap-3 px-5 py-3 text-[13.5px] transition hover:bg-ad-hover">
                  <span className="w-24 shrink-0 font-medium">{o.number}</span>
                  <span className="min-w-0 flex-1 truncate text-ad-muted">{o.customer}</span>
                  <ColorPill label={o.status.label} color={o.status.color} />
                  <span className="tabular hidden w-24 text-end font-medium sm:block">{fmt(o.total)}</span>
                  <span className="hidden w-24 text-end text-xs text-ad-muted md:block">{timeAgo(o.placedAt, locale)}</span>
                </Link>
              </li>
            ))}
          </ul>
        </Panel>
        <Panel title={t("dash.topProducts")} padded={false}>
          <ul className="divide-y divide-ad-border">
            {report.topProducts.map((p, i) => (
              <li key={p.id}>
                <Link href={`/admin/products/${p.id}`} className="flex items-center gap-3 px-5 py-2.5 transition hover:bg-ad-hover">
                  <span className="tabular w-4 text-xs text-ad-muted">{i + 1}</span>
                  {p.image ? <img src={p.image} alt="" className="size-9 rounded-lg bg-ad-sunken object-cover" /> : <span className="size-9 rounded-lg bg-ad-sunken" />}
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] font-medium">{p.name}</span>
                    <span className="text-xs text-ad-muted">{t("dash.units", { n: p.units })}</span>
                  </span>
                  <span className="tabular text-[13px] font-semibold">{fmt(p.revenue)}</span>
                </Link>
              </li>
            ))}
            {!report.topProducts.length && <li className="px-5 py-8 text-center text-sm text-ad-muted">{t("c.empty")}</li>}
          </ul>
        </Panel>
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {(
          [
            ["dash.topCategories", report.topCategories],
            ["dash.topBrands", report.topBrands],
          ] as const
        ).map(([title, list]) => {
          const max = Math.max(1, ...list.map((x) => x.revenue));
          return (
            <Panel key={title} title={t(title)}>
              <ul className="space-y-3">
                {list.map((x) => (
                  <li key={x.id}>
                    <div className="mb-1 flex justify-between text-[13px]">
                      <span className="truncate">{x.name}</span>
                      <span className="tabular font-medium">{fmt(x.revenue)}</span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-ad-sunken">
                      <div className="h-full rounded-full bg-ad-accent/80" style={{ width: `${(x.revenue / max) * 100}%` }} />
                    </div>
                  </li>
                ))}
                {!list.length && <li className="py-6 text-center text-sm text-ad-muted">{t("c.empty")}</li>}
              </ul>
            </Panel>
          );
        })}
        <Panel title={t("dash.lowStock")} padded={false} actions={<Link href="/admin/inventory" className="text-xs text-ad-muted hover:text-ad-fg">{t("c.view")}</Link>}>
          <ul className="divide-y divide-ad-border">
            {report.lowStock.map((p) => (
              <li key={p.id}>
                <Link href={`/admin/products/${p.id}?tab=inventory`} className="flex items-center gap-3 px-5 py-2.5 hover:bg-ad-hover">
                  {p.image ? <img src={p.image} alt="" className="size-8 rounded-md bg-ad-sunken object-cover" /> : <span className="size-8 rounded-md bg-ad-sunken" />}
                  <span className="min-w-0 flex-1 truncate text-[13px]">{p.name}</span>
                  <Pill tone={p.status === "OUT_OF_STOCK" ? "red" : "amber"}>
                    {p.status === "OUT_OF_STOCK" ? <AlertTriangle className="size-3" /> : null}
                    {p.stock}
                  </Pill>
                </Link>
              </li>
            ))}
            {!report.lowStock.length && <li className="px-5 py-8 text-center text-sm text-ad-muted">{t("dash.allGood")}</li>}
          </ul>
        </Panel>
        <Panel title={t("dash.recentCustomers")} padded={false}>
          <ul className="divide-y divide-ad-border">
            {report.recentCustomers.map((c) => (
              <li key={c.id}>
                <Link href={`/admin/customers/${c.id}`} className="flex items-center gap-3 px-5 py-2.5 hover:bg-ad-hover">
                  <span className="grid size-8 place-items-center rounded-full bg-ad-sunken text-xs font-semibold">{c.name.slice(0, 1)}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] font-medium">{c.name}</span>
                    <span className="text-xs text-ad-muted">{timeAgo(c.createdAt, locale)}</span>
                  </span>
                  <span className="text-xs text-ad-muted">{t("o.ordersBy", { n: c.orders })}</span>
                </Link>
              </li>
            ))}
          </ul>
        </Panel>
      </div>
      <p className="mt-6 flex items-center gap-1.5 text-xs text-ad-muted">
        <Eye className="size-3.5" /> {t("an.firstParty")}
      </p>
    </>
  );
}

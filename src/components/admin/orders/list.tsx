"use client";

import { useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { Download } from "lucide-react";
import { useRouter } from "@/i18n/navigation";
import { useAdmin } from "../admin-context";
import { PageHeader, Panel, DataTable, FilterTabs, SearchBox, Pager, ColorPill, Pill } from "../ui";
import { Select } from "../fields";
import { usePathname } from "@/i18n/navigation";
import { timeAgo, fmtDate } from "@/lib/time";
import type { listOrders } from "@/server/admin/orders";

type Data = Awaited<ReturnType<typeof listOrders>>;

export const PAY_TONE: Record<string, "green" | "amber" | "red" | "neutral" | "blue" | "violet"> = { PAID: "green", PENDING: "amber", UNPAID: "neutral", FAILED: "red", REFUNDED: "violet", PARTIALLY_REFUNDED: "violet", AUTHORIZED: "blue" };

export function OrdersList({ data }: { data: Data }) {
  const { t, fmt, locale, socket } = useAdmin();
  const router = useRouter();
  const sp = useSearchParams();
  const pathname = usePathname();

  // New orders appear without a manual refresh.
  useEffect(() => {
    if (!socket) return;
    const on = (p: { keys: string[] }) => p.keys.includes("orders") && router.refresh();
    socket.on("counters:invalidate", on);
    return () => void socket.off("counters:invalidate", on);
  }, [socket, router]);

  const setParam = (k: string, v: string) => {
    const p = new URLSearchParams(sp.toString());
    if (v) p.set(k, v);
    else p.delete(k);
    p.delete("page");
    router.push(`${pathname}?${p.toString()}`);
  };

  return (
    <>
      <PageHeader
        title={t("o.title")}
        actions={
          <a href={`/api/admin/orders/export?${sp.toString()}`} className="flex h-9 items-center gap-2 rounded-lg border border-ad-border bg-ad-panel px-3 text-[13px] font-medium hover:bg-ad-hover">
            <Download className="size-4" /> {t("c.export")}
          </a>
        }
      />
      <div className="mb-4">
        <FilterTabs
          param="status"
          options={[
            { value: "", label: t("c.all"), count: data.allCount },
            { value: "open", label: locale === "ar" ? "بحاجة لإجراء" : "Needs action", count: data.openCount },
            ...data.statuses.map((s) => ({ value: s.key, label: s.label, count: s.count })),
          ]}
        />
      </div>
      <Panel padded={false}>
        <div className="flex flex-col gap-2 border-b border-ad-border p-3 sm:flex-row sm:items-center">
          <SearchBox placeholder={locale === "ar" ? "رقم الطلب، الاسم، البريد، الهاتف، SKU…" : "Order #, name, email, phone, SKU…"} />
          <div className="grid grid-cols-2 gap-2 sm:ms-auto sm:flex">
            <Select value={sp.get("payment") ?? ""} onChange={(e) => setParam("payment", e.target.value)} aria-label={t("o.payment")} className="h-9 text-[13px]">
              <option value="">{t("o.payment")}: {t("c.all")}</option>
              {["UNPAID", "PENDING", "PAID", "FAILED", "PARTIALLY_REFUNDED", "REFUNDED"].map((s) => (
                <option key={s} value={s}>
                  {t(`o.pay.${s}` as "o.pay.PAID")}
                </option>
              ))}
            </Select>
            <input type="date" value={sp.get("from") ?? ""} onChange={(e) => setParam("from", e.target.value)} className="h-9 rounded-lg border border-ad-border bg-ad-panel px-2 text-[13px]" aria-label={t("c.from")} />
          </div>
        </div>
        <DataTable
          rows={data.rows}
          href={(r) => `/admin/orders/${r.id}`}
          columns={[
            { key: "number", header: t("o.number"), cell: (r) => <span className="font-medium">{r.number}</span> },
            { key: "date", header: t("c.date"), cell: (r) => <span className="text-ad-muted" title={fmtDate(r.placedAt, locale, true)}>{timeAgo(r.placedAt, locale)}</span> },
            {
              key: "customer",
              header: t("o.customer"),
              cell: (r) => (
                <div className="min-w-0">
                  <p className="truncate">{r.customer}</p>
                  <p className="truncate text-xs text-ad-muted">{r.email}</p>
                </div>
              ),
            },
            { key: "payment", header: t("o.payment"), cell: (r) => <Pill tone={PAY_TONE[r.paymentStatus]}>{t(`o.pay.${r.paymentStatus}` as "o.pay.PAID")}</Pill> },
            { key: "status", header: t("o.fulfillment"), cell: (r) => <ColorPill label={r.status.label} color={r.status.color} /> },
            { key: "items", header: t("o.items"), align: "center", cell: (r) => <span className="text-ad-muted">{r.itemCount}</span> },
            { key: "total", header: t("c.total"), align: "end", cell: (r) => <span className="tabular font-medium">{fmt(r.total)}</span> },
          ]}
          mobile={(r) => (
            <div>
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium">{r.number}</span>
                <span className="tabular font-semibold">{fmt(r.total)}</span>
              </div>
              <p className="mt-0.5 truncate text-sm text-ad-muted">
                {r.customer} · {timeAgo(r.placedAt, locale)}
              </p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                <ColorPill label={r.status.label} color={r.status.color} />
                <Pill tone={PAY_TONE[r.paymentStatus]}>{t(`o.pay.${r.paymentStatus}` as "o.pay.PAID")}</Pill>
              </div>
            </div>
          )}
        />
        <Pager page={data.page} pageCount={data.pageCount} total={data.total} />
      </Panel>
    </>
  );
}

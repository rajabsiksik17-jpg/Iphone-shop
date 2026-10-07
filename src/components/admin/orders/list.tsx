"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { useSearchParams } from "next/navigation";
import { CheckCircle2, ChevronDown, Download, Eye, ExternalLink, MoreHorizontal, Printer, StickyNote, Tags } from "lucide-react";
import { toast } from "sonner";
import { Link, usePathname, useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/overlay";
import { Dropdown, DropdownContent, DropdownItem, DropdownTrigger } from "@/components/ui/menu";
import { useAdmin } from "../admin-context";
import { PageHeader, Panel, DataTable, FilterTabs, SearchBox, Pager, ColorPill, Pill, BulkBar, Switch } from "../ui";
import { Label, Select, TextArea } from "../fields";
import { AdminDrawer, DrawerSkeleton, useDrawerParam } from "../drawer";
import { OrderDetailView } from "./detail";
import { bulkOrdersAction, bulkOrdersMatchingAction, orderDrawerAction, updateOrderStatusAction } from "@/actions/admin/orders";
import { timeAgo, fmtDate } from "@/lib/time";
import { cn } from "@/lib/utils";
import type { listOrders, OrderDetail } from "@/server/admin/orders";
import { TimeAgo } from "@/components/ui/time-ago";
import { useLiveRefresh } from "../use-live-refresh";

type Data = Awaited<ReturnType<typeof listOrders>>;
type Row = Data["rows"][number];
type Status = Data["statuses"][number];

export const PAY_TONE: Record<string, "green" | "amber" | "red" | "neutral" | "blue" | "violet"> = { PAID: "green", PENDING: "amber", UNPAID: "neutral", FAILED: "red", REFUNDED: "violet", PARTIALLY_REFUNDED: "violet", AUTHORIZED: "blue" };
const UNPAID = new Set(["UNPAID", "PENDING", "FAILED"]);

/**
 * Status pill that is also the control: pick a status and it applies
 * immediately (optimistic), reverting with an error toast if the server
 * rejects it. Customer notification follows the status's own setting.
 */
function QuickStatus({ row, statuses, disabled, onChange }: { row: Row; statuses: Status[]; disabled: boolean; onChange: (row: Row, key: string) => void }) {
  const { t } = useAdmin();
  if (disabled) return <ColorPill label={row.status.label} color={row.status.color} />;
  return (
    <Dropdown>
      <DropdownTrigger className="group inline-flex items-center gap-1 rounded-full focus-visible:outline-2 focus-visible:outline-ad-accent" aria-label={`${t("o.changeStatus")}: ${row.status.label}`}>
        <ColorPill label={row.status.label} color={row.status.color} />
        <ChevronDown className="size-3.5 text-ad-muted opacity-0 transition group-hover:opacity-100 group-focus-visible:opacity-100" />
      </DropdownTrigger>
      <DropdownContent align="start">
        {statuses.map((s) => (
          <DropdownItem key={s.key} onSelect={() => s.key !== row.status.key && onChange(row, s.key)} className={cn(s.key === row.status.key && "font-semibold")}>
            <span className="size-2.5 rounded-full" style={{ backgroundColor: s.color }} /> {s.label}
          </DropdownItem>
        ))}
      </DropdownContent>
    </Dropdown>
  );
}

export function OrdersList({ data }: { data: Data }) {
  const { t, fmt, locale, socket, can } = useAdmin();
  const router = useRouter();
  const sp = useSearchParams();
  const pathname = usePathname();
  const manage = can("orders.manage");
  const ar = locale === "ar";

  // Optimistic status overrides (row id → status key) until the server data catches up.
  const [overrides, setOverrides] = useState<Record<string, string>>({});
  useEffect(() => setOverrides({}), [data]);
  const rows = data.rows.map((r) => {
    const key = overrides[r.id];
    const s = key ? data.statuses.find((x) => x.key === key) : null;
    return s ? { ...r, status: { key: s.key, label: s.label, color: s.color } } : r;
  });

  const [selected, setSelected] = useState<Set<string>>(new Set());
  // "Select all N matching": the bulk action targets the current filters, not just this page.
  const [allMatching, setAllMatching] = useState(false);
  useEffect(() => {
    if (selected.size === 0) setAllMatching(false);
  }, [selected]);
  const ids = [...selected];
  const count = allMatching ? data.total : ids.length;
  const [pending, start] = useTransition();
  const [dialog, setDialog] = useState<null | "status" | "note">(null);
  const [bulkStatus, setBulkStatus] = useState({ key: data.statuses[0]?.key ?? "", notify: true });
  const [bulkNote, setBulkNote] = useState({ body: "", internal: true });

  // Drawer (deep-linkable as ?order=<id>).
  const drawer = useDrawerParam("order");
  const [detail, setDetail] = useState<OrderDetail | null>(null);
  const loadSeq = useRef(0);
  const load = useCallback(
    async (id: string) => {
      const seq = ++loadSeq.current;
      const r = await orderDrawerAction(id, locale);
      if (seq !== loadSeq.current) return;
      if (r.ok) setDetail(r.data);
      else {
        toast.error(t("c.error"));
        drawer.close();
      }
    },
    [locale, t, drawer],
  );
  useEffect(() => {
    // On close keep the last order rendered so the exit animation doesn't flash a skeleton.
    if (!drawer.value) return;
    if (detail?.id !== drawer.value) setDetail(null);
    void load(drawer.value);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drawer.value]);

  // Realtime: new/changed orders (from any admin or customer) refresh the list, counters and the open drawer.
  useLiveRefresh(["orders"], () => drawer.value && void load(drawer.value));

  const setParam = (k: string, v: string) => {
    const p = new URLSearchParams(sp.toString());
    if (v) p.set(k, v);
    else p.delete(k);
    p.delete("page");
    router.push(`${pathname}?${p.toString()}`);
  };

  const quickStatus = (row: Row, key: string) => {
    const target = data.statuses.find((s) => s.key === key);
    setOverrides((o) => ({ ...o, [row.id]: key }));
    start(async () => {
      const r = await updateOrderStatusAction({ orderId: row.id, status: key, notify: target?.notify ?? false });
      if (r.ok) {
        toast.success(`${row.number} → ${target?.label ?? key}`);
        router.refresh();
        if (drawer.value === row.id) void load(row.id);
      } else {
        setOverrides((o) => {
          const n = { ...o };
          delete n[row.id];
          return n;
        });
        toast.error(`${row.number}: ${t("c.error")}`);
      }
    });
  };

  const runBulk = (op: Record<string, unknown>) =>
    start(async () => {
      const r = allMatching ? await bulkOrdersMatchingAction(Object.fromEntries(["q", "status", "payment", "from", "to"].flatMap((k) => (sp.get(k) ? [[k, sp.get(k)!]] : []))), op) : await bulkOrdersAction(ids, op);
      if (!r.ok) return void toast.error(t("c.error"));
      const { done, skipped, failed } = r.data;
      if (done) toast.success(ar ? `تم تحديث ${done} طلب` : `Updated ${done} order${done === 1 ? "" : "s"}`);
      if (skipped) toast.message(ar ? `تم تخطي ${skipped} (مدفوعة مسبقاً)` : `Skipped ${skipped} (already paid)`);
      if (failed.length) toast.error(`${ar ? "تعذّر تحديث" : "Couldn't update"}: ${failed.map((f) => f.number).join(", ")}`);
      setDialog(null);
      setSelected(new Set());
      setAllMatching(false);
      router.refresh();
    });

  const context = [t("o.title"), ...(sp.get("status") ? [data.statuses.find((s) => s.key === sp.get("status"))?.label ?? (ar ? "بحاجة لإجراء" : "Needs action")] : []), ...(sp.get("q") ? [`“${sp.get("q")}”`] : [])];

  const rowMenu = (r: Row) => (
    <div className="flex items-center justify-end gap-1">
      <button type="button" onClick={() => drawer.open(r.id)} className="grid size-8 place-items-center rounded-lg text-ad-muted transition hover:bg-ad-hover hover:text-ad-fg" aria-label={`${t("c.view")} ${r.number}`}>
        <Eye className="size-4" />
      </button>
      <Dropdown>
        <DropdownTrigger className="grid size-8 place-items-center rounded-lg text-ad-muted hover:bg-ad-hover" aria-label={t("c.actions")}>
          <MoreHorizontal className="size-4" />
        </DropdownTrigger>
        <DropdownContent align="end">
          {manage && UNPAID.has(r.paymentStatus) && (
            <DropdownItem onSelect={() => (setSelected(new Set([r.id])), start(async () => {
              const res = await bulkOrdersAction([r.id], { type: "markPaid" });
              if (res.ok && res.data.done) toast.success(`${r.number} · ${t("o.pay.PAID")}`);
              else toast.error(t("c.error"));
              setSelected(new Set());
              router.refresh();
            }))}>
              <CheckCircle2 /> {t("o.markPaid")}
            </DropdownItem>
          )}
          <DropdownItem onSelect={() => window.open(`/api/admin/orders/${r.id}/invoice?locale=${locale}`, "_blank")}>
            <Printer /> {t("o.print")}
          </DropdownItem>
          <DropdownItem asChild>
            <Link href={`/admin/orders/${r.id}`}>
              <ExternalLink /> {ar ? "فتح الصفحة الكاملة" : "Open full page"}
            </Link>
          </DropdownItem>
        </DropdownContent>
      </Dropdown>
    </div>
  );

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
            { value: "open", label: ar ? "بحاجة لإجراء" : "Needs action", count: data.openCount },
            ...data.statuses.map((s) => ({ value: s.key, label: s.label, count: s.count })),
          ]}
        />
      </div>
      <Panel padded={false}>
        <div className="flex flex-col gap-2 border-b border-ad-border p-3 sm:flex-row sm:items-center">
          <SearchBox placeholder={ar ? "رقم الطلب، الاسم، البريد، الهاتف، SKU…" : "Order #, name, email, phone, SKU…"} />
          <div className="grid grid-cols-2 gap-2 sm:ms-auto sm:flex">
            <Select value={sp.get("payment") ?? ""} onChange={(e) => setParam("payment", e.target.value)} aria-label={t("o.payment")} className="h-9 text-[13px]">
              <option value="">
                {t("o.payment")}: {t("c.all")}
              </option>
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
          rows={rows}
          onRowClick={(r) => drawer.open(r.id)}
          selectable={manage}
          selected={selected}
          onSelectedChange={setSelected}
          total={data.total}
          allMatching={allMatching}
          onAllMatchingChange={setAllMatching}
          columns={[
            {
              key: "number",
              header: t("o.number"),
              cell: (r) => (
                <div>
                  <span className={cn("font-medium", drawer.value === r.id && "text-ad-accent")}>{r.number}</span>
                  <p className="text-xs text-ad-muted" title={fmtDate(r.placedAt, locale, true)}>
                    <TimeAgo date={r.placedAt} />
                  </p>
                </div>
              ),
            },
            {
              key: "customer",
              header: t("o.customer"),
              cell: (r) => (
                <div className="flex min-w-0 items-center gap-2.5">
                  <span className="grid size-8 shrink-0 place-items-center rounded-full bg-ad-sunken text-xs font-semibold text-ad-muted" aria-hidden>
                    {r.customer.trim().charAt(0).toUpperCase() || "?"}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate">{r.customer}</p>
                    <p className="truncate text-xs text-ad-muted">{r.email}</p>
                  </div>
                </div>
              ),
            },
            { key: "items", header: t("o.items"), align: "center", className: "max-lg:hidden", cell: (r) => <span className="text-ad-muted">{r.itemCount}</span> },
            { key: "total", header: t("c.total"), align: "end", cell: (r) => <span className="tabular font-medium">{fmt(r.total)}</span> },
            { key: "payment", header: t("o.payment"), cell: (r) => <Pill tone={PAY_TONE[r.paymentStatus]}>{t(`o.pay.${r.paymentStatus}` as "o.pay.PAID")}</Pill> },
            { key: "status", header: t("o.fulfillment"), cell: (r) => <QuickStatus row={r} statuses={data.statuses} disabled={!manage} onChange={quickStatus} /> },
            { key: "actions", header: <span className="sr-only">{t("c.actions")}</span>, align: "end", cell: rowMenu },
          ]}
          mobile={(r) => (
            <div>
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium">{r.number}</span>
                <span className="tabular font-semibold">{fmt(r.total)}</span>
              </div>
              <p className="mt-0.5 truncate text-sm text-ad-muted">
                {r.customer} · {t("o.itemsCount", { n: r.itemCount })} · <TimeAgo date={r.placedAt} />
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

      <BulkBar count={count} onClear={() => (setSelected(new Set()), setAllMatching(false))}>
        <Button size="sm" variant="outline" leftIcon={<Tags />} onClick={() => setDialog("status")} disabled={pending}>
          {t("o.changeStatus")}
        </Button>
        <Button size="sm" variant="outline" leftIcon={<CheckCircle2 />} onClick={() => runBulk({ type: "markPaid" })} loading={pending}>
          {t("o.markPaid")}
        </Button>
        <Button size="sm" variant="outline" leftIcon={<StickyNote />} onClick={() => setDialog("note")} disabled={pending}>
          {t("o.addNote")}
        </Button>
        <a href={allMatching ? `/api/admin/orders/export?${sp.toString()}` : `/api/admin/orders/export?ids=${ids.join(",")}`} className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-ad-border px-2.5 text-[13px] font-medium hover:bg-ad-hover">
          <Download className="size-4" /> {t("c.export")}
        </a>
      </BulkBar>

      <Modal open={dialog === "status"} onOpenChange={(o) => !o && setDialog(null)} title={t("o.changeStatus")} description={ar ? `سيتم تطبيقها على ${count} طلب` : `Applies to ${count} order${count === 1 ? "" : "s"}`}>
        <div className="space-y-4">
          <div>
            <Label>{t("c.status")}</Label>
            <Select value={bulkStatus.key} onChange={(e) => setBulkStatus({ key: e.target.value, notify: data.statuses.find((s) => s.key === e.target.value)?.notify ?? true })}>
              {data.statuses.map((s) => (
                <option key={s.key} value={s.key}>
                  {s.label}
                </option>
              ))}
            </Select>
          </div>
          <Switch checked={bulkStatus.notify} onCheckedChange={(v) => setBulkStatus({ ...bulkStatus, notify: v })} label={t("o.notifyCustomer")} />
          <Button block loading={pending} onClick={() => runBulk({ type: "status", status: bulkStatus.key, notify: bulkStatus.notify })}>
            {t("c.apply")}
          </Button>
        </div>
      </Modal>

      <Modal open={dialog === "note"} onOpenChange={(o) => !o && setDialog(null)} title={t("o.addNote")} description={ar ? `ستُضاف إلى ${count} طلب` : `Added to ${count} order${count === 1 ? "" : "s"}`}>
        <div className="space-y-4">
          <TextArea rows={3} value={bulkNote.body} onChange={(e) => setBulkNote({ ...bulkNote, body: e.target.value })} />
          <Switch checked={bulkNote.internal} onCheckedChange={(v) => setBulkNote({ ...bulkNote, internal: v })} label={t("o.internal")} />
          <Button block loading={pending} disabled={!bulkNote.body.trim()} onClick={() => runBulk({ type: "note", body: bulkNote.body, internal: bulkNote.internal })}>
            {t("c.add")}
          </Button>
        </div>
      </Modal>

      <AdminDrawer open={Boolean(drawer.value)} onOpenChange={(o) => !o && drawer.close()} label={t("o.title")}>
        {detail && (detail.id === drawer.value || !drawer.value) ? <OrderDetailView key={detail.id} order={detail} layout="drawer" context={context} onChanged={() => drawer.value && load(drawer.value)} /> : <DrawerSkeleton />}
      </AdminDrawer>
    </>
  );
}

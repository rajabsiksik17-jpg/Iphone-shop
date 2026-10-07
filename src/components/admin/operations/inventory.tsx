"use client";

import { useState, useTransition } from "react";
import { PackageCheck, Pencil } from "lucide-react";
import { toast } from "sonner";
import { Link, useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/overlay";
import { useAdmin } from "../admin-context";
import { PageHeader, Panel, DataTable, FilterTabs, SearchBox, Pager, Pill, Segmented } from "../ui";
import { Label, Select, TextInput } from "../fields";
import { adjustStockAction } from "@/actions/admin/products";
import { timeAgo } from "@/lib/time";
import { cn } from "@/lib/utils";
import type { inventoryList, recentMovements } from "@/server/admin/operations";
import { TimeAgo } from "@/components/ui/time-ago";

type Data = Awaited<ReturnType<typeof inventoryList>>;
type Row = Data["rows"][number];

export function InventoryView({ data, movements }: { data: Data; movements: Awaited<ReturnType<typeof recentMovements>> }) {
  const { t, locale } = useAdmin();
  const router = useRouter();
  const [edit, setEdit] = useState<Row | null>(null);
  const [mode, setMode] = useState<"set" | "delta">("set");
  const [value, setValue] = useState(0);
  const [reason, setReason] = useState<"ADJUSTMENT" | "RESTOCK" | "CORRECTION" | "RETURN">("RESTOCK");
  const [note, setNote] = useState("");
  const [pending, start] = useTransition();

  const stockPill = (r: Row) => <Pill tone={r.state === "out" ? "red" : r.state === "low" ? "amber" : "green"}>{r.stock}</Pill>;
  const openEdit = (r: Row) => {
    setEdit(r);
    setMode("set");
    setValue(r.stock);
    setReason("RESTOCK");
    setNote("");
  };

  return (
    <>
      <PageHeader title={t("inv.title")} />
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div>
          <div className="mb-4">
            <FilterTabs
              param="filter"
              options={[
                { value: "", label: t("inv.allStock"), count: data.counts.all },
                { value: "low", label: t("p.lowStock"), count: data.counts.low },
                { value: "out", label: t("p.outOfStock"), count: data.counts.out },
              ]}
            />
          </div>
          <Panel padded={false}>
            <div className="border-b border-ad-border p-3">
              <SearchBox placeholder={locale === "ar" ? "اسم المنتج أو SKU…" : "Product name or SKU…"} />
            </div>
            <DataTable
              rows={data.rows}
              columns={[
                {
                  key: "p",
                  header: t("c.name"),
                  cell: (r) => (
                    <Link href={`/admin/products/${r.productId}?tab=inventory`} className="flex items-center gap-3">
                      {r.image ? <img src={r.image} alt="" className="size-9 rounded-lg object-cover" /> : <span className="size-9 rounded-lg bg-ad-sunken" />}
                      <span className="min-w-0">
                        <span className="block truncate font-medium hover:underline">{r.name}</span>
                        <span className="block truncate text-xs text-ad-muted">{[r.variant, r.sku].filter(Boolean).join(" · ")}</span>
                      </span>
                    </Link>
                  ),
                },
                { key: "th", header: t("p.lowStockThreshold"), align: "center", cell: (r) => <span className="text-ad-muted">{r.threshold}</span> },
                { key: "s", header: t("p.stock"), align: "center", cell: stockPill },
                { key: "a", header: "", align: "end", cell: (r) => <Button size="xs" variant="outline" leftIcon={<Pencil />} onClick={() => openEdit(r)}>{t("inv.adjust")}</Button> },
              ]}
              mobile={(r) => (
                <button type="button" onClick={() => openEdit(r)} className="flex w-full items-center gap-3 text-start">
                  {r.image ? <img src={r.image} alt="" className="size-11 rounded-lg object-cover" /> : <span className="size-11 rounded-lg bg-ad-sunken" />}
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{r.name}</span>
                    <span className="block truncate text-xs text-ad-muted">{[r.variant, r.sku].filter(Boolean).join(" · ")}</span>
                  </span>
                  {stockPill(r)}
                </button>
              )}
            />
            <Pager page={data.page} pageCount={data.pageCount} total={data.total} />
          </Panel>
        </div>
        <Panel title={t("inv.history")} padded={false}>
          <ul className="divide-y divide-ad-border">
            {movements.map((m) => (
              <li key={m.id} className="px-4 py-2.5 text-[13px]">
                <div className="flex justify-between gap-2">
                  <span className="truncate font-medium">{m.product}</span>
                  <span className={cn("tabular shrink-0 font-semibold", m.delta > 0 ? "text-emerald-600" : "text-red-600")}>
                    {m.delta > 0 ? "+" : ""}
                    {m.delta}
                  </span>
                </div>
                <p className="text-xs text-ad-muted">
                  {t(`inv.reason.${m.reason}` as "inv.reason.ORDER")} {m.note ? `· ${m.note}` : ""} · <TimeAgo date={m.at} />
                  {m.user ? ` · ${m.user}` : ""}
                </p>
              </li>
            ))}
          </ul>
        </Panel>
      </div>

      <Modal open={Boolean(edit)} onOpenChange={(o) => !o && setEdit(null)} title={t("inv.adjust")} description={edit ? `${edit.name}${edit.variant ? ` · ${edit.variant}` : ""} — ${t("p.stock")}: ${edit.stock}` : ""}>
        {edit && (
          <div className="space-y-4">
            <Segmented value={mode} onChange={(m) => (setMode(m), setValue(m === "set" ? edit.stock : 0))} options={[{ value: "set", label: t("inv.set") }, { value: "delta", label: t("inv.change") }]} />
            <TextInput type="number" value={value} onChange={(e) => setValue(Number(e.target.value))} autoFocus />
            <p className="text-xs text-ad-muted">
              → {t("p.stock")}: <b className="text-ad-fg">{mode === "set" ? value : edit.stock + value}</b>
            </p>
            <div>
              <Label>{t("inv.reason")}</Label>
              <Select value={reason} onChange={(e) => setReason(e.target.value as typeof reason)}>
                {(["RESTOCK", "ADJUSTMENT", "CORRECTION", "RETURN"] as const).map((r) => (
                  <option key={r} value={r}>
                    {t(`inv.reason.${r}`)}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label optional>{t("c.note")}</Label>
              <TextInput value={note} onChange={(e) => setNote(e.target.value)} />
            </div>
            <Button
              block
              loading={pending}
              leftIcon={<PackageCheck />}
              onClick={() =>
                start(async () => {
                  const r = await adjustStockAction({ productId: edit.productId, variantId: edit.variantId, mode, value, reason, note: note || undefined });
                  if (r.ok) {
                    toast.success(t("inv.updated"));
                    setEdit(null);
                    router.refresh();
                  } else toast.error(t("c.error"));
                })
              }
            >
              {t("c.save")}
            </Button>
          </div>
        )}
      </Modal>
    </>
  );
}

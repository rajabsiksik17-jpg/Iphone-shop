"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { useSearchParams } from "next/navigation";
import { Plus, Star, Copy, Trash2, Eye, MoreHorizontal, Pencil, ExternalLink, ChevronDown } from "lucide-react";
import { toast } from "sonner";
import { Link, usePathname, useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/overlay";
import { Dropdown, DropdownContent, DropdownItem, DropdownTrigger } from "@/components/ui/menu";
import { useAdmin } from "../admin-context";
import { PageHeader, Panel, DataTable, FilterTabs, SearchBox, Pager, Pill, BulkBar, ConfirmDialog, AdminEmpty } from "../ui";
import { Select, Label, TextInput } from "../fields";
import { cn } from "@/lib/utils";
import { bulkProductsAction, bulkProductsMatchingAction, deleteProductsMatchingAction, duplicateProductAction, deleteProductsAction, productDrawerAction, quickUpdateProductAction } from "@/actions/admin/products";
import { AdminDrawer, DrawerSkeleton, useDrawerParam } from "../drawer";
import { InlineEdit } from "../inline-edit";
import { ProductEditor } from "./editor";
import { timeAgo } from "@/lib/time";
import type { listAdminProducts, ProductEditorData } from "@/server/admin/products";
import { TimeAgo } from "@/components/ui/time-ago";
import { useLiveRefresh } from "../use-live-refresh";

type Data = Awaited<ReturnType<typeof listAdminProducts>>;

export const STOCK_TONE = { IN_STOCK: "green", LOW_STOCK: "amber", OUT_OF_STOCK: "red", BACKORDER: "blue", PREORDER: "violet" } as const;

export function ProductsList({ data }: { data: Data }) {
  const { t, fmt, locale, can, money } = useAdmin();
  const router = useRouter();
  const sp = useSearchParams();
  const pathname = usePathname();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [pending, start] = useTransition();
  const [dialog, setDialog] = useState<null | "category" | "brand" | "price" | "sale" | "stock" | "delete">(null);
  const [val, setVal] = useState<{ categoryId: string; brandId: string; percent: number; stock: number }>({ categoryId: "", brandId: "", percent: 10, stock: 0 });
  const ids = [...selected];
  // "Select all N matching": bulk actions then target the current filters, not just this page.
  const [allMatching, setAllMatching] = useState(false);
  useEffect(() => {
    if (selected.size === 0) setAllMatching(false);
  }, [selected]);
  const count = allMatching ? data.total : ids.length;
  const filter = Object.fromEntries(["q", "status", "brand", "category", "stock"].flatMap((k) => (sp.get(k) ? [[k, sp.get(k)!]] : [])));
  const editable = can("catalog.edit");
  const ar = locale === "ar";
  const dec = money.base.decimals;

  // Optimistic row patches from inline edits, dropped when fresh server data arrives.
  const [patches, setPatches] = useState<Record<string, Partial<Data["rows"][number]>>>({});
  useEffect(() => setPatches({}), [data]);
  const rows = data.rows.map((r) => (patches[r.id] ? { ...r, ...patches[r.id] } : r));

  // Product drawer (?product=<id> | new).
  const drawer = useDrawerParam("product");
  const [editor, setEditor] = useState<{ id: string; data: ProductEditorData; v: number } | null>(null);
  const dirty = useRef(false);
  const seq = useRef(0);
  const load = useCallback(
    async (id: string) => {
      const n = ++seq.current;
      const r = await productDrawerAction(id, locale);
      if (n !== seq.current) return;
      if (r.ok) setEditor({ id, data: r.data, v: n });
      else {
        toast.error(t("c.error"));
        drawer.close();
      }
    },
    [locale, t, drawer],
  );
  useEffect(() => {
    if (!drawer.value) return;
    dirty.current = false;
    void load(drawer.value);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drawer.value]);
  // Realtime: stock changes (orders, other admins) and reviews update the table without a reload.
  useLiveRefresh(["inventory", "reviews"]);
  const context = [t("p.title"), ...(sp.get("status") ? [sp.get("status") === "ACTIVE" ? t("c.published") : sp.get("status") === "DRAFT" ? t("c.draft") : t("c.archived")] : []), ...(sp.get("q") ? [`“${sp.get("q")}”`] : [])];

  /** Inline edit → server; patches the row optimistically and reports success for rollback. */
  const quick = async (r: Data["rows"][number], patch: Record<string, unknown>, optimistic: Partial<Data["rows"][number]>) => {
    setPatches((ps) => ({ ...ps, [r.id]: { ...ps[r.id], ...optimistic } }));
    const res = await quickUpdateProductAction(r.id, patch);
    if (res.ok) {
      setPatches((ps) => ({ ...ps, [r.id]: { ...ps[r.id], price: res.data.effectivePrice, maxPrice: res.data.maxPrice, basePrice: res.data.price, salePrice: res.data.salePrice, onSale: res.data.onSale, stock: res.data.stock, stockStatus: res.data.stockStatus, status: res.data.status } }));
      router.refresh();
      return true;
    }
    setPatches((ps) => {
      const n = { ...ps };
      delete n[r.id];
      return n;
    });
    toast.error(res.error === "variable_use_editor" ? (ar ? "منتج بخيارات — عدّل السعر والمخزون لكل خيار من المحرر" : "Product has variations — edit price and stock per variation in the editor") : res.fieldErrors?.salePrice ? (ar ? "سعر التخفيض يجب أن يكون أقل من السعر" : "Sale price must be lower than the price") : t("c.error"));
    return false;
  };
  const toMinor = (v: string) => Math.round(Number(v.replace(/[^\d.]/g, "")) * 10 ** dec);
  const toMajor = (n: number) => (n / 10 ** dec).toFixed(dec);

  const setParam = (k: string, v: string) => {
    const p = new URLSearchParams(sp.toString());
    if (v) p.set(k, v);
    else p.delete(k);
    p.delete("page");
    router.push(`${pathname}?${p.toString()}`);
  };

  const bulk = (op: Record<string, unknown>) =>
    start(async () => {
      const r = allMatching ? await bulkProductsMatchingAction(filter, op) : await bulkProductsAction(ids, op);
      if (r.ok) {
        toast.success(t("p.bulk.done", { n: count }));
        setAllMatching(false);
        setSelected(new Set());
        setDialog(null);
        router.refresh();
      } else toast.error(t("c.error"));
    });

  const statusLabel = (s: string) => t(s === "ACTIVE" ? "c.published" : s === "DRAFT" ? "c.draft" : "c.archived");
  const statusCell = (r: Data["rows"][number]) =>
    editable ? (
      <Dropdown>
        <DropdownTrigger className="group inline-flex items-center gap-1 rounded-full" aria-label={`${t("c.status")}: ${statusLabel(r.status)}`}>
          {statusPill(r.status)}
          <ChevronDown className="size-3.5 text-ad-muted opacity-0 transition group-hover:opacity-100" />
        </DropdownTrigger>
        <DropdownContent align="start">
          {(["ACTIVE", "DRAFT", "ARCHIVED"] as const).map((st) => (
            <DropdownItem key={st} onSelect={() => st !== r.status && void quick(r, { status: st }, { status: st })} className={cn(st === r.status && "font-semibold")}>
              {statusLabel(st)}
            </DropdownItem>
          ))}
        </DropdownContent>
      </Dropdown>
    ) : (
      statusPill(r.status)
    );
  const statusPill = (s: string) => <Pill tone={s === "ACTIVE" ? "green" : s === "DRAFT" ? "neutral" : "amber"}>{t(s === "ACTIVE" ? "c.published" : s === "DRAFT" ? "c.draft" : "c.archived")}</Pill>;
  const stockPill = (r: Data["rows"][number]) => (!r.trackInventory ? <span className="text-ad-muted">∞</span> : <Pill tone={STOCK_TONE[r.stockStatus as keyof typeof STOCK_TONE]}>{r.stock}</Pill>);
  // Simple products: stock is edited inline. Variable products show the total (edited per variation in the drawer).
  const stockCell = (r: Data["rows"][number]) =>
    editable && r.type === "SIMPLE" && r.trackInventory ? (
      <InlineEdit value={String(r.stock)} display={stockPill(r)} type="number" min={0} step={1} label={t("p.stock")} inputClassName="w-20" onSave={(v) => quick(r, { stock: Math.max(0, Math.round(Number(v))) }, { stock: Math.max(0, Math.round(Number(v))) })} />
    ) : (
      stockPill(r)
    );
  const priceEdit = (r: Data["rows"][number]) =>
    editable && r.type === "SIMPLE" ? (
      <div className="flex flex-col items-end gap-0.5">
        <InlineEdit value={toMajor(r.basePrice)} display={<span className={cn("tabular", r.onSale && "text-ad-muted line-through")}>{fmt(r.basePrice)}</span>} type="number" min={0} step="any" dir="ltr" label={t("p.price")} inputClassName="w-28 text-end" onSave={(v) => quick(r, { price: toMinor(v) }, {})} />
        <InlineEdit
          value={r.salePrice != null ? toMajor(r.salePrice) : ""}
          display={r.salePrice != null ? <span className="tabular font-medium text-red-600">{fmt(r.salePrice)}</span> : <span className="text-xs text-ad-muted">{ar ? "+ سعر تخفيض" : "+ sale price"}</span>}
          type="number"
          min={0}
          step="any"
          dir="ltr"
          placeholder={ar ? "فارغ = بدون" : "empty = none"}
          label={ar ? "سعر التخفيض" : "Sale price"}
          inputClassName="w-28 text-end"
          onSave={(v) => quick(r, { salePrice: v.trim() ? toMinor(v) : null }, {})}
        />
      </div>
    ) : (
      priceCell(r)
    );
  const priceCell = (r: Data["rows"][number]) => (
    <span className="tabular whitespace-nowrap">
      {r.price !== r.maxPrice ? `${fmt(r.price)} – ${fmt(r.maxPrice)}` : fmt(r.price)}
      {r.onSale && <span className="ms-1.5 text-[10px] font-semibold text-red-500">SALE</span>}
    </span>
  );

  const rowMenu = (r: Data["rows"][number]) => (
    <Dropdown>
      <DropdownTrigger className="grid size-8 place-items-center rounded-lg text-ad-muted hover:bg-ad-hover" aria-label={t("c.actions")}>
        <MoreHorizontal className="size-4" />
      </DropdownTrigger>
      <DropdownContent>
        <DropdownItem onSelect={() => drawer.open(r.id)}>
          <Pencil /> {t("c.edit")}
        </DropdownItem>
        <DropdownItem asChild>
          <Link href={`/admin/products/${r.id}`}>
            <ExternalLink /> {ar ? "فتح المحرر الكامل" : "Open full editor"}
          </Link>
        </DropdownItem>
        <DropdownItem asChild>
          <a href={`/${locale}/product/${r.slug}${r.status !== "ACTIVE" ? "?preview=1" : ""}`} target="_blank" rel="noopener">
            <Eye /> {t("p.viewOnStore")}
          </a>
        </DropdownItem>
        {can("catalog.edit") && (
          <DropdownItem
            onSelect={() =>
              start(async () => {
                const res = await duplicateProductAction(r.id);
                if (res.ok) {
                  toast.success(t("c.duplicated"));
                  router.refresh();
                  drawer.open(res.data.id);
                }
              })
            }
          >
            <Copy /> {t("c.duplicate")}
          </DropdownItem>
        )}
        {can("catalog.delete") && (
          <DropdownItem className="text-red-600" onSelect={() => (setSelected(new Set([r.id])), setDialog("delete"))}>
            <Trash2 /> {t("c.delete")}
          </DropdownItem>
        )}
      </DropdownContent>
    </Dropdown>
  );

  return (
    <>
      <PageHeader
        title={t("p.title")}
        actions={
          can("catalog.edit") && (
            <Button size="sm" leftIcon={<Plus />} onClick={() => drawer.open("new")}>
              {t("p.new")}
            </Button>
          )
        }
      />
      <div className="mb-4">
        <FilterTabs
          param="status"
          options={[
            { value: "", label: t("c.all"), count: Object.values(data.statusCounts).reduce((a, b) => a + b, 0) },
            { value: "ACTIVE", label: t("c.published"), count: data.statusCounts.ACTIVE ?? 0 },
            { value: "DRAFT", label: t("c.draft"), count: data.statusCounts.DRAFT ?? 0 },
            { value: "ARCHIVED", label: t("c.archived"), count: data.statusCounts.ARCHIVED ?? 0 },
          ]}
        />
      </div>
      <Panel padded={false}>
        <div className="flex flex-col gap-2 border-b border-ad-border p-3 xl:flex-row xl:items-center">
          <SearchBox placeholder={locale === "ar" ? "الاسم، SKU…" : "Name, SKU…"} />
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 xl:ms-auto xl:flex [&>div]:xl:w-40">
            <Select value={sp.get("category") ?? ""} onChange={(e) => setParam("category", e.target.value)} className="h-9 text-[13px]" aria-label={t("p.categories")}>
              <option value="">{t("p.categories")}</option>
              {data.categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {"— ".repeat(c.depth)}
                  {c.name}
                </option>
              ))}
            </Select>
            <Select value={sp.get("brand") ?? ""} onChange={(e) => setParam("brand", e.target.value)} className="h-9 text-[13px]" aria-label={t("p.brand")}>
              <option value="">{t("p.brand")}</option>
              {data.brands.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </Select>
            <Select value={sp.get("stock") ?? ""} onChange={(e) => setParam("stock", e.target.value)} className="h-9 text-[13px]" aria-label={t("p.stock")}>
              <option value="">{t("p.stock")}</option>
              <option value="low">{t("p.lowStock")}</option>
              <option value="out">{t("p.outOfStock")}</option>
              <option value="sale">{t("p.onSale")}</option>
            </Select>
            <Select value={sp.get("sort") ?? ""} onChange={(e) => setParam("sort", e.target.value)} className="h-9 text-[13px]" aria-label="Sort">
              <option value="">{locale === "ar" ? "آخر تعديل" : "Recently updated"}</option>
              <option value="name">{t("c.name")}</option>
              <option value="price">{t("p.price")} ↑</option>
              <option value="-price">{t("p.price")} ↓</option>
              <option value="stock">{t("p.stock")} ↑</option>
              <option value="sales">{locale === "ar" ? "الأكثر مبيعاً" : "Best selling"}</option>
            </Select>
          </div>
        </div>
        <DataTable
          rows={rows}
          onRowClick={(r) => drawer.open(r.id)}
          selectable={can("catalog.edit")}
          selected={selected}
          onSelectedChange={setSelected}
          total={data.total}
          allMatching={allMatching}
          onAllMatchingChange={setAllMatching}
          empty={<AdminEmpty action={can("catalog.edit") ? <Button size="sm" onClick={() => drawer.open("new")}>{t("p.new")}</Button> : undefined} />}
          columns={[
            {
              key: "name",
              header: t("c.name"),
              cell: (r) => (
                <div className="flex max-w-[22rem] items-center gap-3">
                  {r.image ? <img src={r.image} alt="" className="size-10 shrink-0 rounded-lg bg-ad-sunken object-cover" /> : <span className="size-10 shrink-0 rounded-lg bg-ad-sunken" />}
                  <div className="min-w-0">
                    <p className={cn("flex items-center gap-1.5 truncate font-medium", drawer.value === r.id && "text-ad-accent")}>
                      {r.name}
                      {r.isFeatured && <Star className="size-3.5 shrink-0 fill-amber-400 text-amber-400" />}
                      {r.demo && <span className="shrink-0 rounded-full bg-violet-500/10 px-1.5 py-px text-[10px] font-semibold text-violet-600">{locale === "ar" ? "تجريبي" : "Demo"}</span>}
                    </p>
                    <p className="truncate text-xs text-ad-muted">{[r.brand, r.category, r.type === "VARIABLE" ? t("p.variantsCount", { n: r.variants }) : null].filter(Boolean).join(" · ")}</p>
                  </div>
                </div>
              ),
            },
            { key: "sku", header: "SKU", className: "max-xl:hidden", cell: (r) => <span className="font-mono text-xs text-ad-muted">{r.sku || "—"}</span> },
            { key: "price", header: t("p.price"), align: "end", cell: priceEdit },
            { key: "stock", header: t("p.stock"), cell: stockCell },
            { key: "status", header: t("c.status"), cell: statusCell },
            {
              key: "rating",
              header: ar ? "التقييم" : "Rating",
              className: "max-2xl:hidden",
              cell: (r) => (r.reviews ? <span className="whitespace-nowrap text-xs"><Star className="me-1 inline size-3.5 fill-amber-400 text-amber-400" />{r.rating.toFixed(1)} <span className="text-ad-muted">({r.reviews})</span></span> : <span className="text-xs text-ad-muted">—</span>),
            },
            { key: "updated", header: ar ? "آخر تعديل" : "Updated", className: "max-2xl:hidden", cell: (r) => <span className="whitespace-nowrap text-xs text-ad-muted"><TimeAgo date={r.updatedAt} /></span> },
            {
              key: "menu",
              header: <span className="sr-only">{t("c.actions")}</span>,
              align: "end",
              cell: (r) => (
                <div className="flex items-center justify-end gap-1">
                  <button type="button" onClick={() => drawer.open(r.id)} className="grid size-8 place-items-center rounded-lg text-ad-muted transition hover:bg-ad-hover hover:text-ad-fg" aria-label={`${t("c.edit")} ${r.name}`}>
                    <Pencil className="size-4" />
                  </button>
                  {rowMenu(r)}
                </div>
              ),
            },
          ]}
          mobile={(r) => (
            <div className="flex items-center gap-3">
              {r.image ? <img src={r.image} alt="" className="size-14 shrink-0 rounded-lg bg-ad-sunken object-cover" /> : <span className="size-14 shrink-0 rounded-lg bg-ad-sunken" />}
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{r.name}</p>
                <p className="text-sm">{priceCell(r)}</p>
                <div className="mt-1 flex gap-1.5">
                  {statusPill(r.status)}
                  {stockCell(r)}
                </div>
              </div>
            </div>
          )}
        />
        <Pager page={data.page} pageCount={data.pageCount} total={data.total} />
      </Panel>

      <BulkBar count={count} onClear={() => (setSelected(new Set()), setAllMatching(false))}>
        <Button size="xs" variant="outline" loading={pending} onClick={() => bulk({ op: "publish" })}>
          {t("p.bulk.publish")}
        </Button>
        <Button size="xs" variant="outline" onClick={() => bulk({ op: "draft" })}>
          {t("p.bulk.draft")}
        </Button>
        <Dropdown>
          <DropdownTrigger className="h-8 rounded-[10px] border border-ad-border px-3 text-xs font-medium hover:bg-ad-hover">{t("c.more")}…</DropdownTrigger>
          <DropdownContent align="start">
            <DropdownItem onSelect={() => bulk({ op: "feature" })}>{t("p.bulk.feature")}</DropdownItem>
            <DropdownItem onSelect={() => bulk({ op: "unfeature" })}>{t("p.bulk.unfeature")}</DropdownItem>
            <DropdownItem onSelect={() => setDialog("category")}>{t("p.bulk.category")}</DropdownItem>
            <DropdownItem onSelect={() => setDialog("brand")}>{t("p.bulk.brand")}</DropdownItem>
            <DropdownItem onSelect={() => setDialog("price")}>{t("p.bulk.price")}</DropdownItem>
            <DropdownItem onSelect={() => setDialog("sale")}>{t("p.bulk.sale")}</DropdownItem>
            <DropdownItem onSelect={() => setDialog("stock")}>{t("p.bulk.stock")}</DropdownItem>
            <DropdownItem onSelect={() => bulk({ op: "archive" })}>{t("p.bulk.archive")}</DropdownItem>
            {can("catalog.delete") && (
              <DropdownItem className="text-red-600" onSelect={() => setDialog("delete")}>
                {t("p.bulk.delete")}
              </DropdownItem>
            )}
          </DropdownContent>
        </Dropdown>
      </BulkBar>

      <Modal open={dialog === "category" || dialog === "brand" || dialog === "price" || dialog === "sale" || dialog === "stock"} onOpenChange={(o) => !o && setDialog(null)} title={dialog ? t(`p.bulk.${dialog}` as "p.bulk.price") : ""} description={t("c.selected", { n: count })}>
        <div className="space-y-4">
          {dialog === "category" && (
            <Select value={val.categoryId} onChange={(e) => setVal({ ...val, categoryId: e.target.value })}>
              <option value="">—</option>
              {data.categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {"— ".repeat(c.depth)}
                  {c.name}
                </option>
              ))}
            </Select>
          )}
          {dialog === "brand" && (
            <Select value={val.brandId} onChange={(e) => setVal({ ...val, brandId: e.target.value })}>
              <option value="">{t("c.none")}</option>
              {data.brands.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </Select>
          )}
          {(dialog === "price" || dialog === "sale") && (
            <div>
              <Label hint={dialog === "price" ? (locale === "ar" ? "مثلاً 10 للزيادة أو ‎-10 للخفض" : "e.g. 10 to raise, -10 to lower") : locale === "ar" ? "0 لإزالة الخصم" : "0 removes the sale"}>{t("p.bulk.percent")}</Label>
              <TextInput type="number" value={val.percent} onChange={(e) => setVal({ ...val, percent: Number(e.target.value) })} />
            </div>
          )}
          {dialog === "stock" && <TextInput type="number" min={0} value={val.stock} onChange={(e) => setVal({ ...val, stock: Number(e.target.value) })} />}
          <Button
            block
            loading={pending}
            onClick={() =>
              bulk(
                dialog === "category"
                  ? { op: "category", categoryId: val.categoryId }
                  : dialog === "brand"
                    ? { op: "brand", brandId: val.brandId || null }
                    : dialog === "price"
                      ? { op: "price", percent: val.percent }
                      : dialog === "sale"
                        ? { op: "sale", percent: val.percent }
                        : { op: "stock", stock: val.stock },
              )
            }
            disabled={dialog === "category" && !val.categoryId}
          >
            {t("c.apply")}
          </Button>
        </div>
      </Modal>
      <ConfirmDialog
        open={dialog === "delete"}
        onOpenChange={(o) => !o && setDialog(null)}
        title={ar ? `حذف ${count} منتج؟` : `Delete ${count} product${count === 1 ? "" : "s"}?`}
        text={t("p.deleteHasOrders")}
        confirmLabel={t("c.delete")}
        onConfirm={async () => {
          const r = allMatching ? await deleteProductsMatchingAction(filter) : await deleteProductsAction(ids);
          if (r.ok) {
            toast.success(t("c.deleted"));
            setSelected(new Set());
            router.refresh();
          }
        }}
      />

      <AdminDrawer
        open={Boolean(drawer.value)}
        onOpenChange={(o) => !o && drawer.close()}
        size="xl"
        label={t("p.title")}
        canClose={() => !dirty.current || window.confirm(t("c.unsaved"))}
      >
        {editor && (editor.id === drawer.value || !drawer.value) ? (
          <ProductEditor
            key={`${editor.id}-${editor.v}`}
            data={editor.data}
            layout="drawer"
            context={context}
            onDirtyChange={(d) => {
              dirty.current = d;
            }}
            onSaved={() => drawer.value && drawer.value !== "new" && void load(drawer.value)}
            onClose={() => ((dirty.current = false), drawer.close())}
            onOpen={(id) => drawer.open(id)}
          />
        ) : (
          <DrawerSkeleton />
        )}
      </AdminDrawer>
    </>
  );
}

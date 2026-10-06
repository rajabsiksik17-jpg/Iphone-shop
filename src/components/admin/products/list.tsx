"use client";

import { useState, useTransition } from "react";
import { useSearchParams } from "next/navigation";
import { Plus, Star, Copy, Trash2, Eye, MoreHorizontal, Pencil } from "lucide-react";
import { toast } from "sonner";
import { Link, usePathname, useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/overlay";
import { Dropdown, DropdownContent, DropdownItem, DropdownTrigger } from "@/components/ui/menu";
import { useAdmin } from "../admin-context";
import { PageHeader, Panel, DataTable, FilterTabs, SearchBox, Pager, Pill, BulkBar, ConfirmDialog, AdminEmpty } from "../ui";
import { Select, Label, TextInput } from "../fields";
import { bulkProductsAction, duplicateProductAction, deleteProductsAction } from "@/actions/admin/products";
import type { listAdminProducts } from "@/server/admin/products";

type Data = Awaited<ReturnType<typeof listAdminProducts>>;

export const STOCK_TONE = { IN_STOCK: "green", LOW_STOCK: "amber", OUT_OF_STOCK: "red", BACKORDER: "blue", PREORDER: "violet" } as const;

export function ProductsList({ data }: { data: Data }) {
  const { t, fmt, locale, can } = useAdmin();
  const router = useRouter();
  const sp = useSearchParams();
  const pathname = usePathname();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [pending, start] = useTransition();
  const [dialog, setDialog] = useState<null | "category" | "brand" | "price" | "sale" | "stock" | "delete">(null);
  const [val, setVal] = useState<{ categoryId: string; brandId: string; percent: number; stock: number }>({ categoryId: "", brandId: "", percent: 10, stock: 0 });
  const ids = [...selected];

  const setParam = (k: string, v: string) => {
    const p = new URLSearchParams(sp.toString());
    if (v) p.set(k, v);
    else p.delete(k);
    p.delete("page");
    router.push(`${pathname}?${p.toString()}`);
  };

  const bulk = (op: Record<string, unknown>) =>
    start(async () => {
      const r = await bulkProductsAction(ids, op);
      if (r.ok) {
        toast.success(t("p.bulk.done", { n: ids.length }));
        setSelected(new Set());
        setDialog(null);
        router.refresh();
      } else toast.error(t("c.error"));
    });

  const statusPill = (s: string) => <Pill tone={s === "ACTIVE" ? "green" : s === "DRAFT" ? "neutral" : "amber"}>{t(s === "ACTIVE" ? "c.published" : s === "DRAFT" ? "c.draft" : "c.archived")}</Pill>;
  const stockCell = (r: Data["rows"][number]) => (!r.trackInventory ? <span className="text-ad-muted">∞</span> : <Pill tone={STOCK_TONE[r.stockStatus as keyof typeof STOCK_TONE]}>{r.stock}</Pill>);
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
        <DropdownItem asChild>
          <Link href={`/admin/products/${r.id}`}>
            <Pencil /> {t("c.edit")}
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
                  router.push(`/admin/products/${res.data.id}`);
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
            <Button asChild size="sm" leftIcon={<Plus />}>
              <Link href="/admin/products/new">{t("p.new")}</Link>
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
          rows={data.rows}
          href={(r) => `/admin/products/${r.id}`}
          selectable={can("catalog.edit")}
          selected={selected}
          onSelectedChange={setSelected}
          empty={<AdminEmpty action={can("catalog.edit") ? <Button asChild size="sm"><Link href="/admin/products/new">{t("p.new")}</Link></Button> : undefined} />}
          columns={[
            {
              key: "name",
              header: t("c.name"),
              cell: (r) => (
                <div className="flex max-w-[22rem] items-center gap-3">
                  {r.image ? <img src={r.image} alt="" className="size-10 shrink-0 rounded-lg bg-ad-sunken object-cover" /> : <span className="size-10 shrink-0 rounded-lg bg-ad-sunken" />}
                  <div className="min-w-0">
                    <p className="flex items-center gap-1.5 truncate font-medium">
                      {r.name}
                      {r.isFeatured && <Star className="size-3.5 shrink-0 fill-amber-400 text-amber-400" />}
                    </p>
                    <p className="truncate text-xs text-ad-muted">{[r.brand, r.sku, r.type === "VARIABLE" ? t("p.variantsCount", { n: r.variants }) : null].filter(Boolean).join(" · ")}</p>
                  </div>
                </div>
              ),
            },
            { key: "status", header: t("c.status"), cell: (r) => statusPill(r.status) },
            { key: "stock", header: t("p.stock"), cell: stockCell },
            { key: "price", header: t("p.price"), align: "end", cell: priceCell },
            { key: "menu", header: "", className: "w-10", cell: rowMenu },
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

      <BulkBar count={selected.size} onClear={() => setSelected(new Set())}>
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

      <Modal open={dialog === "category" || dialog === "brand" || dialog === "price" || dialog === "sale" || dialog === "stock"} onOpenChange={(o) => !o && setDialog(null)} title={dialog ? t(`p.bulk.${dialog}` as "p.bulk.price") : ""} description={t("c.selected", { n: selected.size })}>
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
        title={t("c.confirmDelete")}
        text={t("p.deleteHasOrders")}
        confirmLabel={t("c.delete")}
        onConfirm={async () => {
          const r = await deleteProductsAction(ids);
          if (r.ok) {
            toast.success(t("c.deleted"));
            setSelected(new Set());
            router.refresh();
          }
        }}
      />
    </>
  );
}

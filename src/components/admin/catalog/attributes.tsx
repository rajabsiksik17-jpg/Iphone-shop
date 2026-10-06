"use client";

import { useState, useTransition } from "react";
import { Plus, Trash2, Filter, Layers, SlidersHorizontal, Pencil } from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { useAdmin } from "../admin-context";
import { PageHeader, Panel, Pill, Switch, ConfirmDialog, AdminEmpty } from "../ui";
import { Label, LocalizedField, Select, TextInput, ColorInput } from "../fields";
import { IconPicker, IconPreview } from "../icon-picker";
import { EditSheet, SectionTitle } from "../entity";
import { SortableList } from "../sortable";
import { saveAttributeAction, deleteAttributeAction, saveAttributeGroupAction, deleteAttributeGroupAction } from "@/actions/admin/catalog";
import { slugify } from "@/lib/utils";
import type { adminAttributes } from "@/server/admin/catalog";

type Data = Awaited<ReturnType<typeof adminAttributes>>;
type Row = Data["rows"][number];
type Value = { id?: string; key: string; slug?: string; label: Record<string, string>; colorHex: string };
type Form = Omit<Row, "id" | "values" | "label" | "group" | "products"> & { id: string | null; values: Value[] };
const TYPES = ["SELECT", "MULTISELECT", "COLOR", "TEXT", "NUMBER", "BOOLEAN"] as const;

export function AttributesManager({ data }: { data: Data }) {
  const { t, locale, can } = useAdmin();
  const router = useRouter();
  const [form, setForm] = useState<Form | null>(null);
  const [group, setGroup] = useState<{ id: string | null; name: Record<string, string>; icon: string | null } | null>(null);
  const [del, setDel] = useState<Row | null>(null);
  const [pending, start] = useTransition();
  const blank = (): Form => ({ id: null, key: "", name: {}, type: "SELECT", unit: "", icon: null, groupId: null, isFilterable: true, isVariantOption: false, isVisible: true, isHighlighted: false, values: [] });

  const save = () =>
    form &&
    start(async () => {
      const r = await saveAttributeAction(form.id, { ...form, values: form.values.map(({ key: _k, ...v }) => v) });
      if (r.ok) {
        toast.success(t("c.saved"));
        setForm(null);
        router.refresh();
      } else toast.error(r.fieldErrors?.key ? (locale === "ar" ? "المفتاح مستخدم" : "Key already used") : t("c.error"));
    });

  const grouped = [...data.groups.map((g) => ({ g, rows: data.rows.filter((r) => r.groupId === g.id) })), { g: null, rows: data.rows.filter((r) => !r.groupId) }].filter((x) => x.rows.length || x.g);

  return (
    <>
      <PageHeader
        title={t("attr.title")}
        description={locale === "ar" ? "الخصائص تُستخدم للمواصفات والفلاتر وخيارات المنتجات" : "Attributes power specifications, filters and product variations"}
        actions={
          can("catalog.edit") && (
            <>
              <Button size="sm" variant="outline" leftIcon={<Layers />} onClick={() => setGroup({ id: null, name: {}, icon: null })}>
                {t("attr.group")}
              </Button>
              <Button size="sm" leftIcon={<Plus />} onClick={() => setForm(blank())}>
                {t("attr.new")}
              </Button>
            </>
          )
        }
      />
      {!data.rows.length && <AdminEmpty icon={<SlidersHorizontal />} />}
      <div className="space-y-4">
        {grouped.map(({ g, rows }) => (
          <Panel
            key={g?.id ?? "none"}
            title={
              <span className="flex items-center gap-2">
                <span className="grid size-7 place-items-center rounded-md bg-ad-sunken">
                  <IconPreview value={g?.icon} className="size-4" />
                </span>
                {g ? g.label : locale === "ar" ? "بدون مجموعة" : "Ungrouped"}
              </span>
            }
            actions={
              g &&
              can("catalog.edit") && (
                <button type="button" onClick={() => setGroup({ id: g.id, name: g.name, icon: g.icon })} className="grid size-8 place-items-center rounded-md text-ad-muted hover:bg-ad-hover" aria-label={t("c.edit")}>
                  <Pencil className="size-4" />
                </button>
              )
            }
            padded={false}
          >
            <ul className="divide-y divide-ad-border">
              {rows.map((r) => (
                <li key={r.id}>
                  <button type="button" onClick={() => setForm({ ...r, values: r.values.map((v) => ({ ...v, key: v.id })) })} className="flex w-full items-center gap-3 px-5 py-3 text-start hover:bg-ad-hover">
                    <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-ad-sunken">
                      <IconPreview value={r.icon} className="size-4" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{r.label}</span>
                      <span className="block truncate text-xs text-ad-muted">
                        {t(`attr.type.${r.type}`)}
                        {r.values.length ? ` · ${r.values.slice(0, 6).map((v) => v.label[locale] || v.label.en).join(", ")}${r.values.length > 6 ? "…" : ""}` : ""}
                      </span>
                    </span>
                    <span className="hidden gap-1 sm:flex">
                      {r.isFilterable && (
                        <Pill tone="blue">
                          <Filter className="size-3" />
                        </Pill>
                      )}
                      {r.isVariantOption && <Pill tone="violet">{t("p.variants")}</Pill>}
                      {!r.isVisible && <Pill>{t("c.hidden")}</Pill>}
                      {r.isHighlighted && <Pill tone="violet">{locale === "ar" ? "أساسية" : "Key"}</Pill>}
                    </span>
                    <span className="w-16 text-end text-xs text-ad-muted">{r.products}</span>
                  </button>
                </li>
              ))}
            </ul>
          </Panel>
        ))}
      </div>

      <EditSheet
        open={Boolean(form)}
        onOpenChange={(o) => !o && setForm(null)}
        title={form?.id ? form.name[locale] || form.name.en : t("attr.new")}
        onSave={save}
        saving={pending}
        wide
        footerExtra={
          form?.id && can("catalog.delete") ? (
            <Button variant="ghost" size="sm" className="text-red-600" leftIcon={<Trash2 />} onClick={() => setDel(data.rows.find((r) => r.id === form.id) ?? null)}>
              {t("c.delete")}
            </Button>
          ) : undefined
        }
      >
        {form && (
          <>
            <LocalizedField label={t("c.name")} value={form.name} onChange={(v) => setForm({ ...form, name: v as Record<string, string>, key: form.id ? form.key : slugify(v.en || "") })} required />
            <div className="grid gap-4 sm:grid-cols-3">
              <div>
                <Label>{t("attr.key")}</Label>
                <TextInput value={form.key} onChange={(e) => setForm({ ...form, key: slugify(e.target.value) })} dir="ltr" />
              </div>
              <div>
                <Label>{t("c.type")}</Label>
                <Select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as Form["type"] })}>
                  {TYPES.map((ty) => (
                    <option key={ty} value={ty}>
                      {t(`attr.type.${ty}`)}
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <Label optional>{t("attr.unit")}</Label>
                <TextInput value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} placeholder="GB, mAh, W…" />
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label>{t("attr.group")}</Label>
                <Select value={form.groupId ?? ""} onChange={(e) => setForm({ ...form, groupId: e.target.value || null })}>
                  <option value="">—</option>
                  {data.groups.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.label}
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <Label hint={locale === "ar" ? "تظهر بجانب المواصفة في صفحة المنتج" : "Shown next to the spec on product pages"}>{t("c.icon")}</Label>
                <IconPicker value={form.icon} onChange={(v) => setForm({ ...form, icon: v })} />
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <Switch checked={form.isFilterable} onCheckedChange={(v) => setForm({ ...form, isFilterable: v })} label={t("attr.filterable")} />
              <Switch checked={form.isVariantOption} onCheckedChange={(v) => setForm({ ...form, isVariantOption: v })} label={t("attr.variantOption")} />
              <Switch checked={form.isVisible} onCheckedChange={(v) => setForm({ ...form, isVisible: v })} label={t("attr.visible")} />
              <Switch
                checked={form.isHighlighted}
                disabled={form.isVariantOption}
                onCheckedChange={(v) => setForm({ ...form, isHighlighted: v })}
                label={locale === "ar" ? "مواصفة أساسية" : "Key spec"}
                description={locale === "ar" ? "تظهر كبطاقة بأيقونة أعلى صفحة المنتج (حتى 6)" : "Shown as an icon tile near the top of the product page (up to 6)"}
              />
            </div>
            {["SELECT", "MULTISELECT", "COLOR"].includes(form.type) && (
              <>
                <SectionTitle>
                  {t("attr.values")} ({form.values.length})
                </SectionTitle>
                <SortableList
                  className="space-y-2"
                  items={form.values}
                  getId={(v) => v.key}
                  onChange={(values) => setForm({ ...form, values })}
                  render={(v, handle) => (
                    <div className="flex items-start gap-2 rounded-lg border border-ad-border p-2">
                      {handle}
                      <div className="grid flex-1 gap-2 sm:grid-cols-2">
                        <TextInput value={v.label.en ?? ""} onChange={(e) => setForm({ ...form, values: form.values.map((x) => (x.key === v.key ? { ...x, label: { ...x.label, en: e.target.value } } : x)) })} placeholder="English" dir="ltr" />
                        <TextInput value={v.label.ar ?? ""} onChange={(e) => setForm({ ...form, values: form.values.map((x) => (x.key === v.key ? { ...x, label: { ...x.label, ar: e.target.value } } : x)) })} placeholder="العربية" dir="rtl" />
                        {form.type === "COLOR" && (
                          <div className="sm:col-span-2">
                            <ColorInput value={v.colorHex} onChange={(c) => setForm({ ...form, values: form.values.map((x) => (x.key === v.key ? { ...x, colorHex: c } : x)) })} />
                          </div>
                        )}
                      </div>
                      <button type="button" onClick={() => setForm({ ...form, values: form.values.filter((x) => x.key !== v.key) })} className="grid size-8 place-items-center rounded-md text-ad-muted hover:bg-ad-hover hover:text-red-600" aria-label={t("c.remove")}>
                        <Trash2 className="size-4" />
                      </button>
                    </div>
                  )}
                />
                <Button size="sm" variant="outline" leftIcon={<Plus />} onClick={() => setForm({ ...form, values: [...form.values, { key: `n${Date.now()}`, label: {}, colorHex: form.type === "COLOR" ? "#000000" : "" }] })}>
                  {t("attr.addValue")}
                </Button>
              </>
            )}
          </>
        )}
      </EditSheet>

      <EditSheet
        open={Boolean(group)}
        onOpenChange={(o) => !o && setGroup(null)}
        title={t("attr.group")}
        saving={pending}
        onSave={() =>
          group &&
          start(async () => {
            const r = await saveAttributeGroupAction(group.id, { name: group.name, icon: group.icon });
            if (r.ok) {
              setGroup(null);
              router.refresh();
            } else toast.error(t("c.error"));
          })
        }
        footerExtra={
          group?.id && can("catalog.delete") ? (
            <Button variant="ghost" size="sm" className="text-red-600" onClick={() => start(async () => { await deleteAttributeGroupAction(group.id!); setGroup(null); router.refresh(); })}>
              {t("c.delete")}
            </Button>
          ) : undefined
        }
      >
        {group && (
          <>
            <LocalizedField label={t("c.name")} value={group.name} onChange={(v) => setGroup({ ...group, name: v as Record<string, string> })} required />
            <div>
              <Label>{t("c.icon")}</Label>
              <IconPicker value={group.icon} onChange={(v) => setGroup({ ...group, icon: v })} />
            </div>
          </>
        )}
      </EditSheet>

      <ConfirmDialog
        open={Boolean(del)}
        onOpenChange={(o) => !o && setDel(null)}
        title={t("c.confirmDelete")}
        text={del?.products ? (locale === "ar" ? `مستخدمة في ${del.products} منتج وستُحذف منها.` : `Used by ${del.products} products — it will be removed from them.`) : t("c.confirmDeleteText")}
        confirmLabel={t("c.delete")}
        onConfirm={async () => {
          if (!del) return;
          await deleteAttributeAction(del.id);
          setForm(null);
          router.refresh();
        }}
      />
    </>
  );
}

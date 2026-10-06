"use client";

import { useEffect, useState, useTransition } from "react";
import { ArrowLeftToLine, ArrowRightToLine, ExternalLink, Eye, EyeOff, Menu as MenuIcon, Pencil, Plus, Sparkles, Trash2, Wand2 } from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { useAdmin } from "../admin-context";
import { PageHeader, Panel, Pill, Switch } from "../ui";
import { Label, TextInput, Select, LocalizedField, FieldError, ImageField } from "../fields";
import { IconPicker, IconPreview } from "../icon-picker";
import { EditSheet } from "../entity";
import { SortableList } from "../sortable";
import { ProductPicker, type PickedProduct } from "../product-picker";
import { saveMenuAction } from "@/actions/admin/content";
import { t as tr, type LocalizedText } from "@/lib/i18n-text";
import { cn } from "@/lib/utils";
import type { menuList } from "@/server/admin/content";

type Data = Awaited<ReturnType<typeof menuList>>;
type RawItem = Data["menus"][number]["items"][number];
type Item = Omit<RawItem, "parentId"> & { depth: number };
const TYPES = ["CATEGORY", "ALL_CATEGORIES", "ALL_BRANDS", "PAGE", "BRAND", "PRODUCT", "SHOP", "URL"] as const;
/** Types whose dropdown is generated from the catalogue. */
const AUTO = new Set<string>(["ALL_CATEGORIES", "ALL_BRANDS"]);
const MAX_DEPTH = 2;
let seq = 0;
const tmpId = () => `tmp-${Date.now().toString(36)}${(seq++).toString(36)}`;

/** Tree (parentId + position order) → flat list with depth, depth-first. */
function flatten(items: RawItem[]): Item[] {
  const out: Item[] = [];
  const walk = (parent: string | null, depth: number) => {
    for (const it of items.filter((i) => i.parentId === parent)) {
      const { parentId: _p, ...rest } = it;
      out.push({ ...rest, depth });
      walk(it.id, depth + 1);
    }
  };
  walk(null, 0);
  return out;
}

/** Keep depths valid: first item is top-level, nobody jumps more than one level deeper than the item above. */
function normalize(list: Item[]): Item[] {
  return list.map((it, i, arr) => ({ ...it, depth: i === 0 ? 0 : Math.min(it.depth, arr[i - 1].depth + 1, MAX_DEPTH) })).map((it, i, arr) => (i === 0 ? it : { ...it, depth: Math.min(it.depth, arr[i - 1].depth + 1) }));
}

function withParents(list: Item[]) {
  const stack: string[] = [];
  return list.map((it) => {
    stack.length = it.depth;
    const parentId = it.depth ? (stack[it.depth - 1] ?? null) : null;
    stack[it.depth] = it.id;
    const { depth: _d, ...rest } = it;
    return { ...rest, parentId };
  });
}

export function MenusView({ data }: { data: Data }) {
  const { t, locale } = useAdmin();
  const router = useRouter();
  const [menuId, setMenuId] = useState(data.menus[0]?.id ?? "");
  const menu = data.menus.find((m) => m.id === menuId);
  const [name, setName] = useState(menu?.name ?? "");
  const [items, setItems] = useState<Item[]>(() => flatten(menu?.items ?? []));
  const [dirty, setDirty] = useState(false);
  const [editing, setEditing] = useState<Item | null>(null);
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [products, setProducts] = useState<PickedProduct[]>(data.refs.products);
  const [pending, start] = useTransition();

  useEffect(() => {
    const m = data.menus.find((x) => x.id === menuId);
    setName(m?.name ?? "");
    setItems(flatten(m?.items ?? []));
    setDirty(false);
    setErrors({});
  }, [menuId, data.menus]);

  const change = (list: Item[]) => (setItems(normalize(list)), setDirty(true));
  const resolveLabel = (it: Item) => {
    const own = tr(it.label, locale);
    if (own) return own;
    const find = (arr: { id: string; name: string }[]) => arr.find((x) => x.id === it.refId)?.name.replace(/^(— )+/, "");
    switch (it.type) {
      case "PAGE":
        return find(data.refs.pages);
      case "CATEGORY":
        return find(data.refs.categories);
      case "BRAND":
        return find(data.refs.brands);
      case "PRODUCT":
        return products.find((p) => p.id === it.refId)?.name;
      case "SHOP":
      case "ALL_CATEGORIES":
      case "ALL_BRANDS":
        return t(`cms.type.${it.type}` as "cms.type.URL");
      default:
        return it.url;
    }
  };

  const save = () =>
    start(async () => {
      const r = await saveMenuAction(menuId, { name, items: withParents(items) });
      if (r.ok) {
        toast.success(t("c.saved"));
        setDirty(false);
        setErrors({});
        router.refresh();
      } else {
        setErrors(r.fieldErrors ?? {});
        toast.error(t("c.fixErrors"));
      }
    });

  const commitItem = (it: Item) => {
    const exists = items.some((x) => x.id === it.id);
    change(exists ? items.map((x) => (x.id === it.id ? it : x)) : [...items, it]);
    setEditing(null);
  };

  const refOptions = editing?.type === "PAGE" ? data.refs.pages : editing?.type === "CATEGORY" ? data.refs.categories : editing?.type === "BRAND" ? data.refs.brands : [];
  const errorIndex = (i: number) => Object.keys(errors).some((k) => k.startsWith(`items.${i}.`));

  return (
    <>
      <PageHeader title={t("cms.menus")} description={locale === "ar" ? "قوائم الهيدر والفوتر — حتى ثلاثة مستويات" : "Header and footer navigation — up to three levels"} />
      <div className="mb-4 flex flex-wrap gap-2">
        {data.menus.map((m) => (
          <button
            key={m.id}
            type="button"
            onClick={() => (dirty && !window.confirm(t("c.unsaved")) ? null : setMenuId(m.id))}
            className={cn("flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-[13px] transition", m.id === menuId ? "border-ad-fg bg-ad-fg text-ad-panel" : "border-ad-border bg-ad-panel hover:border-ad-fg/30")}
          >
            <MenuIcon className="size-3.5" /> {m.name}
            <span className="opacity-60">{m.items.length}</span>
          </button>
        ))}
      </div>

      {menu && (
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
          <Panel
            padded={false}
            title={name}
            description={<code className="text-xs">{menu.key}</code>}
            actions={
              <Button size="sm" variant="outline" leftIcon={<Plus />} onClick={() => setEditing({ id: tmpId(), label: {}, type: "CATEGORY", refId: null, url: "", openInNewTab: false, highlight: false, icon: null, image: null, badge: {}, autoChildren: true, isVisible: true, depth: 0 })}>
                {t("cms.addMenuItem")}
              </Button>
            }
          >
            {items.length ? (
              <SortableList
                items={items}
                getId={(i) => i.id}
                onChange={change}
                className="space-y-1 p-2"
                render={(it, handle, i) => (
                  <div className={cn("flex items-center gap-1.5 rounded-xl border bg-ad-panel px-2 py-1.5", errorIndex(i) ? "border-red-400" : "border-ad-border", !it.isVisible && "opacity-55")} style={{ marginInlineStart: `${it.depth * 28}px` }}>
                    {handle}
                    <button type="button" onClick={() => setEditing(it)} className="flex min-w-0 flex-1 items-center gap-2 py-1 text-start">
                      {it.image ? <img src={it.image} alt="" className="size-6 shrink-0 rounded-md object-cover" /> : it.icon ? <IconPreview value={it.icon} className="size-4 shrink-0" /> : null}
                      <span className="truncate text-sm font-medium">{resolveLabel(it) || "—"}</span>
                      <Pill>{t(`cms.type.${it.type}` as "cms.type.URL")}</Pill>
                      {tr(it.badge, locale) && <span className="rounded-full bg-red-500 px-1.5 text-[10px] font-bold uppercase leading-4 text-white">{tr(it.badge, locale)}</span>}
                      {(AUTO.has(it.type) || (it.type === "CATEGORY" && it.autoChildren)) && <Wand2 className="size-3.5 text-ad-accent" aria-label={t("cms.autoChildren")} />}
                      {it.highlight && <Sparkles className="size-3.5 text-amber-500" aria-label={t("cms.highlight")} />}
                      {it.openInNewTab && <ExternalLink className="size-3.5 text-ad-muted" aria-label={t("cms.newTab")} />}
                    </button>
                    <Button size="icon-sm" variant="ghost" aria-label={t(it.isVisible ? "cms.hide" : "cms.show")} title={t(it.isVisible ? "cms.hide" : "cms.show")} onClick={() => change(items.map((x) => (x.id === it.id ? { ...x, isVisible: !x.isVisible } : x)))}>
                      {it.isVisible ? <Eye /> : <EyeOff />}
                    </Button>
                    <Button size="icon-sm" variant="ghost" aria-label={t("cms.outdent")} disabled={it.depth === 0} onClick={() => change(items.map((x) => (x.id === it.id ? { ...x, depth: x.depth - 1 } : x)))}>
                      <ArrowLeftToLine className="rtl:rotate-180" />
                    </Button>
                    <Button size="icon-sm" variant="ghost" aria-label={t("cms.indent")} disabled={i === 0 || it.depth >= MAX_DEPTH || it.depth > items[i - 1].depth} onClick={() => change(items.map((x) => (x.id === it.id ? { ...x, depth: x.depth + 1 } : x)))}>
                      <ArrowRightToLine className="rtl:rotate-180" />
                    </Button>
                    <Button size="icon-sm" variant="ghost" aria-label={t("c.edit")} onClick={() => setEditing(it)}>
                      <Pencil />
                    </Button>
                    <Button
                      size="icon-sm"
                      variant="ghost"
                      className="text-red-600"
                      aria-label={t("c.delete")}
                      onClick={() => {
                        // Remove the item and its nested children.
                        let end = i + 1;
                        while (end < items.length && items[end].depth > it.depth) end++;
                        change([...items.slice(0, i), ...items.slice(end)]);
                      }}
                    >
                      <Trash2 />
                    </Button>
                  </div>
                )}
              />
            ) : (
              <p className="px-4 py-10 text-center text-sm text-ad-muted">{t("c.empty")}</p>
            )}
          </Panel>
          <Panel title={t("c.settings")}>
            <div className="space-y-4">
              <div>
                <Label>{t("c.name")}</Label>
                <TextInput value={name} onChange={(e) => (setName(e.target.value), setDirty(true))} />
              </div>
              <p className="text-xs leading-relaxed text-ad-muted">
                {locale === "ar"
                  ? "اسحب لإعادة الترتيب واستخدم أزرار الإزاحة لإنشاء قوائم فرعية. الروابط للصفحات والتصنيفات تتحدث تلقائياً عند تغيير روابطها."
                  : "Drag to reorder and use the indent buttons to build sub-menus. Links to pages and categories update automatically if their URLs change."}
              </p>
              <Button block loading={pending} disabled={!dirty} onClick={save}>
                {t("c.save")}
              </Button>
              {dirty && <p className="text-center text-xs text-ad-muted">{t("c.unsaved")}</p>}
            </div>
          </Panel>
        </div>
      )}

      <EditSheet open={Boolean(editing)} onOpenChange={(o) => !o && setEditing(null)} title={t("cms.menuItem")} onSave={() => editing && commitItem(editing)}>
        {editing && (
          <div className="space-y-5">
            <div>
              <Label>{t("cms.linkType")}</Label>
              <Select value={editing.type} onChange={(e) => setEditing({ ...editing, type: e.target.value as Item["type"], refId: null })}>
                {TYPES.map((x) => (
                  <option key={x} value={x}>
                    {t(`cms.type.${x}` as "cms.type.URL")}
                  </option>
                ))}
              </Select>
            </div>
            {editing.type === "URL" && (
              <div>
                <Label>{t("cms.buttonUrl")}</Label>
                <TextInput value={editing.url} onChange={(e) => setEditing({ ...editing, url: e.target.value.trim() })} dir="ltr" placeholder="/shop?sale=1 or https://…" />
              </div>
            )}
            {(editing.type === "PAGE" || editing.type === "CATEGORY" || editing.type === "BRAND") && (
              <div>
                <Label>{t(`cms.type.${editing.type}` as "cms.type.URL")}</Label>
                <Select value={editing.refId ?? ""} onChange={(e) => setEditing({ ...editing, refId: e.target.value || null })}>
                  <option value="">—</option>
                  {refOptions.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.name}
                    </option>
                  ))}
                </Select>
              </div>
            )}
            {AUTO.has(editing.type) && (
              <p className="rounded-lg bg-ad-sunken p-3 text-xs leading-relaxed text-ad-muted">
                {editing.type === "ALL_CATEGORIES"
                  ? locale === "ar"
                    ? "قائمة منسدلة كبيرة تُبنى تلقائياً من شجرة التصنيفات (حتى ثلاثة مستويات مع الصور). أي تصنيف تضيفه لاحقاً يظهر هنا دون تعديل القائمة."
                    : "A mega menu built automatically from the category tree (up to three levels, with images). New categories appear here without editing the menu."
                  : locale === "ar"
                    ? "شبكة شعارات تُبنى تلقائياً من العلامات التجارية النشطة."
                    : "A logo grid built automatically from your active brands."}
              </p>
            )}
            {editing.type === "CATEGORY" && (
              <Switch
                checked={editing.autoChildren}
                onCheckedChange={(v) => setEditing({ ...editing, autoChildren: v })}
                label={t("cms.autoChildren")}
                description={locale === "ar" ? "إظهار التصنيفات الفرعية تلقائياً في القائمة المنسدلة (يتم تجاهله إذا أضفت عناصر فرعية يدوياً)" : "Show this category's subcategories in its dropdown automatically (ignored when you add sub-items manually)"}
              />
            )}
            {editing.type === "PRODUCT" && (
              <ProductPicker
                max={1}
                value={editing.refId ? [products.find((p) => p.id === editing.refId) ?? { id: editing.refId, name: editing.refId, image: null }] : []}
                onChange={(v) => {
                  setProducts((prev) => [...prev, ...v.filter((x) => !prev.some((y) => y.id === x.id))]);
                  setEditing({ ...editing, refId: v[0]?.id ?? null });
                }}
              />
            )}
            <LocalizedField
              label={t("cms.buttonLabel")}
              hint={editing.type !== "URL" ? (locale === "ar" ? "اتركه فارغاً لاستخدام الاسم الأصلي" : "Leave empty to use the linked item's name") : undefined}
              value={editing.label as LocalizedText}
              onChange={(v) => setEditing({ ...editing, label: v as Record<string, string> })}
            />
            <FieldError message={editing.type === "URL" && !editing.url ? (locale === "ar" ? "الرابط مطلوب" : "URL is required") : null} />
            <LocalizedField
              label={t("cms.badge")}
              hint={locale === "ar" ? "نص قصير مثل «جديد» أو «-30%» — اختياري" : "Short text like “New” or “-30%” — optional"}
              value={editing.badge as LocalizedText}
              onChange={(v) => setEditing({ ...editing, badge: v as Record<string, string> })}
            />
            <IconPicker label={t("cms.icon")} value={editing.icon} onChange={(v) => setEditing({ ...editing, icon: v })} />
            <ImageField label={t("cms.menuImage")} aspect="aspect-[3/1]" folder="menus" value={editing.image ? { id: "", url: editing.image } : null} onChange={(v) => setEditing({ ...editing, image: v?.url ?? null })} />
            <Switch checked={editing.isVisible} onCheckedChange={(v) => setEditing({ ...editing, isVisible: v })} label={t("cms.visible")} />
            <Switch checked={editing.openInNewTab} onCheckedChange={(v) => setEditing({ ...editing, openInNewTab: v })} label={t("cms.newTab")} />
            <Switch checked={editing.highlight} onCheckedChange={(v) => setEditing({ ...editing, highlight: v })} label={t("cms.highlight")} description={locale === "ar" ? "يظهر بلون مميز (مثل العروض)" : "Shown in the accent colour (e.g. Deals)"} />
          </div>
        )}
      </EditSheet>
    </>
  );
}

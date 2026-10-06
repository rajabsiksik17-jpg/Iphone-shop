"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useSearchParams } from "next/navigation";
import { Plus, Pencil, Trash2, ChevronUp, ChevronDown, ExternalLink, FolderTree, EyeOff, Star, CornerDownRight } from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { useAdmin } from "../admin-context";
import { PageHeader, Panel, Pill, Switch, ConfirmDialog, AdminEmpty } from "../ui";
import { Label, LocalizedField, Select, TextInput, ImageField, type MediaRef } from "../fields";
import { IconPicker, IconPreview } from "../icon-picker";
import { EditSheet, SeoFields, SectionTitle, emptySeo, type SeoValue } from "../entity";
import { saveCategoryAction, deleteCategoryAction, reorderCategoriesAction } from "@/actions/admin/catalog";
import { slugify, cn } from "@/lib/utils";
import type { adminCategories } from "@/server/admin/catalog";

type Data = Awaited<ReturnType<typeof adminCategories>>;
type Row = Data["rows"][number];
type Form = { id: string | null; name: Record<string, string>; slug: string; parentId: string | null; description: Record<string, string>; icon: string | null; image: MediaRef; banner: MediaRef; isActive: boolean; isFeatured: boolean; attributeIds: string[]; seo: SeoValue };

const blank = (parentId: string | null = null): Form => ({ id: null, name: {}, slug: "", parentId, description: {}, icon: null, image: null, banner: null, isActive: true, isFeatured: false, attributeIds: [], seo: emptySeo() });

export function CategoriesManager({ data }: { data: Data }) {
  const { t, locale, can } = useAdmin();
  const router = useRouter();
  const sp = useSearchParams();
  const [form, setForm] = useState<Form | null>(null);
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [del, setDel] = useState<Row | null>(null);
  const [pending, start] = useTransition();
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  const open = (r: Row) =>
    setForm({ id: r.id, name: r.name, slug: r.slug, parentId: r.parentId, description: r.description, icon: r.icon, image: r.image, banner: r.banner, isActive: r.isActive, isFeatured: r.isFeatured, attributeIds: r.attributeIds, seo: r.seo });

  useEffect(() => {
    const edit = sp.get("edit");
    if (edit) {
      const r = data.rows.find((x) => x.id === edit);
      if (r) open(r);
    } else if (sp.get("new")) setForm(blank());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Hide descendants of collapsed nodes.
  const visible = useMemo(() => {
    const hidden = new Set<string>();
    return data.rows.filter((r) => {
      if (r.parentId && (hidden.has(r.parentId) || collapsed.has(r.parentId))) {
        hidden.add(r.id);
        return false;
      }
      return true;
    });
  }, [data.rows, collapsed]);

  const descendants = (id: string) => {
    const self = data.rows.find((r) => r.id === id);
    return new Set(data.rows.filter((r) => self && r.fullSlug.startsWith(`${self.fullSlug}/`)).map((r) => r.id));
  };

  const move = (r: Row, dir: -1 | 1) => {
    const siblings = data.rows.filter((x) => x.parentId === r.parentId);
    const i = siblings.findIndex((x) => x.id === r.id);
    const j = i + dir;
    if (j < 0 || j >= siblings.length) return;
    const ids = siblings.map((x) => x.id);
    [ids[i], ids[j]] = [ids[j], ids[i]];
    start(async () => {
      await reorderCategoriesAction(r.parentId, ids);
      router.refresh();
    });
  };

  const save = () => {
    if (!form) return;
    setErrors({});
    start(async () => {
      const r = await saveCategoryAction(form.id, {
        name: form.name,
        slug: form.slug,
        parentId: form.parentId,
        description: form.description,
        icon: form.icon,
        imageId: form.image?.id ?? null,
        bannerId: form.banner?.id ?? null,
        isActive: form.isActive,
        isFeatured: form.isFeatured,
        attributeIds: form.attributeIds,
        seo: form.seo,
      });
      if (r.ok) {
        toast.success(t("c.saved"));
        setForm(null);
        router.refresh();
      } else {
        setErrors(r.fieldErrors ?? {});
        toast.error(r.error === "category_cycle" ? (locale === "ar" ? "لا يمكن نقل تصنيف تحت أحد فروعه" : "A category can't be moved under its own child") : t("c.error"));
      }
    });
  };

  const excluded = form?.id ? new Set([form.id, ...descendants(form.id)]) : new Set<string>();

  return (
    <>
      <PageHeader
        title={t("cat.title")}
        description={locale === "ar" ? `${data.rows.length} تصنيف · تداخل غير محدود` : `${data.rows.length} categories · unlimited nesting`}
        actions={
          can("catalog.edit") && (
            <Button size="sm" leftIcon={<Plus />} onClick={() => setForm(blank())}>
              {t("cat.new")}
            </Button>
          )
        }
      />
      <Panel padded={false}>
        {!data.rows.length ? (
          <AdminEmpty icon={<FolderTree />} action={<Button size="sm" onClick={() => setForm(blank())}>{t("cat.new")}</Button>} />
        ) : (
          <ul className="divide-y divide-ad-border">
            {visible.map((r) => {
              const siblings = data.rows.filter((x) => x.parentId === r.parentId);
              const idx = siblings.findIndex((x) => x.id === r.id);
              return (
                <li key={r.id} className={cn("group flex items-center gap-2 py-2.5 pe-3", !r.isActive && "opacity-60")} style={{ paddingInlineStart: `${12 + r.depth * 22}px` }}>
                  {r.children > 0 ? (
                    <button type="button" onClick={() => setCollapsed((c) => { const n = new Set(c); if (n.has(r.id)) n.delete(r.id); else n.add(r.id); return n; })} className="grid size-6 place-items-center rounded text-ad-muted hover:bg-ad-hover" aria-label="Toggle" aria-expanded={!collapsed.has(r.id)}>
                      <ChevronDown className={cn("size-4 transition", collapsed.has(r.id) && "-rotate-90 rtl:rotate-90")} />
                    </button>
                  ) : (
                    <span className="grid size-6 place-items-center text-ad-muted/50">{r.depth > 0 && <CornerDownRight className="size-3.5 rtl:-scale-x-100" />}</span>
                  )}
                  {r.image ? <img src={r.image.url} alt="" className="size-9 shrink-0 rounded-lg object-cover" /> : <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-ad-sunken"><IconPreview value={r.icon} className="size-4" /></span>}
                  <button type="button" onClick={() => open(r)} className="min-w-0 flex-1 text-start">
                    <span className="flex items-center gap-1.5 truncate text-sm font-medium">
                      {r.label}
                      {r.isFeatured && <Star className="size-3.5 fill-amber-400 text-amber-400" />}
                      {!r.isActive && <EyeOff className="size-3.5 text-ad-muted" />}
                    </span>
                    <span className="block truncate text-xs text-ad-muted" dir="ltr">
                      /category/{r.fullSlug}
                    </span>
                  </button>
                  <Pill>{t("cat.products", { n: r.products })}</Pill>
                  <div className="flex items-center opacity-100 transition md:opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100">
                    {can("catalog.edit") && (
                      <>
                        <button type="button" disabled={idx === 0 || pending} onClick={() => move(r, -1)} className="grid size-8 place-items-center rounded-md text-ad-muted hover:bg-ad-hover disabled:opacity-30" aria-label={t("c.moveUp")}>
                          <ChevronUp className="size-4" />
                        </button>
                        <button type="button" disabled={idx === siblings.length - 1 || pending} onClick={() => move(r, 1)} className="grid size-8 place-items-center rounded-md text-ad-muted hover:bg-ad-hover disabled:opacity-30" aria-label={t("c.moveDown")}>
                          <ChevronDown className="size-4" />
                        </button>
                        <button type="button" onClick={() => setForm(blank(r.id))} className="grid size-8 place-items-center rounded-md text-ad-muted hover:bg-ad-hover" title={locale === "ar" ? "إضافة تصنيف فرعي" : "Add sub-category"}>
                          <Plus className="size-4" />
                        </button>
                        <button type="button" onClick={() => open(r)} className="grid size-8 place-items-center rounded-md text-ad-muted hover:bg-ad-hover" aria-label={t("c.edit")}>
                          <Pencil className="size-4" />
                        </button>
                      </>
                    )}
                    <a href={`/${locale}/category/${r.fullSlug}`} target="_blank" rel="noopener" className="grid size-8 place-items-center rounded-md text-ad-muted hover:bg-ad-hover" aria-label={t("c.view")}>
                      <ExternalLink className="size-4" />
                    </a>
                    {can("catalog.delete") && (
                      <button type="button" onClick={() => setDel(r)} className="grid size-8 place-items-center rounded-md text-ad-muted hover:bg-ad-hover hover:text-red-600" aria-label={t("c.delete")}>
                        <Trash2 className="size-4" />
                      </button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Panel>

      <EditSheet open={Boolean(form)} onOpenChange={(o) => !o && setForm(null)} title={form?.id ? `${t("c.edit")}: ${form.name[locale] || form.name.en || ""}` : t("cat.new")} onSave={save} saving={pending} wide>
        {form && (
          <>
            <LocalizedField label={t("c.name")} value={form.name} onChange={(v) => setForm({ ...form, name: v as Record<string, string>, slug: form.id ? form.slug : slugify(v.en || v.ar || "") })} required />
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label>{t("c.slug")}</Label>
                <TextInput value={form.slug} onChange={(e) => setForm({ ...form, slug: slugify(e.target.value) })} dir="ltr" invalid={Boolean(errors.slug)} />
                {errors.slug && <p className="mt-1 text-xs text-red-600">{locale === "ar" ? "الرابط مستخدم ضمن نفس المستوى" : "Slug already used at this level"}</p>}
              </div>
              <div>
                <Label>{t("cat.parent")}</Label>
                <Select value={form.parentId ?? ""} onChange={(e) => setForm({ ...form, parentId: e.target.value || null })}>
                  <option value="">{t("cat.root")}</option>
                  {data.rows
                    .filter((r) => !excluded.has(r.id))
                    .map((r) => (
                      <option key={r.id} value={r.id}>
                        {"— ".repeat(r.depth)}
                        {r.label}
                      </option>
                    ))}
                </Select>
              </div>
            </div>
            <LocalizedField label={t("c.description")} value={form.description} onChange={(v) => setForm({ ...form, description: v as Record<string, string> })} multiline rows={2} />
            <div className="grid gap-4 sm:grid-cols-[1fr_1fr_auto]">
              <ImageField label={t("c.image")} value={form.image} onChange={(v) => setForm({ ...form, image: v })} folder="categories" aspect="aspect-square" />
              <ImageField label={t("cat.banner")} value={form.banner} onChange={(v) => setForm({ ...form, banner: v })} folder="categories" aspect="aspect-square" />
              <div>
                <Label>{t("c.icon")}</Label>
                <IconPicker value={form.icon} onChange={(v) => setForm({ ...form, icon: v })} />
              </div>
            </div>
            <div className="flex flex-wrap gap-6">
              <Switch checked={form.isActive} onCheckedChange={(v) => setForm({ ...form, isActive: v })} label={t("c.visible")} />
              <Switch checked={form.isFeatured} onCheckedChange={(v) => setForm({ ...form, isFeatured: v })} label={t("c.featured")} />
            </div>
            <SectionTitle>{t("cat.filters")}</SectionTitle>
            <p className="-mt-3 text-xs text-ad-muted">{t("cat.filtersHint")}</p>
            <div className="flex flex-wrap gap-1.5">
              {data.attributes.map((a) => {
                const on = form.attributeIds.includes(a.id);
                return (
                  <button key={a.id} type="button" onClick={() => setForm({ ...form, attributeIds: on ? form.attributeIds.filter((x) => x !== a.id) : [...form.attributeIds, a.id] })} className={cn("rounded-full border px-2.5 py-1 text-xs transition", on ? "border-ad-accent bg-ad-accent/10 text-ad-fg" : "border-ad-border text-ad-muted")}>
                    {a.name}
                  </button>
                );
              })}
            </div>
            <SectionTitle>{t("c.seo")}</SectionTitle>
            <SeoFields value={form.seo} onChange={(seo) => setForm({ ...form, seo })} />
          </>
        )}
      </EditSheet>

      <ConfirmDialog
        open={Boolean(del)}
        onOpenChange={(o) => !o && setDel(null)}
        title={t("c.confirmDelete")}
        text={del?.children ? t("cat.hasChildren") : t("c.confirmDeleteText")}
        confirmLabel={t("c.delete")}
        onConfirm={async () => {
          if (!del) return;
          const r = await deleteCategoryAction(del.id);
          if (r.ok) {
            toast.success(t("c.deleted"));
            router.refresh();
          } else toast.error(r.error === "category_has_children" ? t("cat.hasChildren") : t("c.error"));
        }}
      />
    </>
  );
}

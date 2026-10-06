"use client";

import { useEffect, useState, useTransition } from "react";
import { useSearchParams } from "next/navigation";
import { Plus, Star, EyeOff, ExternalLink, Trash2, BadgeCheck } from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { useAdmin } from "../admin-context";
import { PageHeader, Switch, ConfirmDialog, AdminEmpty } from "../ui";
import { Label, LocalizedField, TextInput, ImageField, type MediaRef } from "../fields";
import { EditSheet, SeoFields, SectionTitle, emptySeo, type SeoValue } from "../entity";
import { SortableList } from "../sortable";
import { saveBrandAction, deleteBrandAction, reorderBrandsAction } from "@/actions/admin/catalog";
import { slugify, cn } from "@/lib/utils";
import type { adminBrands } from "@/server/admin/catalog";

type Row = Awaited<ReturnType<typeof adminBrands>>[number];
type Form = { id: string | null; name: Record<string, string>; slug: string; description: Record<string, string>; logo: MediaRef; banner: MediaRef; website: string; isActive: boolean; isFeatured: boolean; seo: SeoValue };

export function BrandsManager({ rows: initial }: { rows: Row[] }) {
  const { t, locale, can } = useAdmin();
  const router = useRouter();
  const sp = useSearchParams();
  const [rows, setRows] = useState(initial);
  const [form, setForm] = useState<Form | null>(null);
  const [del, setDel] = useState<Row | null>(null);
  const [pending, start] = useTransition();
  useEffect(() => setRows(initial), [initial]);

  const open = (b: Row) => setForm({ id: b.id, name: b.name, slug: b.slug, description: b.description, logo: b.logo, banner: b.banner, website: b.website, isActive: b.isActive, isFeatured: b.isFeatured, seo: b.seo });
  const blank = (): Form => ({ id: null, name: {}, slug: "", description: {}, logo: null, banner: null, website: "", isActive: true, isFeatured: false, seo: emptySeo() });

  useEffect(() => {
    const e = sp.get("edit");
    const b = e && initial.find((x) => x.id === e);
    if (b) open(b);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const save = () =>
    form &&
    start(async () => {
      const r = await saveBrandAction(form.id, { name: form.name, slug: form.slug, description: form.description, logoId: form.logo?.id ?? null, bannerId: form.banner?.id ?? null, website: form.website, isActive: form.isActive, isFeatured: form.isFeatured, seo: form.seo });
      if (r.ok) {
        toast.success(t("c.saved"));
        setForm(null);
        router.refresh();
      } else toast.error(r.fieldErrors?.slug ? (locale === "ar" ? "الرابط مستخدم" : "Slug already used") : t("c.error"));
    });

  return (
    <>
      <PageHeader title={t("brand.title")} description={locale === "ar" ? "اسحب البطاقات لإعادة ترتيب ظهورها في المتجر" : "Drag cards to set their order on the store"} actions={can("catalog.edit") && <Button size="sm" leftIcon={<Plus />} onClick={() => setForm(blank())}>{t("brand.new")}</Button>} />
      {!rows.length ? (
        <AdminEmpty icon={<BadgeCheck />} />
      ) : (
        <SortableList
          layout="grid"
          className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5"
          items={rows}
          getId={(b) => b.id}
          onChange={(next) => {
            setRows(next);
            start(async () => void (await reorderBrandsAction(next.map((b) => b.id))));
          }}
          render={(b, handle) => (
            <div className={cn("group relative rounded-xl border border-ad-border bg-ad-panel p-4 transition hover:shadow-pop", !b.isActive && "opacity-60")}>
              <div className="absolute end-2 top-2 flex opacity-100 md:opacity-0 md:group-hover:opacity-100">{can("catalog.edit") && handle}</div>
              <button type="button" onClick={() => open(b)} className="block w-full text-start">
                <div className="grid h-16 place-items-center">{b.logo ? <img src={b.logo.url} alt="" className="max-h-12 max-w-[80%] object-contain" /> : <span className="text-lg font-semibold">{b.label}</span>}</div>
                <p className="mt-3 flex items-center gap-1.5 truncate text-sm font-medium">
                  {b.label}
                  {b.isFeatured && <Star className="size-3.5 fill-amber-400 text-amber-400" />}
                  {!b.isActive && <EyeOff className="size-3.5 text-ad-muted" />}
                </p>
                <p className="text-xs text-ad-muted">{t("cat.products", { n: b.products })}</p>
              </button>
            </div>
          )}
        />
      )}
      <EditSheet
        open={Boolean(form)}
        onOpenChange={(o) => !o && setForm(null)}
        title={form?.id ? form.name[locale] || form.name.en : t("brand.new")}
        onSave={save}
        saving={pending}
        footerExtra={
          form?.id && can("catalog.delete") ? (
            <>
              <Button variant="ghost" size="sm" className="text-red-600" leftIcon={<Trash2 />} onClick={() => setDel(rows.find((r) => r.id === form.id) ?? null)}>
                {t("c.delete")}
              </Button>
              <a href={`/${locale}/brand/${form.slug}`} target="_blank" rel="noopener" className="grid size-9 place-items-center rounded-lg text-ad-muted hover:bg-ad-hover" aria-label={t("c.view")}>
                <ExternalLink className="size-4" />
              </a>
            </>
          ) : undefined
        }
      >
        {form && (
          <>
            <LocalizedField label={t("c.name")} value={form.name} onChange={(v) => setForm({ ...form, name: v as Record<string, string>, slug: form.id ? form.slug : slugify(v.en || v.ar || "") })} required />
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label hint={`/brand/${form.slug}`}>{t("c.slug")}</Label>
                <TextInput value={form.slug} onChange={(e) => setForm({ ...form, slug: slugify(e.target.value) })} dir="ltr" />
              </div>
              <div>
                <Label optional>{t("brand.website")}</Label>
                <TextInput value={form.website} onChange={(e) => setForm({ ...form, website: e.target.value })} dir="ltr" placeholder="https://" />
              </div>
            </div>
            <LocalizedField label={t("c.description")} value={form.description} onChange={(v) => setForm({ ...form, description: v as Record<string, string> })} multiline rows={3} />
            <div className="grid gap-4 sm:grid-cols-2">
              <ImageField label={t("brand.logo")} value={form.logo} onChange={(v) => setForm({ ...form, logo: v })} folder="brands" />
              <ImageField label={t("cat.banner")} value={form.banner} onChange={(v) => setForm({ ...form, banner: v })} folder="brands" />
            </div>
            <div className="flex flex-wrap gap-6">
              <Switch checked={form.isActive} onCheckedChange={(v) => setForm({ ...form, isActive: v })} label={t("c.visible")} />
              <Switch checked={form.isFeatured} onCheckedChange={(v) => setForm({ ...form, isFeatured: v })} label={t("c.featured")} />
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
        text={del?.products ? (locale === "ar" ? `سيتم فك ارتباط ${del.products} منتج بهذه العلامة.` : `${del.products} products will be unlinked from this brand.`) : t("c.confirmDeleteText")}
        confirmLabel={t("c.delete")}
        onConfirm={async () => {
          if (!del) return;
          const r = await deleteBrandAction(del.id);
          if (r.ok) {
            setForm(null);
            router.refresh();
          }
        }}
      />
    </>
  );
}

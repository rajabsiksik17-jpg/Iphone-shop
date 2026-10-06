"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { CircleHelp, FolderPlus, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { useAdmin } from "../admin-context";
import { PageHeader, Panel, Pill, Switch, ConfirmDialog, AdminEmpty, SearchBox } from "../ui";
import { Label, TextInput, Select, LocalizedField, FieldError } from "../fields";
import { EditSheet } from "../entity";
import { SortableList } from "../sortable";
import { saveFaqAction, deleteFaqAction, saveFaqCategoryAction, deleteFaqCategoryAction, reorderContentAction } from "@/actions/admin/content";
import { t as tr, type LocalizedText } from "@/lib/i18n-text";
import { cn } from "@/lib/utils";
import type { faqList } from "@/server/admin/content";
import { useSearchParams } from "next/navigation";

type Data = Awaited<ReturnType<typeof faqList>>;
type Faq = Data["faqs"][number];
type Cat = Data["categories"][number];

export function FaqView({ data }: { data: Data }) {
  const { t, locale } = useAdmin();
  const router = useRouter();
  const q = (useSearchParams().get("q") ?? "").toLowerCase();
  const [faqs, setFaqs] = useState(data.faqs);
  const [cats, setCats] = useState(data.categories);
  const [activeCat, setActiveCat] = useState<string | "all" | "none">("all");
  const [editing, setEditing] = useState<{ id: string | null; form: Omit<Faq, "id"> } | null>(null);
  const [catEditing, setCatEditing] = useState<{ id: string | null; slug: string; name: LocalizedText } | null>(null);
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [confirm, setConfirm] = useState<{ kind: "faq" | "cat"; id: string; label: string } | null>(null);
  const [pending, start] = useTransition();
  useEffect(() => setFaqs(data.faqs), [data.faqs]);
  useEffect(() => setCats(data.categories), [data.categories]);

  const visible = useMemo(
    () =>
      faqs.filter(
        (f) =>
          (activeCat === "all" || (activeCat === "none" ? !f.categoryId : f.categoryId === activeCat)) &&
          (!q || `${tr(f.question, "en")} ${tr(f.question, "ar")} ${tr(f.answer, "en")} ${tr(f.answer, "ar")}`.toLowerCase().includes(q)),
      ),
    [faqs, activeCat, q],
  );
  const canReorder = activeCat !== "all" && !q;

  const saveFaq = () =>
    editing &&
    start(async () => {
      const r = await saveFaqAction(editing.id, editing.form);
      if (r.ok) {
        toast.success(t("c.saved"));
        setEditing(null);
        router.refresh();
      } else {
        setErrors(r.fieldErrors ?? {});
        toast.error(t("c.fixErrors"));
      }
    });

  const saveCat = () =>
    catEditing &&
    start(async () => {
      const r = await saveFaqCategoryAction(catEditing.id, { slug: catEditing.slug, name: catEditing.name });
      if (r.ok) {
        toast.success(t("c.saved"));
        setCatEditing(null);
        router.refresh();
      } else {
        setErrors(r.fieldErrors ?? {});
        toast.error(t("c.fixErrors"));
      }
    });

  const catName = (id: string | null) => (id ? tr(cats.find((c) => c.id === id)?.name, locale) : t("cms.uncategorised"));
  const uncategorised = faqs.filter((f) => !f.categoryId).length;

  return (
    <>
      <PageHeader
        title={t("cms.faq")}
        description={locale === "ar" ? "تظهر في صفحة المساعدة وفي أقسام الأسئلة" : "Shown on the Help page and in FAQ sections"}
        actions={
          <>
            <Button variant="outline" leftIcon={<FolderPlus />} onClick={() => (setErrors({}), setCatEditing({ id: null, slug: "", name: {} }))}>
              {t("cms.newCategory")}
            </Button>
            <Button leftIcon={<Plus />} onClick={() => (setErrors({}), setEditing({ id: null, form: { categoryId: activeCat !== "all" && activeCat !== "none" ? activeCat : (cats[0]?.id ?? null), question: {}, answer: {}, isActive: true } }))}>
              {t("cms.newQuestion")}
            </Button>
          </>
        }
      />
      <div className="grid gap-4 lg:grid-cols-[minmax(0,260px)_minmax(0,1fr)]">
        <Panel padded={false} title={t("cms.faqCategory")}>
          <ul className="p-1.5">
            <CatButton active={activeCat === "all"} onClick={() => setActiveCat("all")} label={t("c.all")} count={faqs.length} />
            <SortableList
              items={cats}
              getId={(c) => c.id}
              onChange={(list) => {
                setCats(list);
                start(async () => void (await reorderContentAction("faqCategory", list.map((c) => c.id))));
              }}
              render={(c: Cat, handle) => (
                <div className="flex items-center">
                  {handle}
                  <CatButton active={activeCat === c.id} onClick={() => setActiveCat(c.id)} label={tr(c.name, locale)} count={faqs.filter((f) => f.categoryId === c.id).length} />
                  <Button size="icon-sm" variant="ghost" aria-label={t("c.edit")} onClick={() => (setErrors({}), setCatEditing({ id: c.id, slug: c.slug, name: c.name }))}>
                    <Pencil />
                  </Button>
                </div>
              )}
            />
            {uncategorised > 0 && <CatButton active={activeCat === "none"} onClick={() => setActiveCat("none")} label={t("cms.uncategorised")} count={uncategorised} />}
          </ul>
        </Panel>
        <Panel padded={false}>
          <div className="border-b border-ad-border p-3">
            <SearchBox />
          </div>
          {visible.length ? (
            canReorder ? (
              <SortableList
                items={visible}
                getId={(f) => f.id}
                onChange={(list) => {
                  setFaqs((all) => [...all.filter((f) => !list.some((x) => x.id === f.id)), ...list]);
                  start(async () => void (await reorderContentAction("faq", list.map((f) => f.id))));
                }}
                className="divide-y divide-ad-border"
                render={(f, handle) => <FaqRow f={f} handle={handle} onEdit={() => (setErrors({}), setEditing({ id: f.id, form: { categoryId: f.categoryId, question: f.question, answer: f.answer, isActive: f.isActive } }))} />}
              />
            ) : (
              <ul className="divide-y divide-ad-border">
                {visible.map((f) => (
                  <li key={f.id}>
                    <FaqRow f={f} category={catName(f.categoryId)} onEdit={() => (setErrors({}), setEditing({ id: f.id, form: { categoryId: f.categoryId, question: f.question, answer: f.answer, isActive: f.isActive } }))} />
                  </li>
                ))}
              </ul>
            )
          ) : (
            <AdminEmpty icon={<CircleHelp />} />
          )}
        </Panel>
      </div>

      <EditSheet
        open={Boolean(editing)}
        onOpenChange={(o) => !o && setEditing(null)}
        title={editing?.id ? t("c.edit") : t("cms.newQuestion")}
        onSave={saveFaq}
        saving={pending}
        wide
        footerExtra={
          editing?.id && (
            <Button variant="ghost" className="text-red-600" leftIcon={<Trash2 />} onClick={() => setConfirm({ kind: "faq", id: editing.id!, label: tr(editing.form.question, locale) })}>
              {t("c.delete")}
            </Button>
          )
        }
      >
        {editing && (
          <div className="space-y-5">
            <div>
              <Label>{t("cms.faqCategory")}</Label>
              <Select value={editing.form.categoryId ?? ""} onChange={(e) => setEditing({ ...editing, form: { ...editing.form, categoryId: e.target.value || null } })}>
                <option value="">{t("cms.uncategorised")}</option>
                {cats.map((c) => (
                  <option key={c.id} value={c.id}>
                    {tr(c.name, locale)}
                  </option>
                ))}
              </Select>
            </div>
            <LocalizedField label={t("cms.question")} value={editing.form.question} onChange={(v) => setEditing({ ...editing, form: { ...editing.form, question: v as Record<string, string> } })} required maxLength={300} error={errors.question ? t("c.required") : null} />
            <LocalizedField label={t("cms.answer")} value={editing.form.answer} onChange={(v) => setEditing({ ...editing, form: { ...editing.form, answer: v as Record<string, string> } })} multiline rows={6} required maxLength={5000} error={errors.answer ? t("c.required") : null} />
            <Switch checked={editing.form.isActive} onCheckedChange={(v) => setEditing({ ...editing, form: { ...editing.form, isActive: v } })} label={t("c.active")} />
          </div>
        )}
      </EditSheet>

      <EditSheet
        open={Boolean(catEditing)}
        onOpenChange={(o) => !o && setCatEditing(null)}
        title={catEditing?.id ? t("c.edit") : t("cms.newCategory")}
        onSave={saveCat}
        saving={pending}
        footerExtra={
          catEditing?.id && (
            <Button variant="ghost" className="text-red-600" leftIcon={<Trash2 />} onClick={() => setConfirm({ kind: "cat", id: catEditing.id!, label: tr(catEditing.name, locale) })}>
              {t("c.delete")}
            </Button>
          )
        }
      >
        {catEditing && (
          <div className="space-y-5">
            <LocalizedField
              label={t("c.name")}
              value={catEditing.name}
              required
              error={errors.name ? t("c.required") : null}
              onChange={(v) => setCatEditing({ ...catEditing, name: v, slug: catEditing.id ? catEditing.slug : (v.en ?? "").toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") })}
            />
            <div>
              <Label>{t("c.slug")}</Label>
              <TextInput value={catEditing.slug} onChange={(e) => setCatEditing({ ...catEditing, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "") })} dir="ltr" invalid={Boolean(errors.slug)} />
              <FieldError message={errors.slug ? (errors.slug[0] === "taken" ? t("cms.slugTaken") : t("c.required")) : null} />
            </div>
          </div>
        )}
      </EditSheet>

      <ConfirmDialog
        open={Boolean(confirm)}
        onOpenChange={(o) => !o && setConfirm(null)}
        title={t("c.confirmDelete")}
        text={confirm?.kind === "cat" ? `${confirm.label} — ${locale === "ar" ? "ستبقى الأسئلة بدون تصنيف" : "its questions become uncategorised"}` : confirm?.label}
        confirmLabel={t("c.delete")}
        onConfirm={async () => {
          if (!confirm) return;
          const r = confirm.kind === "faq" ? await deleteFaqAction(confirm.id) : await deleteFaqCategoryAction(confirm.id);
          if (r.ok) {
            toast.success(t("c.deleted"));
            if (confirm.kind === "cat" && activeCat === confirm.id) setActiveCat("all");
            setConfirm(null);
            setEditing(null);
            setCatEditing(null);
            router.refresh();
          }
        }}
      />
    </>
  );
}

function CatButton({ active, onClick, label, count }: { active: boolean; onClick: () => void; label: string; count: number }) {
  return (
    <button type="button" onClick={onClick} className={cn("flex min-w-0 flex-1 items-center gap-2 rounded-lg px-3 py-2 text-start text-sm transition", active ? "bg-ad-accent/10 font-medium text-ad-accent" : "hover:bg-ad-hover")}>
      <span className="truncate">{label}</span>
      <span className="tabular ms-auto text-xs text-ad-muted">{count}</span>
    </button>
  );
}

function FaqRow({ f, handle, onEdit, category }: { f: Faq; handle?: React.ReactNode; onEdit: () => void; category?: string }) {
  const { t, locale } = useAdmin();
  return (
    <div className={cn("flex items-start gap-2 px-3 py-3", !f.isActive && "opacity-60")}>
      {handle}
      <button type="button" onClick={onEdit} className="min-w-0 flex-1 text-start">
        <span className="block text-sm font-medium">{tr(f.question, locale)}</span>
        <span className="mt-0.5 line-clamp-2 block text-xs leading-relaxed text-ad-muted">{tr(f.answer, locale)}</span>
        {category && <span className="mt-1 block text-[11px] text-ad-muted">{category}</span>}
      </button>
      {!f.isActive && <Pill>{t("c.hidden")}</Pill>}
      <Button size="icon-sm" variant="ghost" aria-label={t("c.edit")} onClick={onEdit}>
        <Pencil />
      </Button>
    </div>
  );
}

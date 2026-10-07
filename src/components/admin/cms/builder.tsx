"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { AlertCircle, Copy, Eye, EyeOff, ExternalLink, Monitor, PanelsTopLeft, Plus, Search, Settings2, Smartphone, Trash2, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/overlay";
import { useAdmin } from "../admin-context";
import { PageHeader, Panel, Pill, Segmented, Switch, ConfirmDialog } from "../ui";
import { Label, TextInput, Select, LocalizedField, ColorInput, FieldError } from "../fields";
import { SeoFields, emptySeo, SectionTitle, type SeoValue } from "../entity";
import { SortableList } from "../sortable";
import { IconPreview } from "../icon-picker";
import { FieldForm, type FieldRefs } from "./field-form";
import { savePageAction, deletePageAction } from "@/actions/admin/content";
import { SECTION_DEFINITIONS, sectionDef, initialSectionData, type SectionStyle } from "@/cms/sections";
import { t as tr, type LocalizedText } from "@/lib/i18n-text";
import { timeAgo } from "@/lib/time";
import { cn } from "@/lib/utils";
import type { PageEditorData } from "@/server/admin/content";
import type { PickedProduct } from "../product-picker";

type Section = { id?: string; key: string; type: string; isVisible: boolean; data: Record<string, unknown>; style: SectionStyle };
type Meta = { slug: string; template: string; title: LocalizedText; excerpt: LocalizedText; status: "DRAFT" | "PUBLISHED"; seo: SeoValue };

const defaultStyle = (): SectionStyle => ({ background: "none", customBackground: "", paddingY: "md", width: "contained", align: "start", hideOnMobile: false, hideOnDesktop: false, anchor: "", animate: true });
let seq = 0;
const newKey = () => `s${Date.now().toString(36)}${(seq++).toString(36)}`;
const slugify = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/[\s_]+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 80);

export function PageBuilder({ data }: { data: PageEditorData }) {
  const { t, locale } = useAdmin();
  const router = useRouter();
  const page = data.page;
  const isNew = !page;

  const initialMeta = (): Meta => ({
    slug: page?.slug ?? "",
    template: page?.template ?? "standard",
    title: page?.title ?? {},
    excerpt: page?.excerpt ?? {},
    status: page?.status ?? "DRAFT",
    seo: { ...emptySeo(), ...((page?.seo ?? {}) as Partial<SeoValue>) },
  });
  const initialSections = (): Section[] => (page?.sections ?? []).map((s) => ({ ...s, key: s.id }));

  const [meta, setMeta] = useState<Meta>(initialMeta);
  const [sections, setSections] = useState<Section[]>(initialSections);
  const [selected, setSelected] = useState<string | "settings" | null>(isNew ? "settings" : (page?.sections[0]?.id ?? "settings"));
  const [tab, setTab] = useState<"content" | "style">("content");
  const [dirty, setDirty] = useState(isNew);
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [adding, setAdding] = useState(false);
  const [query, setQuery] = useState("");
  const [preview, setPreview] = useState<null | "desktop" | "mobile">(null);
  const [previewNonce, setPreviewNonce] = useState(0);
  const [savedAt, setSavedAt] = useState<string | null>(page?.updatedAt ?? null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [products, setProducts] = useState<PickedProduct[]>(data.refs.products);
  const [pending, start] = useTransition();
  const slugTouched = useRef(!isNew);

  const refs: FieldRefs = useMemo(() => ({ ...data.refs, products }), [data.refs, products]);
  const current = sections.find((s) => s.key === selected) ?? null;
  const def = current ? sectionDef(current.type) : null;

  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => {
      if (dirty) e.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const touch = () => setDirty(true);
  const updateMeta = <K extends keyof Meta>(k: K, v: Meta[K]) => (setMeta((m) => ({ ...m, [k]: v })), touch());
  const updateSection = (key: string, patch: Partial<Section>) => (setSections((list) => list.map((s) => (s.key === key ? { ...s, ...patch } : s))), touch());

  const addSection = (type: string) => {
    const s: Section = { key: newKey(), type, isVisible: true, data: initialSectionData(type), style: defaultStyle() };
    setSections((list) => {
      const at = list.findIndex((x) => x.key === selected);
      const next = [...list];
      next.splice(at >= 0 ? at + 1 : next.length, 0, s);
      return next;
    });
    setSelected(s.key);
    setTab("content");
    setAdding(false);
    setQuery("");
    touch();
  };

  const duplicate = (s: Section) => {
    const copy: Section = { ...structuredClone({ type: s.type, isVisible: s.isVisible, data: s.data, style: s.style }), key: newKey() };
    setSections((list) => {
      const i = list.findIndex((x) => x.key === s.key);
      const next = [...list];
      next.splice(i + 1, 0, copy);
      return next;
    });
    setSelected(copy.key);
    touch();
  };

  const remove = (s: Section) => {
    setSections((list) => list.filter((x) => x.key !== s.key));
    if (selected === s.key) setSelected("settings");
    touch();
  };

  const save = () =>
    start(async () => {
      const payload = { ...meta, sections: sections.map(({ key: _k, ...s }) => s) };
      const r = await savePageAction(page?.id ?? null, payload);
      if (!r.ok) {
        setErrors(r.fieldErrors ?? {});
        const sectionErr = Object.keys(r.fieldErrors ?? {}).find((k) => k.startsWith("sections."));
        if (sectionErr) setSelected(sections[Number(sectionErr.split(".")[1])]?.key ?? selected);
        else if (r.fieldErrors?.slug || r.fieldErrors?.title) setSelected("settings");
        toast.error(t("c.fixErrors"));
        return;
      }
      setErrors({});
      setDirty(false);
      setSavedAt(new Date().toISOString());
      setPreviewNonce((n) => n + 1);
      toast.success(t("c.saved"));
      if (isNew || r.data.slug !== page?.slug) router.replace(`/admin/pages/${r.data.slug}`);
      else router.refresh();
    });

  const discard = () => {
    setMeta(initialMeta());
    setSections(initialSections());
    setDirty(false);
    setErrors({});
  };

  const publicPath = `/${locale}${meta.slug === "home" ? "" : `/${meta.slug}`}`;
  const sectionName = (type: string) => tr(sectionDef(type)?.name, locale) || type;
  const sectionSummary = (s: Section) => tr(s.data.title, locale) || tr(s.data.heading, locale) || "";
  const filteredDefs = SECTION_DEFINITIONS.filter((d) => !query || `${tr(d.name, "en")} ${tr(d.name, "ar")} ${tr(d.description, locale)}`.toLowerCase().includes(query.toLowerCase()));
  const statusTone = meta.status === "PUBLISHED" ? "green" : "amber";
  const slugError = errors.slug?.[0] === "reserved" ? t("cms.slugReserved") : errors.slug?.[0] === "taken" ? t("cms.slugTaken") : errors.slug ? t("c.required") : null;

  return (
    <>
      <PageHeader
        back={{ href: "/admin/pages", label: t("cms.pages") }}
        title={
          <span className="flex flex-wrap items-center gap-2">
            {tr(meta.title, locale) || t("cms.newPage")}
            <Pill tone={statusTone}>{t(meta.status === "PUBLISHED" ? "c.published" : "c.draft")}</Pill>
          </span>
        }
        description={
          <span dir="ltr" className="inline-block">
            {publicPath}
            {savedAt && !isNew && <span className="text-ad-muted" suppressHydrationWarning> · {t("cms.lastSaved", { t: timeAgo(savedAt, locale) })}</span>}
          </span>
        }
        actions={
          <>
            {!isNew && (
              <Segmented
                size="sm"
                value={preview ?? "edit"}
                onChange={(v) => setPreview(v === "edit" ? null : (v as "desktop" | "mobile"))}
                options={[
                  { value: "edit", label: <PanelsTopLeft className="size-4" aria-label={t("c.edit")} /> },
                  { value: "desktop", label: <Monitor className="size-4" aria-label={t("cms.desktop")} /> },
                  { value: "mobile", label: <Smartphone className="size-4" aria-label={t("cms.mobile")} /> },
                ]}
              />
            )}
            {!isNew && (
              <Button asChild size="sm" variant="outline" leftIcon={<ExternalLink />}>
                <a href={`${publicPath}${meta.status !== "PUBLISHED" ? "?preview=1" : ""}`} target="_blank" rel="noopener">
                  {t("c.view")}
                </a>
              </Button>
            )}
            <Button size="sm" loading={pending} onClick={save} disabled={!dirty && !isNew}>
              {t("c.save")}
            </Button>
          </>
        }
      />

      <div className="grid gap-4 lg:grid-cols-[minmax(0,340px)_minmax(0,1fr)]">
        {/* Outline */}
        <div className="space-y-3 lg:sticky lg:top-20 lg:self-start">
          <button
            type="button"
            onClick={() => (setSelected("settings"), setPreview(null))}
            className={cn("flex w-full items-center gap-3 rounded-xl border bg-ad-panel px-3.5 py-3 text-start text-sm font-medium transition", selected === "settings" ? "border-ad-accent ring-2 ring-ad-accent/20" : "border-ad-border hover:border-ad-fg/20")}
          >
            <Settings2 className="size-4 text-ad-muted" /> {t("cms.pageSettings")}
            {(errors.slug || errors.title) && <AlertCircle className="ms-auto size-4 text-red-500" />}
          </button>
          <Panel title={`${t("cms.sections")} · ${sections.length}`} padded={false}>
            {sections.length ? (
              <SortableList
                items={sections}
                getId={(s) => s.key}
                onChange={(list) => (setSections(list), touch())}
                className="divide-y divide-ad-border"
                render={(s, handle, i) => {
                  const d = sectionDef(s.type);
                  const hasError = Object.keys(errors).some((k) => k === `sections.${i}`);
                  return (
                    <div className={cn("group flex items-center gap-1.5 px-2 py-2", selected === s.key && "bg-ad-accent/5", !s.isVisible && "opacity-55")}>
                      {handle}
                      <button type="button" onClick={() => (setSelected(s.key), setPreview(null))} className="flex min-w-0 flex-1 items-center gap-2.5 py-1 text-start">
                        <span className={cn("grid size-8 shrink-0 place-items-center rounded-lg", selected === s.key ? "bg-ad-accent text-white" : "bg-ad-sunken text-ad-muted")}>
                          <IconPreview value={`lucide:${d?.icon ?? "Square"}`} className="size-4" />
                        </span>
                        <span className="min-w-0">
                          <span className="block truncate text-[13px] font-medium">{sectionName(s.type)}</span>
                          {sectionSummary(s) && <span className="block truncate text-xs text-ad-muted">{sectionSummary(s)}</span>}
                        </span>
                        {hasError && <AlertCircle className="size-4 shrink-0 text-red-500" />}
                      </button>
                      <Button size="icon-sm" variant="ghost" aria-label={s.isVisible ? t("c.hidden") : t("c.visible")} onClick={() => updateSection(s.key, { isVisible: !s.isVisible })}>
                        {s.isVisible ? <Eye /> : <EyeOff />}
                      </Button>
                    </div>
                  );
                }}
              />
            ) : (
              <p className="px-4 py-8 text-center text-sm text-ad-muted">{t("cms.noSections")}</p>
            )}
            <div className="border-t border-ad-border p-2">
              <Button block size="sm" variant="outline" leftIcon={<Plus />} onClick={() => setAdding(true)}>
                {t("cms.addSection")}
              </Button>
            </div>
          </Panel>
        </div>

        {/* Editor / preview */}
        <div className="min-w-0">
          {preview ? (
            <Panel
              padded={false}
              title={t("cms.livePreview")}
              description={dirty ? t("cms.saveToPreview") : t("cms.previewHint")}
              actions={
                <Button size="icon-sm" variant="ghost" aria-label="Reload" onClick={() => setPreviewNonce((n) => n + 1)}>
                  <RefreshCw />
                </Button>
              }
            >
              <div className="bg-ad-sunken p-3">
                <iframe
                  key={previewNonce}
                  title={t("cms.livePreview")}
                  src={`${publicPath}?preview=1`}
                  className={cn("mx-auto block h-[75vh] rounded-lg border border-ad-border bg-white shadow-sm transition-[width]", preview === "mobile" ? "w-[390px] max-w-full" : "w-full")}
                />
              </div>
            </Panel>
          ) : selected === "settings" || !current || !def ? (
            <Panel title={t("cms.pageSettings")}>
              <div className="space-y-5">
                <LocalizedField
                  label={t("c.title")}
                  value={meta.title}
                  required
                  error={errors.title ? t("c.required") : null}
                  onChange={(v) => {
                    updateMeta("title", v);
                    if (!slugTouched.current && !page?.isSystem) setMeta((m) => ({ ...m, title: v, slug: slugify(v.en || "") }));
                  }}
                />
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <Label hint={page?.isSystem ? t("cms.system") : undefined}>{t("c.slug")}</Label>
                    <div className="flex items-center rounded-lg border border-ad-border bg-ad-panel ps-3 text-sm focus-within:ring-2 focus-within:ring-ad-accent/30" dir="ltr">
                      <span className="text-ad-muted">/</span>
                      <input
                        className="h-10 min-w-0 flex-1 bg-transparent px-1 outline-none disabled:text-ad-muted"
                        value={meta.slug}
                        disabled={page?.isSystem}
                        onChange={(e) => {
                          slugTouched.current = true;
                          updateMeta("slug", slugify(e.target.value));
                        }}
                      />
                    </div>
                    <FieldError message={slugError} />
                  </div>
                  <div>
                    <Label>{t("cms.template")}</Label>
                    <Select value={meta.template} disabled={page?.isSystem} onChange={(e) => updateMeta("template", e.target.value)}>
                      {(["standard", "legal", "contact", "faq"] as const).concat(meta.template === "home" ? (["home"] as never[]) : []).map((x) => (
                        <option key={x} value={x}>
                          {t(`cms.tpl.${x}` as "cms.tpl.standard")}
                        </option>
                      ))}
                    </Select>
                  </div>
                </div>
                <div>
                  <Label>{t("c.status")}</Label>
                  <Segmented
                    value={meta.status}
                    onChange={(v) => updateMeta("status", v)}
                    options={[
                      { value: "DRAFT", label: t("c.draft") },
                      { value: "PUBLISHED", label: t("c.published") },
                    ]}
                  />
                </div>
                <LocalizedField label={t("cms.excerpt")} value={meta.excerpt} onChange={(v) => updateMeta("excerpt", v)} multiline rows={2} />
                <SectionTitle>{t("c.seo")}</SectionTitle>
                <SeoFields value={meta.seo} onChange={(v) => updateMeta("seo", v)} />
                {!isNew && !page?.isSystem && (
                  <div className="border-t border-ad-border pt-4">
                    <Button variant="ghost" className="text-red-600" leftIcon={<Trash2 />} onClick={() => setConfirmDelete(true)}>
                      {t("c.delete")}
                    </Button>
                  </div>
                )}
              </div>
            </Panel>
          ) : (
            <Panel
              title={
                <span className="flex items-center gap-2">
                  <IconPreview value={`lucide:${def.icon}`} className="size-4 text-ad-muted" />
                  {tr(def.name, locale)}
                </span>
              }
              description={tr(def.description, locale)}
              actions={
                <div className="flex gap-1">
                  <Button size="icon-sm" variant="ghost" aria-label={t("c.duplicate")} onClick={() => duplicate(current)}>
                    <Copy />
                  </Button>
                  <Button size="icon-sm" variant="ghost" className="text-red-600" aria-label={t("c.delete")} onClick={() => remove(current)}>
                    <Trash2 />
                  </Button>
                </div>
              }
            >
              <Segmented
                value={tab}
                onChange={setTab}
                options={[
                  { value: "content", label: t("c.content") },
                  { value: "style", label: t("cms.sectionStyle") },
                ]}
              />
              {Object.entries(errors)
                .filter(([k]) => k === `sections.${sections.indexOf(current)}`)
                .flatMap(([, v]) => v)
                .map((m) => (
                  <p key={m} className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700 dark:bg-red-950/40 dark:text-red-300">
                    {m}
                  </p>
                ))}
              <div className="mt-5">
                {tab === "content" ? (
                  def.fields.length ? (
                    <FieldForm fields={def.fields} value={current.data} refs={refs} onChange={(v) => updateSection(current.key, { data: v })} onProductsPicked={(p) => setProducts((prev) => [...prev, ...p.filter((x) => !prev.some((y) => y.id === x.id))])} />
                  ) : (
                    <p className="text-sm text-ad-muted">{tr(def.description, locale)}</p>
                  )
                ) : (
                  <StyleForm value={current.style} onChange={(v) => updateSection(current.key, { style: v })} />
                )}
              </div>
            </Panel>
          )}
        </div>
      </div>

      {/* Add section */}
      <Modal open={adding} onOpenChange={setAdding} title={t("cms.addSection")} className="sm:max-w-3xl">
        <div className="relative mb-4">
          <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-ad-muted" />
          <TextInput autoFocus value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t("cms.searchSections")} className="ps-9" />
        </div>
        <div className="grid max-h-[60vh] gap-2 overflow-y-auto sm:grid-cols-2">
          {filteredDefs.map((d) => {
            const taken = d.singleton && sections.some((s) => s.type === d.type);
            return (
              <button
                key={d.type}
                type="button"
                disabled={taken}
                onClick={() => addSection(d.type)}
                className="flex items-start gap-3 rounded-xl border border-ad-border p-3 text-start transition hover:border-ad-accent hover:bg-ad-accent/5 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-ad-sunken">
                  <IconPreview value={`lucide:${d.icon}`} className="size-4" />
                </span>
                <span>
                  <span className="block text-sm font-medium">{tr(d.name, locale)}</span>
                  <span className="mt-0.5 block text-xs leading-relaxed text-ad-muted">{tr(d.description, locale)}</span>
                </span>
              </button>
            );
          })}
        </div>
      </Modal>

      {/* Sticky save bar */}
      <div className={cn("fixed inset-x-3 bottom-20 z-30 mx-auto flex max-w-2xl items-center gap-3 rounded-2xl border border-ad-border bg-ad-panel p-2.5 ps-4 shadow-pop transition lg:bottom-6", dirty ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-4 opacity-0")}>
        <span className="flex min-w-0 flex-1 items-center gap-2 text-sm">
          <AlertCircle className="size-4 shrink-0 text-amber-500" /> <span className="truncate max-sm:sr-only">{t("c.unsaved")}</span>
        </span>
        {!isNew && (
          <Button variant="ghost" size="sm" onClick={discard}>
            {t("c.discard")}
          </Button>
        )}
        <Button size="sm" loading={pending} onClick={save}>
          {t("c.save")}
        </Button>
      </div>

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title={t("c.confirmDelete")}
        text={tr(meta.title, locale)}
        confirmLabel={t("c.delete")}
        onConfirm={async () => {
          if (!page) return;
          const r = await deletePageAction(page.id);
          if (r.ok) {
            setDirty(false);
            toast.success(t("c.deleted"));
            router.replace("/admin/pages");
          } else toast.error(t("c.error"));
        }}
      />
    </>
  );
}

function StyleForm({ value, onChange }: { value: SectionStyle; onChange: (v: SectionStyle) => void }) {
  const { t } = useAdmin();
  const set = <K extends keyof SectionStyle>(k: K, v: SectionStyle[K]) => onChange({ ...value, [k]: v });
  return (
    <div className="space-y-5">
      <div>
        <Label>{t("cms.background")}</Label>
        <div className="flex flex-wrap gap-2">
          {(["none", "surface", "dark", "accent", "custom"] as const).map((b) => (
            <button
              key={b}
              type="button"
              onClick={() => set("background", b)}
              className={cn("rounded-lg border px-3 py-1.5 text-[13px] transition", value.background === b ? "border-ad-accent bg-ad-accent/10 font-medium" : "border-ad-border hover:border-ad-fg/30")}
            >
              {t(`cms.bg.${b}`)}
            </button>
          ))}
        </div>
        {value.background === "custom" && (
          <div className="mt-2">
            <ColorInput value={value.customBackground} onChange={(v) => set("customBackground", v)} />
          </div>
        )}
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label>{t("cms.padding")}</Label>
          <Segmented
            size="sm"
            value={value.paddingY}
            onChange={(v) => set("paddingY", v)}
            options={(["none", "sm", "md", "lg"] as const).map((p) => ({ value: p, label: p === "none" ? "0" : p.toUpperCase() }))}
          />
        </div>
        <div>
          <Label>{t("cms.width")}</Label>
          <Segmented
            size="sm"
            value={value.width}
            onChange={(v) => set("width", v)}
            options={[
              { value: "contained", label: t("cms.width.contained") },
              { value: "full", label: t("cms.width.full") },
            ]}
          />
        </div>
        <div>
          <Label>{t("cms.align")}</Label>
          <Segmented
            size="sm"
            value={value.align}
            onChange={(v) => set("align", v)}
            options={[
              { value: "start", label: t("cms.align.start") },
              { value: "center", label: t("cms.align.center") },
            ]}
          />
        </div>
        <div>
          <Label optional>{t("cms.anchor")}</Label>
          <TextInput value={value.anchor} onChange={(e) => set("anchor", e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))} dir="ltr" placeholder="offers" maxLength={40} />
        </div>
      </div>
      <Switch checked={value.hideOnMobile} onCheckedChange={(v) => set("hideOnMobile", v)} label={t("cms.hideMobile")} />
      <Switch checked={value.hideOnDesktop} onCheckedChange={(v) => set("hideOnDesktop", v)} label={t("cms.hideDesktop")} />
      <Switch checked={value.animate} onCheckedChange={(v) => set("animate", v)} label={t("cms.animate")} />
    </div>
  );
}

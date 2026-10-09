"use client";

import { useMemo, useState, useTransition } from "react";
import { AlertTriangle, ArrowLeftRight, CheckCircle2, Database, HardDrive, Loader2, Lock, Pencil, Plus, RefreshCcw, Search, ShieldCheck, Sparkles, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/overlay";
import { useAdmin } from "../admin-context";
import { ConfirmDialog, PageHeader, Panel, Pill, Segmented } from "../ui";
import { Label, LocalizedField, Select, TextArea, TextInput } from "../fields";
import { AdminDrawer, DrawerBody, DrawerFooter, DrawerHeader } from "../drawer";
import { IconPicker, IconPreview } from "../icon-picker";
import { applyTemplateUpdateAction, customTypeAction, planSwitchStoreTypeAction, removeDemoProductsAction, saveCustomTypeAction, saveStoreTypeAction, setCardAttributesAction, switchStoreTypeAction } from "@/actions/admin/settings";
import { TRUST_CONCEPTS, type TrustConcept } from "@/config/store-types";
import { t as tr, type LocalizedText } from "@/lib/i18n-text";
import { cn } from "@/lib/utils";
import type { storeTypePage } from "@/server/admin/store-type";
import type { profilesOverview, storageReport, planSwitch, CustomDefinition } from "@/server/admin/store-profiles";

type Data = { overview: Awaited<ReturnType<typeof profilesOverview>>; presentation: Awaited<ReturnType<typeof storeTypePage>>; storage: Awaited<ReturnType<typeof storageReport>> };
type TypeRow = Data["overview"]["types"][number];
type Plan = Awaited<ReturnType<typeof planSwitch>>;

const kb = (n: number) => (n > 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);

/**
 * Store type (super-admin only). Every type keeps its own catalog, homepage
 * and presentation; switching only changes which one is active, so going back
 * restores everything exactly as it was.
 */
export function StoreTypeView({ data }: { data: Data }) {
  const { t, locale } = useAdmin();
  const ar = locale === "ar";
  const router = useRouter();
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<"all" | "used" | "new">("all");
  const [plan, setPlan] = useState<Plan | null>(null);
  const [planning, setPlanning] = useState<string | null>(null);
  const [switching, startSwitch] = useTransition();
  const [busy, startBusy] = useTransition();
  const [confirmDemo, setConfirmDemo] = useState(false);
  const [editing, setEditing] = useState<{ key: string | null; name: LocalizedText; description: LocalizedText; icon: string; definition: CustomDefinition } | null>(null);

  const active = data.overview.types.find((x) => x.key === data.overview.active);
  const types = useMemo(() => {
    const n = q.trim().toLowerCase();
    return data.overview.types.filter((x) => (filter === "all" || (filter === "used" ? x.initializedAt : !x.initializedAt)) && (!n || `${x.name} ${x.description} ${x.key}`.toLowerCase().includes(n)));
  }, [data.overview.types, q, filter]);

  const openSwitch = async (key: string) => {
    setPlanning(key);
    const r = await planSwitchStoreTypeAction(key, locale);
    setPlanning(null);
    if (r.ok) setPlan(r.data);
    else toast.error(t("c.error"));
  };
  const doSwitch = () =>
    plan &&
    startSwitch(async () => {
      const r = await switchStoreTypeAction(plan.to.key);
      if (!r.ok) return void toast.error(t("c.error"));
      toast.success(ar ? `أصبح المتجر الآن: ${plan.to.name}` : `The store is now: ${plan.to.name}`);
      setPlan(null);
      router.refresh();
    });

  const runBusy = (fn: () => Promise<{ ok: boolean; data?: unknown }>, done: (d: never) => string) =>
    startBusy(async () => {
      const r = await fn();
      if (!r.ok) return void toast.error(t("c.error"));
      toast.success(done(r.data as never));
      router.refresh();
    });

  const openCustom = async (key: string | null) => {
    if (!key) return setEditing({ key: null, name: {}, description: {}, icon: "Store", definition: { attributes: [], categories: [{ name: { en: "", ar: "" } }], cardAttributes: [], icons: {}, homeSections: [], terms: undefined, card: undefined, theme: undefined } });
    const r = await customTypeAction(key);
    if (r.ok) setEditing({ key, name: r.data.name, description: r.data.description, icon: r.data.icon, definition: r.data.definition });
    else toast.error(t("c.error"));
  };

  return (
    <>
      <PageHeader
        back={{ href: "/admin/settings", label: t("s.title") }}
        title={t("s.storeType")}
        description={ar ? "لكل نوع متجر بياناته الخاصة. التبديل لا يحذف شيئاً: العودة لنوع سابق تعيد منتجاته وتصنيفاته وصفحته الرئيسية كما تركتها." : "Each store type keeps its own data. Switching deletes nothing — returning to a type brings back its products, categories and homepage exactly as you left them."}
        actions={
          <Pill tone="violet" className="gap-1">
            <Lock className="size-3" /> {ar ? "مدير النظام فقط" : "Super admin only"}
          </Pill>
        }
      />

      {active && (
        <Panel className="mb-4" padded={false}>
          <div className="flex flex-wrap items-center gap-4 p-4">
            <TypeTile row={active} size="lg" />
            <div className="min-w-0 flex-1">
              <p className="text-xs text-ad-muted">{ar ? "النوع النشط" : "Active store type"}</p>
              <p className="text-lg font-semibold">{active.name}</p>
              <p className="mt-0.5 text-sm text-ad-muted">
                {ar ? `${active.data.products} منتج (${active.data.merchantProducts} منك، ${active.data.demoProducts} تجريبي) · ${active.data.categories} تصنيف · ${active.data.brands} علامة` : `${active.data.products} products (${active.data.merchantProducts} yours, ${active.data.demoProducts} demo) · ${active.data.categories} categories · ${active.data.brands} brands`}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {active.updateAvailable && (
                <Button size="sm" variant="outline" leftIcon={<RefreshCcw />} loading={busy} onClick={() => runBusy(() => applyTemplateUpdateAction(active.key), (d: { created: number }) => (ar ? `أُضيف ${d.created} عنصر جديد من القالب` : `Added ${d.created} new template items`))}>
                  {ar ? `تحديث القالب (v${active.template.version})` : `Template update (v${active.template.version})`}
                </Button>
              )}
              {active.data.demoProducts > 0 && (
                <Button size="sm" variant="outline" className="text-red-600" leftIcon={<Trash2 />} onClick={() => setConfirmDemo(true)}>
                  {ar ? "حذف المنتجات التجريبية" : "Remove demo products"}
                </Button>
              )}
              {active.custom && (
                <Button size="sm" variant="outline" leftIcon={<Pencil />} onClick={() => openCustom(active.key)}>
                  {ar ? "تعديل النوع" : "Edit type"}
                </Button>
              )}
            </div>
          </div>
        </Panel>
      )}

      <Panel
        title={ar ? "أنواع المتاجر" : "Store types"}
        actions={
          <Button size="sm" variant="outline" leftIcon={<Plus />} onClick={() => openCustom(null)}>
            {ar ? "نوع مخصص" : "Custom type"}
          </Button>
        }
      >
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <div className="relative min-w-[12rem] flex-1">
            <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-ad-muted" />
            <TextInput value={q} onChange={(e) => setQ(e.target.value)} placeholder={ar ? "ابحث عن نوع…" : "Search types…"} className="ps-9" />
          </div>
          <Segmented
            size="sm"
            value={filter}
            onChange={setFilter}
            options={[
              { value: "all", label: t("c.all") },
              { value: "used", label: ar ? "مستخدمة" : "In use" },
              { value: "new", label: ar ? "لم تُستخدم" : "Not used yet" },
            ]}
          />
        </div>
        <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {types.map((x) => {
            const isActive = x.key === data.overview.active;
            return (
              <li key={x.key} className={cn("flex flex-col rounded-xl border p-3.5 transition", isActive ? "border-ad-accent bg-ad-accent/5 ring-2 ring-ad-accent/20" : "border-ad-border hover:border-ad-fg/20")}>
                <div className="flex items-start gap-3">
                  <TypeTile row={x} />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold leading-tight">{x.name}</p>
                    <p className="mt-1 line-clamp-2 text-xs text-ad-muted">{x.description}</p>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-1">
                  {isActive && (
                    <Pill tone="green" className="gap-1">
                      <CheckCircle2 className="size-3" /> {ar ? "نشط" : "Active"}
                    </Pill>
                  )}
                  {x.initializedAt ? <Pill tone="blue">{ar ? `${x.data.products} منتج محفوظ` : `${x.data.products} products kept`}</Pill> : <Pill>{ar ? "لم يُستخدم بعد" : "Not used yet"}</Pill>}
                  {x.data.merchantProducts > 0 && <Pill tone="amber">{ar ? `${x.data.merchantProducts} من بياناتك` : `${x.data.merchantProducts} yours`}</Pill>}
                  {x.updateAvailable && <Pill tone="violet">{ar ? "تحديث متاح" : "Update available"}</Pill>}
                  {x.custom && <Pill tone="violet">{ar ? "مخصص" : "Custom"}</Pill>}
                </div>
                <p className="mt-2 text-[11.5px] text-ad-muted">
                  {ar
                    ? `القالب: ${x.template.categories} تصنيف · ${x.template.brands} علامات · ${x.template.products} منتجات · ${x.template.attributes} خاصية`
                    : `Template: ${x.template.categories} categories · ${x.template.brands} brands · ${x.template.products} products · ${x.template.attributes} attributes`}
                </p>
                {x.cardAttributes.length > 0 && <p className="mt-0.5 truncate text-[11.5px] text-ad-muted">{(ar ? "على البطاقة: " : "On cards: ") + x.cardAttributes.join(" · ")}</p>}
                <div className="mt-auto flex gap-2 pt-3">
                  {!isActive && (
                    <Button size="sm" className="flex-1" leftIcon={planning === x.key ? <Loader2 className="animate-spin" /> : <ArrowLeftRight />} disabled={Boolean(planning)} onClick={() => openSwitch(x.key)}>
                      {x.initializedAt ? (ar ? "التبديل" : "Switch") : ar ? "تفعيل" : "Activate"}
                    </Button>
                  )}
                  {x.custom && (
                    <Button size="icon-sm" variant="ghost" aria-label={t("c.edit")} onClick={() => openCustom(x.key)}>
                      <Pencil />
                    </Button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      </Panel>

      <Presentation data={data.presentation} />

      <Panel className="mt-4" title={ar ? "التخزين" : "Storage"} description={ar ? "الصور التجريبية مشتركة بين الأنواع وتُنشأ مرة واحدة فقط." : "Demo images are shared between types and generated only once."}>
        <div className="grid gap-3 sm:grid-cols-3">
          <Stat icon={<HardDrive className="size-4" />} label={ar ? "كل الوسائط" : "All media"} value={`${data.storage.media.files} · ${kb(data.storage.media.bytes)}`} />
          <Stat icon={<Sparkles className="size-4" />} label={ar ? "صور تجريبية مشتركة" : "Shared demo images"} value={`${data.storage.demoMedia.files} · ${kb(data.storage.demoMedia.bytes)}`} />
          <Stat icon={<Database className="size-4" />} label={ar ? "قاعدة البيانات (أكبر الجداول)" : "Database (largest tables)"} value={kb(data.storage.tables.reduce((n, r) => n + r.bytes, 0))} />
        </div>
      </Panel>

      <Modal
        open={Boolean(plan)}
        onOpenChange={(o) => !o && !switching && setPlan(null)}
        title={plan ? (ar ? `التبديل من ${plan.from.name} إلى ${plan.to.name}؟` : `Switch from ${plan.from.name} to ${plan.to.name}?`) : ""}
      >
        {plan && (
          <div className="space-y-4 text-sm">
            <ul className="space-y-2.5">
              <Bullet icon={<ArrowLeftRight className="size-4 text-ad-accent" />}>{ar ? "ستتغير واجهة المتجر: التصنيفات والمنتجات والصفحة الرئيسية وبطاقات المنتجات والفلاتر والأيقونات." : "The storefront changes: categories, products, homepage, product cards, filters and icons."}</Bullet>
              <Bullet icon={<ShieldCheck className="size-4 text-emerald-600" />}>
                {ar ? `بيانات ${plan.from.name} محفوظة بالكامل (${plan.from.products} منتج، ${plan.from.categories} تصنيف) وتعود كما هي عند الرجوع.` : `${plan.from.name} data is kept in full (${plan.from.products} products, ${plan.from.categories} categories) and comes back unchanged when you return.`}
              </Bullet>
              <Bullet icon={<Sparkles className="size-4 text-violet-600" />}>
                {plan.to.initialized
                  ? ar
                    ? `ستُستعاد بيانات ${plan.to.name} المحفوظة (${plan.to.products} منتج).`
                    : `${plan.to.name} data will be restored (${plan.to.products} products).`
                  : ar
                    ? `أول تفعيل: يُنشأ قالب ${plan.to.name} مع ${plan.to.demoProducts} منتجات تجريبية مميزة كـ«تجريبي» يمكنك حذفها لاحقاً.`
                    : `First activation: the ${plan.to.name} template is created with ${plan.to.demoProducts} demo products, marked as demo so you can remove them later.`}
              </Bullet>
              <Bullet icon={<Lock className="size-4 text-ad-muted" />}>{ar ? "الإعدادات المشتركة لا تتغير: العملاء والطلبات والمدفوعات والهوية ووسائل التواصل." : "Shared settings stay as they are: customers, orders, payments, branding and contact details."}</Bullet>
            </ul>
            {!plan.to.initialized && (
              <p className="flex gap-2 rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-[13px]">
                <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-600" />
                {ar ? "قد يستغرق التفعيل الأول حتى دقيقة لتجهيز الصور. إذا انقطع، يبقى النوع الحالي نشطاً ويمكنك المحاولة مجدداً." : "The first activation can take up to a minute to prepare images. If it's interrupted, the current type stays active and you can retry."}
              </p>
            )}
            <div className="flex gap-2">
              <Button className="flex-1" loading={switching} onClick={doSwitch} leftIcon={<ArrowLeftRight />}>
                {ar ? `التبديل إلى ${plan.to.name}` : `Switch to ${plan.to.name}`}
              </Button>
              <Button variant="ghost" disabled={switching} onClick={() => setPlan(null)}>
                {t("c.cancel")}
              </Button>
            </div>
          </div>
        )}
      </Modal>

      <ConfirmDialog
        open={confirmDemo}
        onOpenChange={setConfirmDemo}
        title={ar ? "حذف المنتجات التجريبية؟" : "Remove demo products?"}
        text={ar ? "تُحذف المنتجات المميزة كتجريبية فقط ولم تُطلب قط. منتجاتك وأي منتج تجريبي ظهر في طلب تبقى." : "Only products marked as demo that were never ordered are removed. Your products, and any demo product that appears in an order, stay."}
        confirmLabel={t("c.delete")}
        onConfirm={() => active && runBusy(() => removeDemoProductsAction(active.key), (d: { removed: number }) => (ar ? `حُذف ${d.removed} منتج تجريبي` : `Removed ${d.removed} demo products`))}
      />

      {editing && <CustomTypeDrawer value={editing} attributes={data.presentation.attributes} onClose={() => setEditing(null)} onSaved={() => (setEditing(null), router.refresh())} />}
    </>
  );
}

function TypeTile({ row, size = "md" }: { row: TypeRow; size?: "md" | "lg" }) {
  const th = row.theme;
  return (
    <span className={cn("grid shrink-0 place-items-center rounded-xl text-white shadow-sm", size === "lg" ? "size-14" : "size-10")} style={{ background: th ? `linear-gradient(135deg, ${th.from}, ${th.to})` : "var(--ad-fg)" }}>
      <IconPreview value={row.icon} className={size === "lg" ? "size-6" : "size-[18px]"} />
    </span>
  );
}

function Bullet({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <li className="flex gap-2.5">
      <span className="mt-0.5 shrink-0">{icon}</span>
      <span>{children}</span>
    </li>
  );
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-xl border border-ad-border p-3">
      <p className="flex items-center gap-1.5 text-xs text-ad-muted">
        {icon}
        {label}
      </p>
      <p className="mt-1 font-semibold tabular-nums">{value}</p>
    </div>
  );
}

/** Trust icons and card specs of the active type (saved with its profile on switch). */
function Presentation({ data }: { data: Data["presentation"] }) {
  const { t, locale } = useAdmin();
  const ar = locale === "ar";
  const router = useRouter();
  const [icons, setIcons] = useState(data.settings.icons);
  const [cards, setCards] = useState(() => new Set(data.attributes.filter((a) => a.showOnCard).map((a) => a.id)));
  const [pending, start] = useTransition();
  const save = (fn: () => Promise<{ ok: boolean }>) =>
    start(async () => {
      const r = await fn();
      if (r.ok) {
        toast.success(t("c.saved"));
        router.refresh();
      } else toast.error(t("c.error"));
    });
  return (
    <div className="mt-4 grid gap-4 xl:grid-cols-2">
      <Panel title={ar ? "أيقونات الثقة للنوع النشط" : "Trust icons (active type)"} description={ar ? "تظهر في صفحة المنتج والسلة. اتركها فارغة لأيقونات النوع." : "Shown on product pages and in the cart. Leave empty for the type's icons."}>
        <ul className="space-y-3">
          {TRUST_CONCEPTS.map((c) => {
            const fallback = data.defaultIcons?.[c.key];
            return (
              <li key={c.key} className="flex flex-wrap items-center gap-3">
                <span className="w-36 shrink-0 text-sm">{tr(c.name, locale)}</span>
                <IconPicker value={icons[c.key as TrustConcept] ?? null} onChange={(v) => setIcons({ ...icons, [c.key]: v })} />
                {!icons[c.key as TrustConcept] && fallback && (
                  <span className="flex items-center gap-1.5 text-xs text-ad-muted">
                    <IconPreview value={fallback} className="size-4" /> {ar ? "افتراضي" : "Default"}
                  </span>
                )}
              </li>
            );
          })}
        </ul>
        <Button className="mt-4" size="sm" loading={pending} onClick={() => save(() => saveStoreTypeAction({ icons }))}>
          {t("c.save")}
        </Button>
      </Panel>
      <Panel title={ar ? "مواصفات بطاقة المنتج" : "Product card specs"} description={ar ? "خصائص تظهر تحت اسم المنتج (أول 3)." : "Attributes shown under the product name (first 3)."}>
        <ul className="max-h-80 space-y-1 overflow-y-auto pe-1">
          {data.attributes
            .filter((a) => a.type !== "COLOR")
            .map((a) => (
              <li key={a.id}>
                <label className={cn("flex cursor-pointer items-center gap-3 rounded-lg px-2.5 py-2 text-sm transition hover:bg-ad-hover", cards.has(a.id) && "bg-ad-accent/5")}>
                  <input type="checkbox" checked={cards.has(a.id)} onChange={() => setCards((s) => (s.has(a.id) ? (s.delete(a.id), new Set(s)) : new Set(s.add(a.id))))} className="size-4 accent-[var(--ad-accent)]" />
                  <span className="min-w-0 flex-1 truncate">{a.name}</span>
                  <span className="font-mono text-[11px] text-ad-muted">{a.key}</span>
                </label>
              </li>
            ))}
        </ul>
        <Button className="mt-4" size="sm" loading={pending} onClick={() => save(() => setCardAttributesAction([...cards]))}>
          {t("c.save")}
        </Button>
      </Panel>
    </div>
  );
}

const SECTION_TYPES = ["hero_slider", "category_grid", "product_carousel", "promo_banners", "brand_strip", "features", "testimonials", "newsletter"];

/** Custom store type: same building blocks as the built-in types. */
function CustomTypeDrawer({ value, attributes, onClose, onSaved }: { value: { key: string | null; name: LocalizedText; description: LocalizedText; icon: string; definition: CustomDefinition }; attributes: Data["presentation"]["attributes"]; onClose: () => void; onSaved: () => void }) {
  const { t, locale } = useAdmin();
  const ar = locale === "ar";
  const [form, setForm] = useState(value);
  const [pending, start] = useTransition();
  const def = form.definition;
  const setDef = (patch: Partial<CustomDefinition>) => setForm((f) => ({ ...f, definition: { ...f.definition, ...patch } }));
  const save = () =>
    start(async () => {
      const r = await saveCustomTypeAction(form.key, { name: form.name, description: form.description, icon: form.icon, definition: { ...def, categories: def.categories.filter((c) => c.name.en || c.name.ar) } });
      if (r.ok) {
        toast.success(t("c.saved"));
        onSaved();
      } else toast.error(t("c.fixErrors"));
    });
  const libraryOptions = attributes.filter((a) => !def.attributes.some((x) => x.key === a.key));
  return (
    <AdminDrawer open onOpenChange={(o) => !o && onClose()} size="md" label={ar ? "نوع مخصص" : "Custom type"}>
      <DrawerHeader title={form.key ? (ar ? "تعديل النوع المخصص" : "Edit custom type") : ar ? "نوع متجر مخصص" : "New custom store type"} subtitle={ar ? "يعمل بنفس بنية الأنواع الجاهزة" : "Uses the same structure as the built-in types"} />
      <DrawerBody className="space-y-5">
        <div className="grid gap-4 @xl:grid-cols-[1fr_auto]">
          <LocalizedField label={t("c.name")} value={form.name} onChange={(v) => setForm((f) => ({ ...f, name: v }))} required />
          <div>
            <Label>{ar ? "الأيقونة" : "Icon"}</Label>
            <IconPicker value={form.icon ? `lucide:${form.icon}` : null} onChange={(v) => setForm((f) => ({ ...f, icon: (v ?? "lucide:Store").replace(/^lucide:/, "") }))} />
          </div>
        </div>
        <LocalizedField label={t("c.description")} value={form.description} onChange={(v) => setForm((f) => ({ ...f, description: v }))} multiline rows={2} />

        <section>
          <h3 className="mb-2 text-sm font-semibold">{ar ? "التصنيفات الافتراضية" : "Default categories"}</h3>
          <ul className="space-y-2">
            {def.categories.map((c, i) => (
              <li key={i} className="flex items-start gap-2">
                <div className="flex-1">
                  <LocalizedField label={`#${i + 1}`} value={c.name} onChange={(v) => setDef({ categories: def.categories.map((x, j) => (j === i ? { ...x, name: { en: v.en ?? "", ar: v.ar ?? "" } } : x)) })} />
                </div>
                <div className="pt-6">
                  <IconPicker value={c.icon ?? null} onChange={(v) => setDef({ categories: def.categories.map((x, j) => (j === i ? { ...x, icon: v ?? undefined } : x)) })} />
                </div>
                <Button size="icon-sm" variant="ghost" className="mt-6 text-red-600" aria-label={t("c.delete")} onClick={() => setDef({ categories: def.categories.filter((_, j) => j !== i) })}>
                  <Trash2 />
                </Button>
              </li>
            ))}
          </ul>
          <Button size="sm" variant="outline" className="mt-2" leftIcon={<Plus />} onClick={() => setDef({ categories: [...def.categories, { name: { en: "", ar: "" } }] })}>
            {ar ? "إضافة تصنيف" : "Add category"}
          </Button>
        </section>

        <section>
          <h3 className="mb-2 text-sm font-semibold">{ar ? "خصائص المنتجات" : "Product attributes"}</h3>
          <p className="mb-2 text-xs text-ad-muted">{ar ? "اختر من مكتبة الخصائص الموجودة أو أضف خاصية جديدة (قيمة لكل سطر: English | عربي)." : "Pick from the existing attribute library or add a new one (one value per line: English | عربي)."}</p>
          <ul className="space-y-2">
            {def.attributes.map((a, i) => (
              <li key={a.key} className="rounded-lg border border-ad-border p-2.5">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-xs text-ad-muted">{a.key}</span>
                  <span className="text-sm font-medium">{tr(a.name, locale)}</span>
                  <Pill>{a.type}</Pill>
                  <label className="ms-auto flex items-center gap-1.5 text-xs">
                    <input type="checkbox" className="accent-[var(--ad-accent)]" checked={def.cardAttributes.includes(a.key)} onChange={(e) => setDef({ cardAttributes: e.target.checked ? [...def.cardAttributes, a.key].slice(0, 4) : def.cardAttributes.filter((k) => k !== a.key) })} />
                    {ar ? "على البطاقة" : "On card"}
                  </label>
                  <Button size="icon-sm" variant="ghost" className="text-red-600" aria-label={t("c.delete")} onClick={() => setDef({ attributes: def.attributes.filter((_, j) => j !== i), cardAttributes: def.cardAttributes.filter((k) => k !== a.key) })}>
                    <Trash2 />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
          <NewAttribute library={libraryOptions} onAdd={(a) => setDef({ attributes: [...def.attributes, a] })} />
        </section>

        <section className="grid gap-4 @xl:grid-cols-2">
          <LocalizedField label={ar ? "كلمة «منتج» لهذا النوع" : "Word for “product”"} value={def.terms?.product} onChange={(v) => setDef({ terms: { ...def.terms, product: { en: v.en ?? "", ar: v.ar ?? "" } } })} />
          <LocalizedField label={ar ? "كلمة «منتجات»" : "Word for “products”"} value={def.terms?.products} onChange={(v) => setDef({ terms: { ...def.terms, products: { en: v.en ?? "", ar: v.ar ?? "" } } })} />
          <div>
            <Label>{ar ? "نسبة صورة البطاقة" : "Card image ratio"}</Label>
            <Segmented size="sm" value={def.card?.imageRatio ?? "1/1"} onChange={(v) => setDef({ card: { ...def.card, imageRatio: v } })} options={["1/1", "4/5", "3/4"].map((v) => ({ value: v as "1/1", label: v }))} />
          </div>
        </section>

        <section>
          <h3 className="mb-2 text-sm font-semibold">{ar ? "أقسام الصفحة الرئيسية" : "Homepage sections"}</h3>
          <div className="flex flex-wrap gap-2">
            {SECTION_TYPES.map((s) => (
              <label key={s} className={cn("flex cursor-pointer items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs", def.homeSections.includes(s) ? "border-ad-accent bg-ad-accent/5" : "border-ad-border")}>
                <input type="checkbox" className="accent-[var(--ad-accent)]" checked={def.homeSections.includes(s)} onChange={(e) => setDef({ homeSections: e.target.checked ? SECTION_TYPES.filter((x) => x === s || def.homeSections.includes(x)) : def.homeSections.filter((x) => x !== s) })} />
                {s.replace(/_/g, " ")}
              </label>
            ))}
          </div>
        </section>

        <section>
          <h3 className="mb-2 text-sm font-semibold">{ar ? "أيقونات الثقة" : "Trust icons"}</h3>
          <ul className="grid gap-2 @xl:grid-cols-2">
            {TRUST_CONCEPTS.map((c) => (
              <li key={c.key} className="flex items-center gap-2">
                <span className="w-28 text-sm">{tr(c.name, locale)}</span>
                <IconPicker value={def.icons[c.key] ?? null} onChange={(v) => setDef({ icons: { ...def.icons, [c.key]: v ?? undefined } })} />
              </li>
            ))}
          </ul>
        </section>
      </DrawerBody>
      <DrawerFooter>
        <Button onClick={save} loading={pending}>
          {t("c.save")}
        </Button>
        <Button variant="ghost" onClick={onClose}>
          {t("c.cancel")}
        </Button>
      </DrawerFooter>
    </AdminDrawer>
  );
}

function NewAttribute({ library, onAdd }: { library: Data["presentation"]["attributes"]; onAdd: (a: CustomDefinition["attributes"][number]) => void }) {
  const { locale } = useAdmin();
  const ar = locale === "ar";
  const [name, setName] = useState<LocalizedText>({});
  const [type, setType] = useState<"SELECT" | "MULTISELECT" | "TEXT" | "NUMBER" | "BOOLEAN" | "COLOR">("SELECT");
  const [values, setValues] = useState("");
  const add = () => {
    const key = (name.en ?? "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40);
    if (!key || !/^[a-z]/.test(key)) return void toast.error(ar ? "أدخل اسماً إنجليزياً للخاصية" : "Enter an English attribute name");
    const vals = values
      .split("\n")
      .map((l) => l.split("|").map((s) => s.trim()))
      .filter(([en]) => en)
      .map(([en, arv]) => ({ en, ar: arv || en }));
    onAdd({ key, name: { en: name.en ?? "", ar: name.ar || name.en || "" }, type, values: vals.length ? vals : undefined, filterable: type !== "TEXT" && type !== "NUMBER" });
    setName({});
    setValues("");
  };
  return (
    <div className="mt-3 space-y-2 rounded-lg border border-dashed border-ad-border p-3">
      {library.length > 0 && (
        <Select
          value=""
          onChange={(e) => {
            const a = library.find((x) => x.key === e.target.value);
            if (a) onAdd({ key: a.key, name: { en: a.name, ar: a.name }, type: a.type as "SELECT", filterable: a.isFilterable });
          }}
          aria-label={ar ? "من المكتبة" : "From library"}
        >
          <option value="">{ar ? "إضافة من مكتبة الخصائص…" : "Add from the attribute library…"}</option>
          {library.map((a) => (
            <option key={a.id} value={a.key}>
              {a.name} ({a.key})
            </option>
          ))}
        </Select>
      )}
      <div className="grid gap-2 @xl:grid-cols-[1fr_10rem]">
        <LocalizedField label={ar ? "خاصية جديدة" : "New attribute"} value={name} onChange={setName} />
        <div>
          <Label>{ar ? "النوع" : "Type"}</Label>
          <Select value={type} onChange={(e) => setType(e.target.value as typeof type)}>
            {["SELECT", "MULTISELECT", "TEXT", "NUMBER", "BOOLEAN", "COLOR"].map((x) => (
              <option key={x} value={x}>
                {x}
              </option>
            ))}
          </Select>
        </div>
      </div>
      {(type === "SELECT" || type === "MULTISELECT" || type === "COLOR") && <TextArea rows={3} dir="ltr" value={values} onChange={(e) => setValues(e.target.value)} placeholder={"Small | صغير\nLarge | كبير"} />}
      <Button size="sm" variant="outline" leftIcon={<Plus />} onClick={add}>
        {ar ? "إضافة الخاصية" : "Add attribute"}
      </Button>
    </div>
  );
}

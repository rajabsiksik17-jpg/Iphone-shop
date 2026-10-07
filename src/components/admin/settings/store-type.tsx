"use client";

import { useState, useTransition } from "react";
import { AlertTriangle, Check, LayoutGrid, Loader2, Shapes, Sparkles, Wand2 } from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/overlay";
import { useAdmin } from "../admin-context";
import { PageHeader, Panel, Pill, Switch } from "../ui";
import { LocalizedField } from "../fields";
import { IconPicker, IconPreview } from "../icon-picker";
import { applyStoreTypeAction, planStoreTypeAction, saveStoreTypeAction, setCardAttributesAction } from "@/actions/admin/settings";
import { TRUST_CONCEPTS, CUSTOM_STORE_TYPE, type TrustConcept } from "@/config/store-types";
import { t as tr } from "@/lib/i18n-text";
import { cn } from "@/lib/utils";
import type { storeTypePage, PresetPlan } from "@/server/admin/store-type";

type Data = Awaited<ReturnType<typeof storeTypePage>>;
type Options = { attributes: boolean; categories: boolean; cardAttributes: boolean; homeSections: boolean; icons: boolean };

/**
 * Store type: pick what kind of store this is, apply its preset (attributes,
 * categories, card specs, homepage sections, icons) without touching existing
 * data, map trust-badge icons and choose which specs appear on product cards.
 */
export function StoreTypeView({ data }: { data: Data }) {
  const { t, locale } = useAdmin();
  const router = useRouter();
  const ar = locale === "ar";
  const [selected, setSelected] = useState(data.settings.type);
  const [customName, setCustomName] = useState(data.settings.customName);
  const [icons, setIcons] = useState(data.settings.icons);
  const [cards, setCards] = useState(() => new Set(data.attributes.filter((a) => a.showOnCard).map((a) => a.id)));
  const [plan, setPlan] = useState<PresetPlan | null>(null);
  const [planning, setPlanning] = useState(false);
  const [opts, setOpts] = useState<Options>({ attributes: true, categories: true, cardAttributes: true, homeSections: false, icons: true });
  const [pending, start] = useTransition();
  const preset = data.presets.find((p) => p.key === selected);
  const isCustom = selected === CUSTOM_STORE_TYPE;
  const current = data.settings.type;

  const saveType = () =>
    start(async () => {
      const r = await saveStoreTypeAction({ type: selected, customName, icons });
      if (r.ok) {
        toast.success(t("c.saved"));
        router.refresh();
      } else toast.error(t("c.error"));
    });

  const openPlan = async () => {
    if (!preset) return;
    setPlanning(true);
    const r = await planStoreTypeAction(preset.key, locale);
    setPlanning(false);
    if (r.ok) setPlan(r.data);
    else toast.error(t("c.error"));
  };

  const apply = () =>
    plan &&
    start(async () => {
      const r = await applyStoreTypeAction(plan.key, opts);
      if (!r.ok) return void toast.error(t("c.error"));
      const d = r.data;
      toast.success(
        ar
          ? `تم التطبيق: ${d.attributesCreated} خاصية، ${d.valuesAdded} قيمة، ${d.categoriesCreated} تصنيف، ${d.homeSections} قسم`
          : `Applied: ${d.attributesCreated} attributes, ${d.valuesAdded} values, ${d.categoriesCreated} categories, ${d.homeSections} sections`,
      );
      setPlan(null);
      router.refresh();
    });

  const saveCards = () =>
    start(async () => {
      const r = await setCardAttributesAction([...cards]);
      if (r.ok) {
        toast.success(t("c.saved"));
        router.refresh();
      } else toast.error(t("c.error"));
    });

  const typeName = (key: string) => (key === CUSTOM_STORE_TYPE ? tr(data.settings.customName, locale) || (ar ? "مخصص" : "Custom") : tr(data.presets.find((p) => p.key === key)?.name, locale));
  const nothingToAdd = plan && !plan.newAttributes.length && !plan.extendedAttributes.length && !plan.newCategories.length && !plan.newHomeSections.length;

  return (
    <>
      <PageHeader
        back={{ href: "/admin/settings", label: t("s.title") }}
        title={t("s.storeType")}
        description={ar ? `النوع الحالي: ${typeName(current)} — يحدد الخصائص المقترحة والفلاتر ومواصفات بطاقات المنتجات والأيقونات.` : `Current type: ${typeName(current)} — drives suggested attributes, filters, product-card specs and icons.`}
      />

      <Panel title={ar ? "اختر نوع متجرك" : "Choose your store type"}>
        <ul className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-6">
          {[...data.presets, { key: CUSTOM_STORE_TYPE, name: { en: "Custom", ar: "مخصص" }, description: { en: "Set your own name, icons and attributes.", ar: "حدد الاسم والأيقونات والخصائص بنفسك." }, icon: "Shapes" }].map((p) => (
            <li key={p.key}>
              <button
                type="button"
                onClick={() => setSelected(p.key)}
                aria-pressed={selected === p.key}
                className={cn("relative flex h-full w-full flex-col items-start gap-2 rounded-xl border p-3 text-start transition", selected === p.key ? "border-ad-accent bg-ad-accent/5 ring-2 ring-ad-accent/20" : "border-ad-border hover:border-ad-fg/25 hover:bg-ad-hover")}
              >
                <span className={cn("grid size-9 place-items-center rounded-lg", selected === p.key ? "bg-ad-accent text-ad-accent-fg" : "bg-ad-sunken text-ad-fg/70")}>
                  <IconPreview value={p.icon} className="size-[18px]" />
                </span>
                <span className="text-[13px] font-semibold leading-tight">{tr(p.name, locale)}</span>
                <span className="line-clamp-2 text-[11.5px] leading-snug text-ad-muted">{tr(p.description, locale)}</span>
                {current === p.key && (
                  <span className="absolute end-2 top-2">
                    <Pill tone="green">
                      <Check className="size-3" /> {ar ? "الحالي" : "Current"}
                    </Pill>
                  </span>
                )}
              </button>
            </li>
          ))}
        </ul>

        <div className="mt-5 rounded-xl border border-ad-border bg-ad-sunken/50 p-4">
          {preset ? (
            <div className="flex flex-wrap items-center gap-4">
              <div className="min-w-0 flex-1">
                <p className="font-semibold">{tr(preset.name, locale)}</p>
                <p className="mt-0.5 text-sm text-ad-muted">
                  {ar ? `${preset.attributes} خاصية · ${preset.categories} تصنيف رئيسي · مواصفات البطاقة: ` : `${preset.attributes} attributes · ${preset.categories} top categories · card specs: `}
                  <span className="font-mono text-xs">{preset.cardAttributes.join(", ")}</span>
                </p>
              </div>
              {selected !== current && (
                <Button variant="outline" size="sm" loading={pending} onClick={saveType}>
                  {ar ? "اعتماد النوع فقط" : "Set as store type only"}
                </Button>
              )}
              <Button size="sm" leftIcon={planning ? <Loader2 className="animate-spin" /> : <Wand2 />} disabled={planning} onClick={openPlan}>
                {ar ? `تطبيق إعدادات ${tr(preset.name, locale)}` : `Apply ${tr(preset.name, locale)} preset`}
              </Button>
            </div>
          ) : isCustom ? (
            <div className="space-y-4">
              <LocalizedField label={ar ? "اسم نوع المتجر" : "Store type name"} value={customName} onChange={(v) => setCustomName({ en: v.en ?? "", ar: v.ar ?? "" })} />
              <p className="text-xs text-ad-muted">
                {ar ? "للأنواع المخصصة: أنشئ الخصائص من صفحة الخصائص، واختر أيقونات الثقة ومواصفات البطاقة أدناه." : "For a custom type: create attributes on the Attributes page, then map the trust icons and card specs below."}
              </p>
              <Button size="sm" loading={pending} onClick={saveType}>
                {t("c.save")}
              </Button>
            </div>
          ) : null}
        </div>
      </Panel>

      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        <Panel title={ar ? "أيقونات الثقة" : "Trust icons"} description={ar ? "تظهر في صفحة المنتج والسلة. اتركها فارغة لاستخدام أيقونات نوع المتجر." : "Shown on product pages and in the cart. Leave empty to use the store type's icons."}>
          <ul className="space-y-3">
            {TRUST_CONCEPTS.map((c) => {
              const fallback = data.presets.find((p) => p.key === current)?.icons[c.key];
              return (
                <li key={c.key} className="flex items-center gap-3">
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
          <Button className="mt-4" size="sm" loading={pending} onClick={saveType}>
            {t("c.save")}
          </Button>
        </Panel>

        <Panel title={ar ? "مواصفات بطاقة المنتج" : "Product card specs"} description={ar ? "خصائص تظهر كسطر مختصر تحت اسم المنتج (يُعرض أول 3). مثال: السعة والذاكرة للجوالات، المقاس والخامة للأزياء." : "Attributes shown as a short line under the product name (first 3 shown) — e.g. storage & RAM for phones, size & material for fashion."}>
          {data.attributes.length ? (
            <ul className="max-h-80 space-y-1 overflow-y-auto pe-1">
              {data.attributes
                .filter((a) => a.type !== "COLOR")
                .map((a) => (
                  <li key={a.id}>
                    <label className={cn("flex cursor-pointer items-center gap-3 rounded-lg px-2.5 py-2 text-sm transition hover:bg-ad-hover", cards.has(a.id) && "bg-ad-accent/5")}>
                      <input
                        type="checkbox"
                        checked={cards.has(a.id)}
                        onChange={() =>
                          setCards((s) => {
                            const n = new Set(s);
                            if (n.has(a.id)) n.delete(a.id);
                            else n.add(a.id);
                            return n;
                          })
                        }
                        className="size-4 accent-[var(--ad-accent)]"
                      />
                      <span className="min-w-0 flex-1 truncate">{a.name}</span>
                      <span className="font-mono text-[11px] text-ad-muted">{a.key}</span>
                      <span className="text-[11px] text-ad-muted">{t("cat.products", { n: a.products })}</span>
                    </label>
                  </li>
                ))}
            </ul>
          ) : (
            <p className="text-sm text-ad-muted">{ar ? "لا توجد خصائص بعد." : "No attributes yet."}</p>
          )}
          <div className="mt-4 flex items-center gap-3">
            <Button size="sm" loading={pending} onClick={saveCards}>
              {t("c.save")}
            </Button>
            {cards.size > 3 && (
              <span className="flex items-center gap-1.5 text-xs text-amber-600">
                <AlertTriangle className="size-3.5" /> {ar ? "تُعرض أول 3 فقط على البطاقة" : "Only the first 3 are shown on cards"}
              </span>
            )}
          </div>
        </Panel>
      </div>

      <Modal open={Boolean(plan)} onOpenChange={(o) => !o && setPlan(null)} title={ar ? `تطبيق إعدادات ${preset ? tr(preset.name, locale) : ""}` : `Apply ${preset ? tr(preset.name, locale) : ""} preset`} description={ar ? "يُضاف الناقص فقط — لن يُحذف أو يُعدّل أي شيء موجود." : "Only missing items are added — nothing existing is deleted or changed."}>
        {plan && (
          <div className="space-y-4 text-sm">
            <div className="flex gap-2.5 rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-[13px]">
              <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-600" />
              <p>{ar ? "راجع ما سيُضاف قبل المتابعة. يمكنك لاحقاً تعديل أو حذف أي عنصر من صفحته." : "Review what will be added. You can edit or remove anything afterwards from its own page."}</p>
            </div>
            <PlanRow
              checked={opts.attributes}
              onChange={(v) => setOpts({ ...opts, attributes: v })}
              icon={<Shapes className="size-4" />}
              title={ar ? "الخصائص" : "Attributes"}
              items={[...plan.newAttributes.map((n) => `+ ${n}`), ...plan.extendedAttributes.map((e) => `${e.name}: + ${e.values.join("، ")}`)]}
              empty={ar ? "كل الخصائص موجودة" : "All attributes already exist"}
            />
            <PlanRow
              checked={opts.categories}
              onChange={(v) => setOpts({ ...opts, categories: v })}
              icon={<LayoutGrid className="size-4" />}
              title={ar ? "التصنيفات" : "Categories"}
              items={plan.newCategories.map((c) => (c.children.length ? `+ ${c.name} (${c.children.join("، ")})` : `+ ${c.name}`))}
              empty={ar ? "كل التصنيفات موجودة" : "All categories already exist"}
            />
            <PlanRow checked={opts.cardAttributes} onChange={(v) => setOpts({ ...opts, cardAttributes: v })} icon={<Check className="size-4" />} title={ar ? "مواصفات البطاقة" : "Card specs"} items={plan.cardAttributes} empty="—" />
            <PlanRow
              checked={opts.homeSections}
              onChange={(v) => setOpts({ ...opts, homeSections: v })}
              icon={<Sparkles className="size-4" />}
              title={ar ? "أقسام الرئيسية المقترحة (تُضاف مخفية)" : "Suggested homepage sections (added hidden)"}
              items={plan.newHomeSections}
              empty={ar ? "كلها موجودة" : "All present"}
            />
            <Switch checked={opts.icons} onCheckedChange={(v) => setOpts({ ...opts, icons: v })} label={ar ? "أيقونات الثقة الافتراضية (لا تستبدل اختياراتك)" : "Default trust icons (keeps your choices)"} />
            {nothingToAdd && <p className="text-xs text-ad-muted">{ar ? "لا يوجد ما يُضاف — سيتم فقط اعتماد النوع والمواصفات." : "Nothing new to add — only the type and card specs will be set."}</p>}
            <Button block loading={pending} onClick={apply} leftIcon={<Wand2 />}>
              {ar ? "تطبيق" : "Apply"}
            </Button>
          </div>
        )}
      </Modal>
    </>
  );
}

function PlanRow({ checked, onChange, icon, title, items, empty }: { checked: boolean; onChange: (v: boolean) => void; icon: React.ReactNode; title: string; items: string[]; empty: string }) {
  return (
    <label className="flex cursor-pointer gap-3 rounded-lg border border-ad-border p-3">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="mt-0.5 size-4 shrink-0 accent-[var(--ad-accent)]" />
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5 font-medium">
          {icon} {title}
        </span>
        {items.length ? (
          <ul className="mt-1.5 space-y-0.5 text-xs text-ad-muted">
            {items.slice(0, 8).map((i) => (
              <li key={i} className="truncate">
                {i}
              </li>
            ))}
            {items.length > 8 && <li>+{items.length - 8}</li>}
          </ul>
        ) : (
          <span className="mt-1 block text-xs text-ad-muted">{empty}</span>
        )}
      </span>
    </label>
  );
}

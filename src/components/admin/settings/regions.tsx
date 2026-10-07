"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { Download, Globe2, MapPin, Pencil, Plus, Search, Trash2, Truck, X, Ban, CheckCircle2, Coins } from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Combobox } from "@/components/ui/combobox";
import { CountryFlag, useCountryOptions } from "@/components/store/geo-select";
import { useAdmin } from "../admin-context";
import { AdminEmpty, BulkBar, ConfirmDialog, PageHeader, Panel, Pill, Segmented, Switch } from "../ui";
import { Label, LocalizedField, MoneyInput, TextInput, FieldError } from "../fields";
import { AdminDrawer, DrawerBody, DrawerFooter, DrawerHeader } from "../drawer";
import { SortableList } from "../sortable";
import { bulkRegionsAction, countryRegionsAction, importRegionsAction, reorderRegionsAction, saveCountriesAction, saveRegionAction, saveRegionRatesAction, setMethodLimitAction } from "@/actions/admin/settings";
import type { LocalizedText } from "@/lib/i18n-text";
import { normalizeText } from "@/lib/search-text";
import { cn } from "@/lib/utils";
import type { countryRegions, regionsOverview } from "@/server/admin/regions";

type Overview = Awaited<ReturnType<typeof regionsOverview>>;
type CountryData = Awaited<ReturnType<typeof countryRegions>>;
type Region = CountryData["regions"][number];
type MethodInfo = CountryData["methods"][number];
type RateMode = "default" | "custom" | "unavailable";
type RateForm = { methodId: string; mode: RateMode; cost: number | null; freeOver: number | null; minDays: number | null; maxDays: number | null };

const field = "h-10 rounded-lg text-sm";

/** Add-one-at-a-time country picker shown as removable chips. */
export function CountryChips({ value, onChange, all, label }: { value: string[]; onChange: (v: string[]) => void; all: { code: string; name: string }[]; label: string }) {
  const options = useCountryOptions(useMemo(() => all.filter((c) => !value.includes(c.code)), [all, value]));
  const name = (code: string) => all.find((c) => c.code === code)?.name ?? code;
  return (
    <div className="space-y-2">
      {value.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {value.map((code) => (
            <span key={code} className="inline-flex items-center gap-1.5 rounded-full border border-ad-border bg-ad-sunken py-1 pe-1 ps-2 text-xs">
              <CountryFlag code={code} className="h-3 w-4" />
              {name(code)}
              <button type="button" onClick={() => onChange(value.filter((c) => c !== code))} className="grid size-5 place-items-center rounded-full hover:bg-ad-hover" aria-label={`${label}: ${name(code)} ×`}>
                <X className="size-3" />
              </button>
            </span>
          ))}
        </div>
      )}
      <Combobox label={label} placeholder={label} options={options} value={null} onChange={(code) => onChange([...value, code])} searchable className={field} />
    </div>
  );
}

const rateOf = (r: Region, methodId: string) => r.rates.find((x) => x.methodId === methodId);

function toRateForms(methods: MethodInfo[], r?: Region): RateForm[] {
  return methods.map((m) => {
    const x = r && rateOf(r, m.id);
    return { methodId: m.id, mode: !x ? "default" : x.isAvailable ? "custom" : "unavailable", cost: x?.cost ?? null, freeOver: x?.freeOver ?? null, minDays: x?.minDays ?? null, maxDays: x?.maxDays ?? null };
  });
}

/** Per-method delivery price / time for a city (or many cities at once). */
function RateEditor({ methods, rates, onChange, errors }: { methods: MethodInfo[]; rates: RateForm[]; onChange: (r: RateForm[]) => void; errors: Record<string, string[]> }) {
  const { locale, money, fmt } = useAdmin();
  const ar = locale === "ar";
  const set = (id: string, patch: Partial<RateForm>) => onChange(rates.map((r) => (r.methodId === id ? { ...r, ...patch } : r)));
  if (!methods.length) return <p className="rounded-xl border border-dashed border-ad-border p-4 text-sm text-ad-muted">{ar ? "لا توجد طريقة شحن لهذه الدولة. أضف منطقة شحن تشملها من إعدادات الشحن." : "No shipping method covers this country yet. Add a shipping zone for it in Shipping settings."}</p>;
  const days = (a: number | null, b: number | null) => (a == null && b == null ? "" : `${a ?? b}${b != null && b !== a ? `–${b}` : ""} ${ar ? "يوم" : "d"}`);
  return (
    <div className="space-y-3">
      {methods.map((m) => {
        const r = rates.find((x) => x.methodId === m.id)!;
        return (
          <div key={m.id} className={cn("rounded-xl border border-ad-border p-3", r.mode === "unavailable" && "bg-ad-sunken/60")}>
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <Truck className="size-4 text-ad-muted" />
              <span className="text-sm font-medium">{m.name}</span>
              <span className="text-xs text-ad-muted">
                {ar ? "الافتراضي" : "Default"}: {m.type === "FREE" ? (ar ? "مجاني" : "Free") : fmt(m.cost)} {days(m.minDays, m.maxDays) && `· ${days(m.minDays, m.maxDays)}`}
              </span>
              {m.limitToRegions && <Pill tone="amber">{ar ? "مدن محددة فقط" : "Selected cities only"}</Pill>}
            </div>
            <Segmented
              size="sm"
              value={r.mode}
              onChange={(mode) => set(m.id, mode === "custom" && r.cost == null ? { mode, cost: m.cost, minDays: m.minDays, maxDays: m.maxDays, freeOver: m.freeOver } : { mode })}
              options={[
                { value: "default", label: m.limitToRegions ? (ar ? "غير متاح (افتراضي)" : "Off (default)") : ar ? "السعر الافتراضي" : "Default price" },
                { value: "custom", label: ar ? "سعر ومدة خاصة" : "Custom price & time" },
                { value: "unavailable", label: ar ? "غير متاح هنا" : "Not available" },
              ]}
            />
            {r.mode === "custom" && (
              <div className="mt-3 grid gap-3 sm:grid-cols-3">
                <div>
                  <Label>{ar ? "سعر التوصيل" : "Delivery price"}</Label>
                  <MoneyInput value={r.cost} onChange={(v) => set(m.id, { cost: v })} decimals={money.base.decimals} symbol={money.display.symbol} placeholder={fmt(m.cost)} />
                </div>
                <div>
                  <Label optional>{ar ? "مجاني فوق" : "Free over"}</Label>
                  <MoneyInput value={r.freeOver} onChange={(v) => set(m.id, { freeOver: v })} decimals={money.base.decimals} symbol={money.display.symbol} placeholder={m.freeOver != null ? fmt(m.freeOver) : "—"} />
                </div>
                <div>
                  <Label>{ar ? "مدة التوصيل (أيام)" : "Delivery time (days)"}</Label>
                  <div className="flex items-center gap-2" dir="ltr">
                    <TextInput type="number" min={0} max={365} value={r.minDays ?? ""} placeholder={String(m.minDays ?? "")} onChange={(e) => set(m.id, { minDays: e.target.value === "" ? null : Number(e.target.value) })} aria-label={ar ? "من" : "From"} />
                    <span>–</span>
                    <TextInput type="number" min={0} max={365} value={r.maxDays ?? ""} placeholder={String(m.maxDays ?? "")} invalid={Boolean(errors[`rates.${m.id}.maxDays`])} onChange={(e) => set(m.id, { maxDays: e.target.value === "" ? null : Number(e.target.value) })} aria-label={ar ? "إلى" : "To"} />
                  </div>
                  <FieldError message={errors[`rates.${m.id}.maxDays`] ? (ar ? "الحد الأدنى أكبر من الأقصى" : "Min is greater than max") : null} />
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

/** Short per-city summary chips: custom price, unavailable, or default. */
function RateChips({ r, methods }: { r: Region; methods: MethodInfo[] }) {
  const { locale, fmt } = useAdmin();
  const ar = locale === "ar";
  return (
    <div className="flex flex-wrap gap-1">
      {methods.map((m) => {
        const x = rateOf(r, m.id);
        if (!x) return m.limitToRegions ? null : null;
        if (!x.isAvailable)
          return (
            <Pill key={m.id} tone="red" className="gap-1">
              <Ban className="size-3" />
              {m.name}
            </Pill>
          );
        const d = x.minDays != null || x.maxDays != null ? ` · ${x.minDays ?? x.maxDays}${x.maxDays != null && x.maxDays !== x.minDays ? `–${x.maxDays}` : ""}${ar ? " يوم" : "d"}` : "";
        return (
          <Pill key={m.id} tone="blue">
            {m.name}: {x.cost != null ? fmt(x.cost) : fmt(m.cost)}
            {d}
          </Pill>
        );
      })}
    </div>
  );
}

export function RegionsView({ overview, initial }: { overview: Overview; initial: CountryData | null }) {
  const { t, locale } = useAdmin();
  const ar = locale === "ar";
  const router = useRouter();

  // ── Shipping countries ──
  const [countries, setCountries] = useState(overview.shipping.map((c) => c.code));
  const [defaultCountry, setDefaultCountry] = useState(overview.defaultCountry);
  const [savingCountries, startCountries] = useTransition();
  const countriesDirty = countries.join() !== overview.shipping.map((c) => c.code).join() || defaultCountry !== overview.defaultCountry;
  const nameOf = (code: string) => overview.allCountries.find((c) => c.code === code)?.name ?? code;
  const defaultOptions = useCountryOptions(useMemo(() => (countries.length ? countries.map((code) => ({ code, name: nameOf(code) })) : overview.allCountries), [countries, overview.allCountries])); // eslint-disable-line react-hooks/exhaustive-deps
  const saveCountries = () =>
    startCountries(async () => {
      const def = countries.length && !countries.includes(defaultCountry) ? countries[0] : defaultCountry;
      const r = await saveCountriesAction({ countries, defaultCountry: def });
      if (r.ok) {
        setDefaultCountry(def);
        toast.success(t("c.saved"));
        router.refresh();
      } else toast.error(t("c.fixErrors"));
    });

  // ── Cities of the selected country ──
  const tabs = overview.shipping.length ? overview.shipping : [{ code: overview.defaultCountry, name: nameOf(overview.defaultCountry), cities: initial?.regions.length ?? 0, activeCities: 0, preset: 0 }];
  const tabOptions = useCountryOptions(tabs);
  const [country, setCountry] = useState(initial?.country ?? tabs[0]?.code ?? "SA");
  const [data, setData] = useState<CountryData | null>(initial);
  const [loading, startLoad] = useTransition();
  const [busy, startBusy] = useTransition();
  const load = (code = country) =>
    startLoad(async () => {
      const r = await countryRegionsAction(code, locale);
      if (r.ok) setData(r.data);
    });
  useEffect(() => {
    if (data?.country !== country) load(country);
  }, [country]); // eslint-disable-line react-hooks/exhaustive-deps

  const [q, setQ] = useState("");
  const [status, setStatus] = useState<"all" | "active" | "inactive" | "custom">("all");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const regions = data?.country === country ? data.regions : [];
  const methods = data?.country === country ? data.methods : [];
  const filtered = useMemo(() => {
    const n = normalizeText(q.trim());
    return regions.filter((r) => (status === "all" || (status === "active" ? r.isActive : status === "inactive" ? !r.isActive : r.rates.length > 0)) && (!n || normalizeText(`${r.name.ar ?? ""} ${r.name.en ?? ""} ${r.group.ar ?? ""} ${r.group.en ?? ""}`).includes(n)));
  }, [regions, q, status]);
  const canSort = !q && status === "all";
  const allSelected = filtered.length > 0 && filtered.every((r) => selected.has(r.id));
  const toggle = (id: string) => setSelected((s) => (s.has(id) ? (s.delete(id), new Set(s)) : new Set(s.add(id))));

  const run = (fn: () => Promise<{ ok: boolean }>, msg = t("c.saved")) =>
    startBusy(async () => {
      const r = await fn();
      if (r.ok) {
        toast.success(msg);
        load();
        router.refresh();
      } else toast.error(t("c.fixErrors"));
    });

  // ── Drawers ──
  const [editing, setEditing] = useState<Region | "new" | null>(null);
  const [form, setForm] = useState({ name: {} as LocalizedText, group: {} as LocalizedText, isActive: true });
  const [rates, setRates] = useState<RateForm[]>([]);
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [bulkRates, setBulkRates] = useState<RateForm[] | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string[] | null>(null);
  const openEdit = (r: Region | "new") => {
    setEditing(r);
    setErrors({});
    setForm(r === "new" ? { name: {}, group: {}, isActive: true } : { name: r.name, group: r.group, isActive: r.isActive });
    setRates(toRateForms(methods, r === "new" ? undefined : r));
  };
  const saveCity = () =>
    startBusy(async () => {
      const r = await saveRegionAction(editing === "new" ? null : editing!.id, { country, ...form });
      if (!r.ok) return void (setErrors(r.fieldErrors ?? {}), toast.error(t("c.fixErrors")));
      const changed = rates.filter((x) => {
        const before = toRateForms(methods, editing === "new" ? undefined : editing!).find((b) => b.methodId === x.methodId);
        return JSON.stringify(before) !== JSON.stringify(x);
      });
      if (changed.length) {
        const rr = await saveRegionRatesAction([r.data.id], changed);
        if (!rr.ok) return void (setErrors(rr.fieldErrors ?? {}), toast.error(t("c.fixErrors")));
      }
      toast.success(t("c.saved"));
      setEditing(null);
      load();
      router.refresh();
    });
  const applyBulkRates = () =>
    startBusy(async () => {
      const r = await saveRegionRatesAction([...selected], bulkRates);
      if (!r.ok) return void (setErrors(r.fieldErrors ?? {}), toast.error(t("c.fixErrors")));
      toast.success(t("c.saved"));
      setBulkRates(null);
      setSelected(new Set());
      load();
    });

  const tab = tabs.find((c) => c.code === country);
  const presetCount = overview.shipping.find((c) => c.code === country)?.preset ?? 0;
  const customCount = regions.filter((r) => r.rates.length).length;
  const activeCount = regions.filter((r) => r.isActive).length;

  return (
    <>
      <PageHeader
        back={{ href: "/admin/settings", label: t("s.title") }}
        title={t("s.regions")}
        description={ar ? "الدول التي تشحن إليها، ومدن/محافظات كل دولة، وسعر ومدة التوصيل لكل مدينة." : "Where you ship, the cities / governorates of each country, and delivery price and time per city."}
      />

      <div className="space-y-5">
        <Panel
          title={
            <span className="flex items-center gap-2">
              <Globe2 className="size-4 text-ad-muted" />
              {ar ? "دول الشحن" : "Shipping countries"}
            </span>
          }
          description={
            countries.length === 1
              ? ar
                ? "دولة واحدة فقط: لن تظهر قائمة الدول في صفحة الدفع، وسيختار العميل المدينة/المحافظة فقط."
                : "Only one country: checkout won't show a country picker — customers just choose their city / governorate."
              : countries.length
                ? ar
                  ? "يمكن للعملاء اختيار إحدى هذه الدول فقط عند الدفع."
                  : "Customers can only choose one of these countries at checkout."
                : ar
                  ? "القائمة فارغة: الشحن مفتوح لجميع الدول."
                  : "Empty list: you ship to every country."
          }
          actions={
            countriesDirty && (
              <div className="flex gap-2">
                <Button size="sm" variant="ghost" onClick={() => (setCountries(overview.shipping.map((c) => c.code)), setDefaultCountry(overview.defaultCountry))}>
                  {t("c.cancel")}
                </Button>
                <Button size="sm" onClick={saveCountries} loading={savingCountries}>
                  {t("c.save")}
                </Button>
              </div>
            )
          }
        >
          <div className="grid gap-4 md:grid-cols-[1fr_16rem]">
            <div>
              <Label>{ar ? "الدول" : "Countries"}</Label>
              <CountryChips value={countries} onChange={setCountries} all={overview.allCountries} label={ar ? "أضف دولة…" : "Add a country…"} />
            </div>
            <div>
              <Label hint={ar ? "تُختار مسبقًا في صفحة الدفع" : "Preselected at checkout"}>{ar ? "الدولة الافتراضية" : "Default country"}</Label>
              <Combobox label={ar ? "الدولة الافتراضية" : "Default country"} options={defaultOptions} value={defaultCountry} onChange={setDefaultCountry} searchable className={field} />
            </div>
          </div>
          {overview.shipping.length > 0 && (
            <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {overview.shipping.map((c) => (
                <button key={c.code} type="button" onClick={() => setCountry(c.code)} className={cn("flex items-center gap-3 rounded-xl border p-3 text-start transition", c.code === country ? "border-ad-accent bg-ad-accent/5" : "border-ad-border hover:border-ad-fg/20")}>
                  <CountryFlag code={c.code} className="h-5 w-7" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{c.name}</span>
                    <span className="block text-xs text-ad-muted">{c.cities ? (ar ? `${c.activeCities} من ${c.cities} مدينة مفعّلة` : `${c.activeCities} of ${c.cities} cities active`) : ar ? "بدون قائمة مدن (إدخال حر)" : "No city list (free text)"}</span>
                  </span>
                  {c.code === overview.defaultCountry && <Pill tone="green">{ar ? "افتراضي" : "Default"}</Pill>}
                </button>
              ))}
            </div>
          )}
        </Panel>

        <Panel padded={false}>
          <div className="flex flex-wrap items-center gap-3 border-b border-ad-border px-4 py-3">
            <MapPin className="size-4 text-ad-muted" />
            <h2 className="text-sm font-semibold">{ar ? "المدن والمحافظات" : "Cities & governorates"}</h2>
            {tabs.length > 1 ? (
              <div className="w-56">
                <Combobox label={ar ? "الدولة" : "Country"} options={tabOptions} value={country} onChange={(c) => (setCountry(c), setSelected(new Set()), setQ(""))} searchable={tabs.length > 6} className="h-9 rounded-lg text-sm" />
              </div>
            ) : (
              <span className="flex items-center gap-2 text-sm text-ad-muted">
                <CountryFlag code={country} />
                {tab?.name ?? nameOf(country)}
              </span>
            )}
            <div className="ms-auto flex flex-wrap gap-2">
              {presetCount > 0 && (
                <Button size="sm" variant="outline" leftIcon={<Download />} loading={busy} onClick={() => run(() => importRegionsAction(country), ar ? "تم استيراد المدن" : "Cities imported")}>
                  {regions.length ? (ar ? "استيراد المدن الناقصة" : "Import missing cities") : ar ? `استيراد ${presetCount} مدينة جاهزة` : `Import ${presetCount} ready cities`}
                </Button>
              )}
              <Button size="sm" leftIcon={<Plus />} onClick={() => openEdit("new")} disabled={!data}>
                {ar ? "إضافة مدينة" : "Add city"}
              </Button>
            </div>
          </div>

          {methods.length > 0 && (
            <div className="grid gap-2 border-b border-ad-border bg-ad-sunken/40 px-4 py-3 md:grid-cols-2">
              {methods.map((m) => (
                <div key={m.id} className="flex items-center gap-3 rounded-lg bg-ad-panel px-3 py-2 ring-1 ring-ad-border">
                  <Truck className="size-4 shrink-0 text-ad-muted" />
                  <span className="min-w-0 flex-1 truncate text-sm">{m.name}</span>
                  <Switch checked={m.limitToRegions} onCheckedChange={(v) => run(() => setMethodLimitAction(m.id, v))} label={<span className="text-xs">{ar ? "مدن محددة فقط" : "Selected cities only"}</span>} />
                </div>
              ))}
              <p className="text-xs text-ad-muted md:col-span-2">
                {ar
                  ? "«مدن محددة فقط»: تظهر الطريقة فقط في المدن التي حددت لها سعرًا خاصًا (مثال: التوصيل السريع في المدن الرئيسية)."
                  : "“Selected cities only”: the method appears only in cities you gave a custom price (e.g. express in main cities)."}
              </p>
            </div>
          )}

          {regions.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 px-4 py-3">
              <div className="relative min-w-[12rem] flex-1">
                <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-ad-muted" />
                <TextInput value={q} onChange={(e) => setQ(e.target.value)} placeholder={ar ? "ابحث عن مدينة أو منطقة…" : "Search city or region…"} className="ps-9" />
              </div>
              <Segmented
                size="sm"
                value={status}
                onChange={setStatus}
                options={[
                  { value: "all", label: `${t("c.all")} ${regions.length}` },
                  { value: "active", label: `${t("c.active")} ${activeCount}` },
                  { value: "inactive", label: `${t("c.inactive")} ${regions.length - activeCount}` },
                  { value: "custom", label: `${ar ? "أسعار خاصة" : "Custom rates"} ${customCount}` },
                ]}
              />
            </div>
          )}

          {loading && !regions.length ? (
            <div className="space-y-2 p-4">
              {Array.from({ length: 5 }, (_, i) => (
                <div key={i} className="h-12 animate-pulse rounded-lg bg-ad-sunken" />
              ))}
            </div>
          ) : !regions.length ? (
            <AdminEmpty
              icon={<MapPin />}
              title={ar ? "لا توجد مدن لهذه الدولة" : "No cities for this country"}
              text={ar ? "بدون قائمة، يكتب العميل اسم المدينة بنفسه. استورد القائمة الجاهزة أو أضف المدن يدويًا لتحديد سعر ومدة توصيل لكل مدينة." : "Without a list, customers type their city. Import the ready list or add cities to set a delivery price and time per city."}
            />
          ) : (
            <div className={cn("border-t border-ad-border", loading && "opacity-60")}>
              <div className="flex items-center gap-3 bg-ad-sunken/40 px-4 py-2 text-xs text-ad-muted">
                <input type="checkbox" className="size-4 accent-[var(--ad-accent)]" checked={allSelected} onChange={() => setSelected(allSelected ? new Set() : new Set(filtered.map((r) => r.id)))} aria-label={t("c.all")} />
                <span className="flex-1">{ar ? `${filtered.length} مدينة` : `${filtered.length} cities`}</span>
              </div>
              {(() => {
                const row = (r: Region, handle?: React.ReactNode) => (
                  <div className={cn("flex items-center gap-3 px-4 py-2.5", !r.isActive && "opacity-60")}>
                    {handle}
                    <input type="checkbox" className="size-4 shrink-0 accent-[var(--ad-accent)]" checked={selected.has(r.id)} onChange={() => toggle(r.id)} aria-label={r.label} />
                    <button type="button" onClick={() => openEdit(r)} className="min-w-0 flex-1 text-start">
                      <span className="block truncate text-sm font-medium">{r.label}</span>
                      <span className="block truncate text-xs text-ad-muted">{[r.groupLabel, ar ? r.name.en : r.name.ar].filter(Boolean).join(" · ")}</span>
                    </button>
                    <div className="hidden max-w-[45%] md:block">
                      <RateChips r={r} methods={methods} />
                    </div>
                    {r.rates.length > 0 && <Coins className="size-4 shrink-0 text-blue-600 md:hidden" aria-label={ar ? "سعر خاص" : "Custom rate"} />}
                    <Switch checked={r.isActive} onCheckedChange={(v) => run(() => bulkRegionsAction([r.id], v ? "activate" : "deactivate"))} label={<span className="sr-only">{t("c.active")}</span>} />
                    <Button size="icon-sm" variant="ghost" aria-label={t("c.edit")} onClick={() => openEdit(r)}>
                      <Pencil />
                    </Button>
                  </div>
                );
                return canSort ? (
                  <SortableList
                    items={regions}
                    getId={(r) => r.id}
                    onChange={(l) => {
                      setData((d) => (d ? { ...d, regions: l } : d));
                      startBusy(async () => void (await reorderRegionsAction(l.map((r) => r.id))));
                    }}
                    className="divide-y divide-ad-border"
                    render={(r, handle) => row(r, handle)}
                  />
                ) : (
                  <div className="divide-y divide-ad-border">
                    {filtered.map((r) => (
                      <div key={r.id}>{row(r)}</div>
                    ))}
                    {!filtered.length && <p className="px-4 py-10 text-center text-sm text-ad-muted">{ar ? "لا نتائج" : "No matches"}</p>}
                  </div>
                );
              })()}
            </div>
          )}
        </Panel>
      </div>

      <BulkBar count={selected.size} onClear={() => setSelected(new Set())}>
        <Button size="sm" variant="outline" leftIcon={<Coins />} onClick={() => (setErrors({}), setBulkRates(toRateForms(methods)))} disabled={!methods.length}>
          {ar ? "سعر ومدة التوصيل" : "Delivery price & time"}
        </Button>
        <Button size="sm" variant="outline" leftIcon={<CheckCircle2 />} onClick={() => run(() => bulkRegionsAction([...selected], "activate"))}>
          {ar ? "تفعيل" : "Activate"}
        </Button>
        <Button size="sm" variant="outline" leftIcon={<Ban />} onClick={() => run(() => bulkRegionsAction([...selected], "deactivate"))}>
          {ar ? "تعطيل" : "Deactivate"}
        </Button>
        <Button size="sm" variant="outline" className="text-red-600" leftIcon={<Trash2 />} onClick={() => setConfirmDelete([...selected])}>
          {t("c.delete")}
        </Button>
      </BulkBar>

      <AdminDrawer open={editing !== null} onOpenChange={(o) => !o && setEditing(null)} size="md" label={ar ? "مدينة" : "City"}>
        {editing !== null && (
          <>
            <DrawerHeader
              context={[t("s.regions"), tab?.name ?? nameOf(country)]}
              title={editing === "new" ? (ar ? "مدينة جديدة" : "New city") : editing.label}
              actions={
                editing !== "new" && (
                  <Button size="icon-sm" variant="ghost" className="text-red-600" aria-label={t("c.delete")} onClick={() => setConfirmDelete([editing.id])}>
                    <Trash2 />
                  </Button>
                )
              }
            />
            <DrawerBody className="space-y-5">
              <div className="grid gap-4 @xl:grid-cols-2">
                <LocalizedField label={ar ? "اسم المدينة / المحافظة" : "City / governorate name"} value={form.name} onChange={(v) => setForm((f) => ({ ...f, name: v }))} error={errors.name || errors["name.ar"] || errors["name.en"] ? t("c.required") : null} />
                <LocalizedField label={<>{ar ? "المنطقة الإدارية" : "Administrative region"} <span className="text-ad-muted">({ar ? "اختياري" : "optional"})</span></>} value={form.group} onChange={(v) => setForm((f) => ({ ...f, group: v }))} />
              </div>
              <Switch checked={form.isActive} onCheckedChange={(v) => setForm((f) => ({ ...f, isActive: v }))} label={t("c.active")} description={ar ? "المدن غير المفعّلة لا تظهر للعملاء." : "Inactive cities are hidden from customers."} />
              <div>
                <h3 className="mb-2 text-sm font-semibold">{ar ? "التوصيل إلى هذه المدينة" : "Delivery to this city"}</h3>
                <RateEditor methods={methods} rates={rates} onChange={setRates} errors={errors} />
              </div>
            </DrawerBody>
            <DrawerFooter>
              <Button onClick={saveCity} loading={busy}>
                {t("c.save")}
              </Button>
              <Button variant="ghost" onClick={() => setEditing(null)}>
                {t("c.cancel")}
              </Button>
            </DrawerFooter>
          </>
        )}
      </AdminDrawer>

      <AdminDrawer open={bulkRates !== null} onOpenChange={(o) => !o && setBulkRates(null)} size="md" label={ar ? "سعر التوصيل" : "Delivery price"}>
        {bulkRates && (
          <>
            <DrawerHeader context={[t("s.regions"), tab?.name ?? nameOf(country)]} title={ar ? "سعر ومدة التوصيل" : "Delivery price & time"} subtitle={ar ? `يُطبّق على ${selected.size} مدينة محددة` : `Applies to ${selected.size} selected cities`} />
            <DrawerBody>
              <RateEditor methods={methods} rates={bulkRates} onChange={setBulkRates} errors={errors} />
            </DrawerBody>
            <DrawerFooter>
              <Button onClick={applyBulkRates} loading={busy}>
                {ar ? "تطبيق" : "Apply"}
              </Button>
              <Button variant="ghost" onClick={() => setBulkRates(null)}>
                {t("c.cancel")}
              </Button>
            </DrawerFooter>
          </>
        )}
      </AdminDrawer>

      <ConfirmDialog
        open={confirmDelete !== null}
        onOpenChange={(o) => !o && setConfirmDelete(null)}
        title={confirmDelete && confirmDelete.length > 1 ? (ar ? `حذف ${confirmDelete.length} مدينة؟` : `Delete ${confirmDelete.length} cities?`) : t("c.confirmDelete")}
        text={ar ? "العناوين والطلبات السابقة تحتفظ باسم المدينة." : "Past addresses and orders keep the city name."}
        confirmLabel={t("c.delete")}
        onConfirm={async () => {
          const ids = confirmDelete ?? [];
          const r = await bulkRegionsAction(ids, "delete");
          if (r.ok) {
            setSelected(new Set());
            setEditing(null);
            setConfirmDelete(null);
            load();
            router.refresh();
          } else toast.error(t("c.fixErrors"));
        }}
      />
    </>
  );
}

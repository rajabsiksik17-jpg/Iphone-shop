"use client";

import { useEffect, useMemo, useRef, useState, useTransition, type ReactNode } from "react";
import { AlertCircle, ChevronDown, Eye, Globe2, Plus, RefreshCw, RotateCcw, Trash2, Truck, Star, Lock } from "lucide-react";
import { Flag } from "@/components/ui/flag";
import { timeAgo } from "@/lib/time";
import { toast } from "sonner";
import { useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { useAdmin } from "../admin-context";
import { PageHeader, Panel, Pill, Segmented, Switch } from "../ui";
import { Label, TextInput, Select, LocalizedField, ColorInput, MoneyInput, TextArea, FieldError } from "../fields";
import { SortableList } from "../sortable";
import { saveCurrenciesAction, saveFxSettingsAction, refreshRatesAction, saveShippingAction, saveOrderStatusesAction, saveTemplateAction, resetTemplateAction, previewTemplateAction } from "@/actions/admin/settings";
import { t as tr, type LocalizedText } from "@/lib/i18n-text";
import { cn } from "@/lib/utils";
import type { currencyPage, shippingZones, orderStatusList, templateList } from "@/server/admin/settings-data";
import { TimeAgo } from "@/components/ui/time-ago";

let seq = 0;
const tmp = () => `tmp-${Date.now().toString(36)}${(seq++).toString(36)}`;

/** Page chrome + sticky save bar shared by the table-backed settings screens. */
function Shell({ title, description, dirty, pending, onSave, onDiscard, children, actions }: { title: string; description?: string; dirty: boolean; pending: boolean; onSave: () => void; onDiscard: () => void; children: ReactNode; actions?: ReactNode }) {
  const { t } = useAdmin();
  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => {
      if (dirty) e.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);
  return (
    <>
      <PageHeader
        back={{ href: "/admin/settings", label: t("s.title") }}
        title={title}
        description={description}
        actions={
          <>
            {actions}
            <Button loading={pending} disabled={!dirty} onClick={onSave}>
              {t("c.save")}
            </Button>
          </>
        }
      />
      {children}
      <div className={cn("fixed inset-x-3 bottom-20 z-30 mx-auto flex max-w-xl items-center gap-3 rounded-2xl border border-ad-border bg-ad-panel p-2.5 ps-4 shadow-pop transition lg:bottom-6", dirty ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-4 opacity-0")}>
        <span className="flex min-w-0 flex-1 items-center gap-2 text-sm">
          <AlertCircle className="size-4 shrink-0 text-amber-500" /> <span className="truncate max-sm:sr-only">{t("c.unsaved")}</span>
        </span>
        <Button variant="ghost" size="sm" onClick={onDiscard}>
          {t("c.discard")}
        </Button>
        <Button size="sm" loading={pending} onClick={onSave}>
          {t("c.save")}
        </Button>
      </div>
    </>
  );
}

const conflictText = (code: string, ar: boolean) =>
  ({
    base_locked: ar ? "لا يمكن تغيير العملة الأساسية أو خاناتها العشرية بعد وجود طلبات." : "The base currency (and its decimals) can't change once orders exist.",
    system_status: ar ? "لا يمكن حذف حالات النظام." : "System statuses can't be removed.",
    status_in_use: ar ? "لا يمكن حذف حالة مستخدمة في طلبات." : "A status used by existing orders can't be removed.",
  })[code];

// ──────────────────────────────── Currencies ────────────────────────────────

type CurrencyData = Awaited<ReturnType<typeof currencyPage>>;
type Currency = CurrencyData["rows"][number];

const INTERVALS = [1, 3, 6, 12, 24, 48] as const;

export function CurrenciesView({ data }: { data: CurrencyData }) {
  const { rows, hasOrders, fx, catalog } = data;
  const { t, locale } = useAdmin();
  const router = useRouter();
  const ar = locale === "ar";
  const [list, setList] = useState(rows);
  const [dirty, setDirty] = useState(false);
  const [open, setOpen] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [refreshing, startRefresh] = useTransition();
  // Pick up fresh server data (e.g. refreshed rates) unless the admin has unsaved edits.
  const dirtyRef = useRef(dirty);
  dirtyRef.current = dirty;
  useEffect(() => {
    if (!dirtyRef.current) setList(rows);
  }, [rows]);
  const base = list.find((c) => c.isBase);
  const set = (code: string, patch: Partial<Currency>) => (setList((l) => l.map((c) => (c.code === code ? { ...c, ...patch } : c))), setDirty(true));
  const save = () =>
    start(async () => {
      const r = await saveCurrenciesAction(list.map(({ position: _p, rateUpdatedAt: _u, ...c }) => c));
      if (r.ok) {
        toast.success(t("c.saved"));
        setDirty(false);
        router.refresh();
      } else toast.error(conflictText(r.error, ar) ?? t("c.fixErrors"));
    });
  const refresh = () =>
    startRefresh(async () => {
      if (dirty && !window.confirm(t("c.unsaved"))) return;
      const r = await refreshRatesAction();
      if (r.ok) toast.success(ar ? `تم تحديث ${r.data.updated} سعر صرف` : `Updated ${r.data.updated} exchange rates`);
      else toast.error(ar ? "تعذر الوصول لمزود الأسعار — بقيت آخر أسعار صحيحة" : "Couldn't reach the rates provider — the last valid rates are kept");
      setDirty(false);
      router.refresh();
    });
  const sample = (c: Currency) => {
    const n = (1234.5 * c.rate).toFixed(c.decimals).split(".");
    const num = n[0].replace(/\B(?=(\d{3})+(?!\d))/g, c.thousandsSep) + (n[1] ? c.decimalSep + n[1] : "");
    const sym = tr(c.symbol, locale) || c.code;
    return c.symbolPosition === "BEFORE" ? `${sym}${num}` : `${num} ${sym}`;
  };
  const stale = (c: Currency) => !c.isBase && c.autoRate && (!c.rateUpdatedAt || Date.now() - new Date(c.rateUpdatedAt).getTime() > 48 * 3_600_000);
  const addFromCatalog = (code: string) => {
    const m = catalog.find((x) => x.code === code);
    setList((l) => [
      ...l,
      { code, name: m?.name ?? { en: code, ar: code }, symbol: m?.symbol ?? { en: code, ar: code }, decimals: m?.decimals ?? 2, symbolPosition: m?.symbolPosition ?? "AFTER", thousandsSep: ",", decimalSep: ".", rate: 1, isActive: true, isBase: false, position: l.length, autoRate: true, rateUpdatedAt: null, flag: m?.flag ?? null },
    ]);
    setDirty(true);
    setOpen(code);
  };

  return (
    <Shell
      title={t("s.currencies")}
      description={ar ? "الأسعار تُخزن بالعملة الأساسية وتُعرض بالعملة التي يختارها المتسوق. الطلبات تحفظ سعر الصرف المستخدم وقت الشراء." : "Prices are stored in the base currency and converted for display. Orders keep the rate used at purchase."}
      dirty={dirty}
      pending={pending}
      onSave={save}
      onDiscard={() => (setList(rows), setDirty(false))}
      actions={
        <Button variant="outline" leftIcon={<RefreshCw className={cn(refreshing && "animate-spin")} />} disabled={refreshing} onClick={refresh}>
          {ar ? "تحديث الأسعار الآن" : "Refresh rates now"}
        </Button>
      }
    >
      <FxPanel fx={fx} />

      <SortableList
        items={list}
        getId={(c) => c.code}
        onChange={(l) => (setList(l), setDirty(true))}
        className="mt-4 space-y-2"
        render={(c, handle) => {
          const expanded = open === c.code;
          return (
            <Panel padded={false} className={cn(!c.isActive && "opacity-70")}>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-2 px-3 py-2.5 sm:px-4">
                {handle}
                <Flag code={c.flag} className="h-4 w-6" />
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-sm font-semibold">{c.code}</span>
                    {c.isBase && <Pill tone="violet">{t("s.base")}</Pill>}
                    {!c.isBase && (c.autoRate ? <Pill tone={stale(c) ? "amber" : "green"}>{ar ? "تلقائي" : "Auto"}</Pill> : <Pill>{ar ? "يدوي" : "Manual"}</Pill>)}
                  </div>
                  <p className="truncate text-xs text-ad-muted">{tr(c.name, locale)}</p>
                </div>
                <div className="ms-auto flex items-center gap-3 text-end">
                  <div className="hidden sm:block">
                    <p className="font-mono text-sm tabular-nums" dir="ltr">
                      {c.isBase ? "1.00" : `1 ${base?.code ?? ""} = ${c.rate.toLocaleString("en", { maximumFractionDigits: 6 })} ${c.code}`}
                    </p>
                    <p className={cn("text-[11px]", stale(c) ? "text-amber-600" : "text-ad-muted")}>
                      {c.isBase ? sample(c) : c.rateUpdatedAt ? `${ar ? "حُدّث" : "Updated"} ${timeAgo(c.rateUpdatedAt, locale)}` : ar ? "لم يُحدّث بعد" : "Not updated yet"}
                    </p>
                  </div>
                  {!c.isBase && <Switch checked={c.isActive} onCheckedChange={(v) => set(c.code, { isActive: v })} label={<span className="sr-only">{t("c.active")}</span>} />}
                  <Button size="icon-sm" variant="ghost" aria-label={t("c.edit")} aria-expanded={expanded} onClick={() => setOpen(expanded ? null : c.code)}>
                    <ChevronDown className={cn("transition", expanded && "rotate-180")} />
                  </Button>
                </div>
              </div>
              {expanded && (
                <div className="space-y-4 border-t border-ad-border p-4">
                  {!c.isBase && (
                    <div className="grid gap-4 sm:grid-cols-[auto_minmax(0,1fr)] sm:items-end">
                      <Segmented
                        size="sm"
                        value={c.autoRate ? "auto" : "manual"}
                        onChange={(v) => set(c.code, { autoRate: v === "auto" })}
                        options={[
                          { value: "auto", label: ar ? "سعر تلقائي" : "Automatic rate" },
                          { value: "manual", label: ar ? "سعر ثابت" : "Fixed rate" },
                        ]}
                      />
                      <div>
                        <Label hint={base ? `1 ${base.code} = ? ${c.code}` : undefined}>{t("s.rate")}</Label>
                        <TextInput type="number" step="0.000001" min={0} disabled={c.autoRate} value={c.rate} onChange={(e) => set(c.code, { rate: Number(e.target.value) })} dir="ltr" />
                      </div>
                      <p className="text-xs text-ad-muted sm:col-span-2">
                        {c.autoRate
                          ? ar
                            ? `يُحدّث من ${fx.provider} كل ${fx.intervalHours} ساعة. عند تعذر الاتصال تبقى آخر قيمة صحيحة.`
                            : `Updated from ${fx.provider} every ${fx.intervalHours}h. If the provider is unreachable the last valid rate stays.`
                          : ar
                            ? "سعر ثابت تحدده أنت ولا يغيّره التحديث التلقائي."
                            : "A rate you set; automatic updates never change it."}
                      </p>
                    </div>
                  )}
                  <div className="grid gap-4 sm:grid-cols-2">
                    <LocalizedField label={t("c.name")} value={c.name as LocalizedText} onChange={(v) => set(c.code, { name: v as Record<string, string> })} />
                    <LocalizedField label={t("s.symbol")} value={c.symbol as LocalizedText} onChange={(v) => set(c.code, { symbol: v as Record<string, string> })} />
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                    <div>
                      <Label>{t("s.decimals")}</Label>
                      <TextInput type="number" min={0} max={4} disabled={c.isBase && hasOrders} value={c.decimals} onChange={(e) => set(c.code, { decimals: Number(e.target.value) })} />
                    </div>
                    <div>
                      <Label>{t("s.symbolPos")}</Label>
                      <Segmented size="sm" value={c.symbolPosition} onChange={(v) => set(c.code, { symbolPosition: v })} options={[{ value: "BEFORE", label: t("s.before") }, { value: "AFTER", label: t("s.after") }]} />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <Label>{t("s.thousands")}</Label>
                        <TextInput value={c.thousandsSep} maxLength={2} onChange={(e) => set(c.code, { thousandsSep: e.target.value })} dir="ltr" />
                      </div>
                      <div>
                        <Label>{t("s.decimalSep")}</Label>
                        <TextInput value={c.decimalSep} maxLength={2} onChange={(e) => set(c.code, { decimalSep: e.target.value })} dir="ltr" />
                      </div>
                    </div>
                    <div>
                      <Label hint={ar ? "رمز الدولة" : "Country code"}>{ar ? "العلم" : "Flag"}</Label>
                      <div className="flex items-center gap-2">
                        <Flag code={c.flag} className="h-4 w-6" />
                        <TextInput value={c.flag ?? ""} maxLength={2} onChange={(e) => set(c.code, { flag: e.target.value.toUpperCase().replace(/[^A-Z]/g, "") || null })} dir="ltr" className="font-mono" placeholder="SA" />
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-3 border-t border-ad-border pt-3 text-xs">
                    <span className="text-ad-muted">
                      {ar ? "معاينة:" : "Preview:"} <span className="font-medium text-ad-fg">{sample(c)}</span>
                    </span>
                    {!c.isBase && !hasOrders && (
                      <button type="button" className="text-ad-accent hover:underline" onClick={() => (setList((l) => l.map((x) => ({ ...x, isBase: x.code === c.code, rate: x.code === c.code ? 1 : x.rate, isActive: x.code === c.code ? true : x.isActive }))), setDirty(true))}>
                        {ar ? "اجعلها العملة الأساسية" : "Make base currency"}
                      </button>
                    )}
                    {!c.isBase && (
                      <button type="button" className="ms-auto inline-flex items-center gap-1 text-red-600 hover:underline" onClick={() => (setList((l) => l.filter((x) => x.code !== c.code)), setDirty(true))}>
                        <Trash2 className="size-3.5" /> {t("c.delete")}
                      </button>
                    )}
                  </div>
                </div>
              )}
            </Panel>
          );
        }}
      />
      <AddCurrency existing={list.map((c) => c.code)} catalog={catalog} onAdd={addFromCatalog} />
    </Shell>
  );
}

/** Rate-feed status and options (saved on change, separately from the table). */
function FxPanel({ fx }: { fx: CurrencyData["fx"] }) {
  const { t, locale } = useAdmin();
  const router = useRouter();
  const ar = locale === "ar";
  const [form, setForm] = useState({ autoUpdate: fx.autoUpdate, intervalHours: fx.intervalHours, currencyByCountry: fx.currencyByCountry });
  const [pending, start] = useTransition();
  const update = (patch: Partial<typeof form>) => {
    const next = { ...form, ...patch };
    setForm(next);
    start(async () => {
      const r = await saveFxSettingsAction(next);
      if (r.ok) {
        toast.success(t("c.saved"));
        router.refresh();
      } else toast.error(t("c.fixErrors"));
    });
  };
  const failing = Boolean(fx.lastError && (!fx.lastSuccessAt || (fx.lastAttemptAt && fx.lastAttemptAt > fx.lastSuccessAt)));
  return (
    <Panel padded={false}>
      <div className="flex flex-wrap items-center gap-3 border-b border-ad-border px-4 py-3">
        <span className={cn("grid size-9 place-items-center rounded-xl", failing ? "bg-amber-500/10 text-amber-600" : "bg-emerald-500/10 text-emerald-600")}>{failing ? <AlertCircle className="size-5" /> : <Globe2 className="size-5" />}</span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">{ar ? "أسعار الصرف" : "Exchange rates"}</p>
          <p className="truncate text-xs text-ad-muted">
            {fx.provider} · {fx.lastSuccessAt ? `${ar ? "آخر تحديث ناجح" : "Last successful update"} ${timeAgo(fx.lastSuccessAt, locale)}` : ar ? "لم يتم التحديث بعد" : "Never updated"}
          </p>
        </div>
        {pending && <RefreshCw className="size-4 animate-spin text-ad-muted" />}
      </div>
      {failing && (
        <p className="border-b border-ad-border bg-amber-500/5 px-4 py-2 text-xs text-amber-700 dark:text-amber-400">
          {ar ? "فشلت آخر محاولة تحديث — المتجر يستخدم آخر أسعار صحيحة." : "The last update attempt failed — the store keeps using the last valid rates."} <span className="font-mono opacity-80">{fx.lastError}</span>
        </p>
      )}
      <div className="grid gap-4 p-4 md:grid-cols-3">
        <Switch checked={form.autoUpdate} onCheckedChange={(v) => update({ autoUpdate: v })} label={ar ? "تحديث تلقائي" : "Automatic updates"} description={ar ? "للعملات المضبوطة على «سعر تلقائي»" : "For currencies set to “Automatic rate”"} />
        <div>
          <Label>{ar ? "التكرار" : "Frequency"}</Label>
          <Select value={String(form.intervalHours)} disabled={!form.autoUpdate} onChange={(e) => update({ intervalHours: Number(e.target.value) })}>
            {[...new Set([...INTERVALS, form.intervalHours])].sort((a, b) => a - b).map((h) => (
              <option key={h} value={h}>
                {ar ? `كل ${h} ساعة` : `Every ${h} hour${h > 1 ? "s" : ""}`}
              </option>
            ))}
          </Select>
        </div>
        <Switch
          checked={form.currencyByCountry}
          onCheckedChange={(v) => update({ currencyByCountry: v })}
          label={ar ? "عملة حسب الدولة" : "Currency by country"}
          description={ar ? "يرى الزائر عملة بلده أول مرة، ويمكنه التغيير في أي وقت" : "Visitors first see their country's currency; they can switch any time"}
        />
      </div>
    </Panel>
  );
}

function AddCurrency({ existing, catalog, onAdd }: { existing: string[]; catalog: CurrencyData["catalog"]; onAdd: (code: string) => void }) {
  const { t, locale } = useAdmin();
  const ar = locale === "ar";
  const [code, setCode] = useState("");
  const available = catalog.filter((c) => !existing.includes(c.code));
  const valid = /^[A-Z]{3}$/.test(code) && !existing.includes(code);
  return (
    <Panel className="mt-4" title={t("s.addCurrency")}>
      {available.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {available.map((c) => (
            <button key={c.code} type="button" onClick={() => onAdd(c.code)} className="flex items-center gap-2 rounded-full border border-ad-border px-3 py-1.5 text-[13px] transition hover:border-ad-fg/30 hover:bg-ad-sunken">
              <Flag code={c.flag} />
              <span className="font-mono font-semibold">{c.code}</span>
              <span className="text-ad-muted">{tr(c.name, locale)}</span>
              <Plus className="size-3.5 text-ad-muted" />
            </button>
          ))}
        </div>
      )}
      <div className="mt-4 flex max-w-sm items-end gap-2">
        <div className="flex-1">
          <Label hint="ISO 4217">{ar ? "رمز عملة آخر" : "Other currency code"}</Label>
          <TextInput value={code} onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z]/g, "").slice(0, 3))} placeholder="CHF" dir="ltr" className="font-mono" />
        </div>
        <Button variant="outline" leftIcon={<Plus />} disabled={!valid} onClick={() => (onAdd(code), setCode(""))}>
          {t("c.add")}
        </Button>
      </div>
    </Panel>
  );
}

// ───────────────────────────────── Shipping ─────────────────────────────────

type Zone = Awaited<ReturnType<typeof shippingZones>>[number];
type Method = Zone["methods"][number];
type ZoneForm = Omit<Zone, "id" | "methods"> & { id?: string; key: string; methods: (Omit<Method, "id"> & { id?: string; key: string })[] };

const toZoneForm = (zones: Zone[]): ZoneForm[] => zones.map((z) => ({ ...z, key: z.id, methods: z.methods.map((m) => ({ ...m, key: m.id })) }));

export function ShippingView({ zones }: { zones: Zone[] }) {
  const { t, locale, money, fmt } = useAdmin();
  const router = useRouter();
  const ar = locale === "ar";
  const [list, setList] = useState(() => toZoneForm(zones));
  const [dirty, setDirty] = useState(false);
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [pending, start] = useTransition();
  const change = (l: ZoneForm[]) => (setList(l), setDirty(true));
  const setZone = (key: string, patch: Partial<ZoneForm>) => change(list.map((z) => (z.key === key ? { ...z, ...patch } : z)));
  const setMethod = (zk: string, mk: string, patch: Partial<ZoneForm["methods"][number]>) => change(list.map((z) => (z.key === zk ? { ...z, methods: z.methods.map((m) => (m.key === mk ? { ...m, ...patch } : m)) } : z)));
  const save = () =>
    start(async () => {
      const r = await saveShippingAction(list.map(({ key: _k, methods, ...z }) => ({ ...z, methods: methods.map(({ key: _mk, ...m }) => m) })));
      if (r.ok) {
        toast.success(t("c.saved"));
        setErrors({});
        setDirty(false);
        router.refresh();
      } else {
        setErrors(r.fieldErrors ?? {});
        toast.error(t("c.fixErrors"));
      }
    });
  const summary = (m: ZoneForm["methods"][number]) =>
    m.type === "FREE" ? t("s.rate.FREE") : m.type === "PICKUP" ? `${t("s.rate.PICKUP")}${m.cost ? ` · ${fmt(m.cost)}` : ""}` : m.type === "FREE_OVER" ? `${fmt(m.cost)} · ${t("s.freeOver")} ${fmt(m.freeOver ?? 0)}` : m.type === "WEIGHT" ? `${fmt(m.cost)} + ${fmt(m.perKg ?? 0)}/kg` : fmt(m.cost);

  return (
    <Shell
      title={t("s.shipping")}
      description={ar ? "يُطبّق أول نطاق يطابق دولة الشحن؛ النطاق بدون دول يغطي بقية العالم." : "The first zone matching the shipping country applies; a zone with no countries covers the rest of the world."}
      dirty={dirty}
      pending={pending}
      onSave={save}
      onDiscard={() => (setList(toZoneForm(zones)), setDirty(false), setErrors({}))}
      actions={
        <Button variant="outline" leftIcon={<Plus />} onClick={() => change([...list, { key: tmp(), name: ar ? "منطقة جديدة" : "New zone", countries: [], isActive: true, methods: [] }])}>
          {t("s.addZone")}
        </Button>
      }
    >
      <SortableList
        items={list}
        getId={(z) => z.key}
        onChange={change}
        className="space-y-4"
        render={(z, handle, zi) => (
          <Panel padded={false}>
            <div className="flex flex-wrap items-center gap-3 border-b border-ad-border px-4 py-3">
              {handle}
              <Truck className="size-4 text-ad-muted" />
              <TextInput value={z.name} onChange={(e) => setZone(z.key, { name: e.target.value })} className="h-9 max-w-xs font-medium" aria-label={t("c.name")} />
              <div className="ms-auto flex items-center gap-2">
                <Switch checked={z.isActive} onCheckedChange={(v) => setZone(z.key, { isActive: v })} label={<span className="text-xs">{t("c.active")}</span>} />
                <Button size="icon-sm" variant="ghost" className="text-red-600" aria-label={t("c.delete")} onClick={() => window.confirm(t("c.confirmDelete")) && change(list.filter((x) => x.key !== z.key))}>
                  <Trash2 />
                </Button>
              </div>
            </div>
            <div className="space-y-4 p-4">
              <div>
                <Label>{t("s.countries")}</Label>
                <TextInput
                  defaultValue={z.countries.join(", ")}
                  onBlur={(e) => setZone(z.key, { countries: [...new Set(e.target.value.split(/[\s,]+/).map((c) => c.trim().toUpperCase()).filter((c) => /^[A-Z]{2}$/.test(c)))] })}
                  placeholder="JO, PS"
                  dir="ltr"
                  className="font-mono"
                />
                {!z.countries.length && <p className="mt-1 text-xs text-ad-muted">{ar ? "بقية العالم" : "Rest of world"}</p>}
              </div>
              <div className="space-y-3">
                {z.methods.map((m, mi) => {
                  const err = (f: string) => errors[`${zi}.methods.${mi}.${f}`];
                  return (
                    <div key={m.key} className={cn("rounded-xl border border-ad-border p-3", !m.isActive && "opacity-60")}>
                      <div className="mb-3 flex flex-wrap items-center gap-2">
                        <span className="text-sm font-medium">{tr(m.name, locale) || "—"}</span>
                        <span className="text-xs text-ad-muted">{summary(m)}</span>
                        <div className="ms-auto flex items-center gap-2">
                          <Switch checked={m.isActive} onCheckedChange={(v) => setMethod(z.key, m.key, { isActive: v })} label={<span className="sr-only">{t("c.active")}</span>} />
                          <Button size="icon-sm" variant="ghost" className="text-red-600" aria-label={t("c.delete")} onClick={() => setZone(z.key, { methods: z.methods.filter((x) => x.key !== m.key) })}>
                            <Trash2 />
                          </Button>
                        </div>
                      </div>
                      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                        <div className="sm:col-span-2">
                          <LocalizedField label={t("c.name")} value={m.name as LocalizedText} onChange={(v) => setMethod(z.key, m.key, { name: v as Record<string, string> })} error={err("name") ? t("c.required") : null} />
                        </div>
                        <div className="sm:col-span-2">
                          <LocalizedField label={t("c.description")} value={m.description as LocalizedText} onChange={(v) => setMethod(z.key, m.key, { description: v as Record<string, string> })} />
                        </div>
                        <div>
                          <Label>{t("cp.type")}</Label>
                          <Select value={m.type} onChange={(e) => setMethod(z.key, m.key, { type: e.target.value as Method["type"] })}>
                            {(["FLAT", "FREE_OVER", "FREE", "WEIGHT", "PICKUP"] as const).map((x) => (
                              <option key={x} value={x}>
                                {t(`s.rate.${x}`)}
                              </option>
                            ))}
                          </Select>
                        </div>
                        {m.type !== "FREE" && (
                          <div>
                            <Label>{m.type === "WEIGHT" ? (ar ? "التكلفة الأساسية" : "Base cost") : t("s.cost")}</Label>
                            <MoneyInput value={m.cost} onChange={(v) => setMethod(z.key, m.key, { cost: v ?? 0 })} decimals={money.base.decimals} symbol={money.display.symbol} />
                          </div>
                        )}
                        {m.type === "FREE_OVER" && (
                          <div>
                            <Label>{t("s.freeOver")}</Label>
                            <MoneyInput value={m.freeOver} onChange={(v) => setMethod(z.key, m.key, { freeOver: v })} decimals={money.base.decimals} symbol={money.display.symbol} invalid={Boolean(err("freeOver"))} />
                          </div>
                        )}
                        {m.type === "WEIGHT" && (
                          <div>
                            <Label>{t("s.perKg")}</Label>
                            <MoneyInput value={m.perKg} onChange={(v) => setMethod(z.key, m.key, { perKg: v })} decimals={money.base.decimals} symbol={money.display.symbol} />
                          </div>
                        )}
                        <div>
                          <Label>{t("s.days")}</Label>
                          <div className="flex items-center gap-2" dir="ltr">
                            <TextInput type="number" min={0} max={90} value={m.minDays ?? ""} onChange={(e) => setMethod(z.key, m.key, { minDays: e.target.value === "" ? null : Number(e.target.value) })} />
                            <span>–</span>
                            <TextInput type="number" min={0} max={90} value={m.maxDays ?? ""} onChange={(e) => setMethod(z.key, m.key, { maxDays: e.target.value === "" ? null : Number(e.target.value) })} invalid={Boolean(err("maxDays"))} />
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
                <Button
                  size="sm"
                  variant="outline"
                  leftIcon={<Plus />}
                  onClick={() => setZone(z.key, { methods: [...z.methods, { key: tmp(), name: { en: "Standard delivery", ar: "توصيل عادي" }, description: {}, type: "FLAT", cost: 0, freeOver: null, perKg: null, minDays: 1, maxDays: 3, isActive: true }] })}
                >
                  {t("s.addMethod")}
                </Button>
              </div>
            </div>
          </Panel>
        )}
      />
    </Shell>
  );
}

// ────────────────────────────── Order statuses ──────────────────────────────

type StatusData = Awaited<ReturnType<typeof orderStatusList>>;
type Status = StatusData["statuses"][number];

export function OrderStatusesView({ data }: { data: StatusData }) {
  const { t, locale } = useAdmin();
  const router = useRouter();
  const ar = locale === "ar";
  const [list, setList] = useState(data.statuses);
  const [dirty, setDirty] = useState(false);
  const [newKey, setNewKey] = useState("");
  const [pending, start] = useTransition();
  const set = (key: string, patch: Partial<Status>) => (setList((l) => l.map((s) => (s.key === key ? { ...s, ...patch } : s))), setDirty(true));
  const save = () =>
    start(async () => {
      const r = await saveOrderStatusesAction(list.map(({ isSystem: _s, orders: _o, ...s }) => s));
      if (r.ok) {
        toast.success(t("c.saved"));
        setDirty(false);
        router.refresh();
      } else toast.error(conflictText(r.error, ar) ?? t("c.fixErrors"));
    });
  const validNew = /^[a-z][a-z0-9_]{1,30}$/.test(newKey) && !list.some((s) => s.key === newKey);
  return (
    <Shell title={t("s.orderStatuses")} description={ar ? "رتّب حالات الطلب وحدد سلوك كل منها." : "Order the workflow and decide what each status does."} dirty={dirty} pending={pending} onSave={save} onDiscard={() => (setList(data.statuses), setDirty(false))}>
      <Panel padded={false}>
        <SortableList
          items={list}
          getId={(s) => s.key}
          onChange={(l) => (setList(l), setDirty(true))}
          className="divide-y divide-ad-border"
          render={(s, handle) => (
            <div className="flex flex-wrap items-start gap-3 px-3 py-3">
              {handle}
              <div className="w-28 shrink-0 pt-1">
                <ColorInput value={s.color} onChange={(v) => set(s.key, { color: v })} />
              </div>
              <div className="min-w-[14rem] flex-1">
                <LocalizedField label={<span className="flex items-center gap-1.5 font-mono text-xs">{s.key}{s.isSystem && <Lock className="size-3 text-ad-muted" aria-label={t("cms.system")} />}{s.orders > 0 && <span className="font-sans text-ad-muted">· {s.orders}</span>}</span>} value={s.label as LocalizedText} onChange={(v) => set(s.key, { label: v as Record<string, string> })} />
              </div>
              <div className="grid min-w-[16rem] flex-1 gap-2 sm:grid-cols-2">
                <Switch checked={s.countsAsSale} disabled={s.isSystem} onCheckedChange={(v) => set(s.key, { countsAsSale: v })} label={<span className="text-xs">{t("s.countsAsSale")}</span>} />
                <Switch checked={s.restocks} disabled={s.isSystem} onCheckedChange={(v) => set(s.key, { restocks: v })} label={<span className="text-xs">{t("s.restocks")}</span>} />
                <Switch checked={s.isFinal} disabled={s.isSystem} onCheckedChange={(v) => set(s.key, { isFinal: v })} label={<span className="text-xs">{t("s.final")}</span>} />
                <Switch checked={s.notifyCustomer} onCheckedChange={(v) => set(s.key, { notifyCustomer: v })} label={<span className="text-xs">{t("s.notifyDefault")}</span>} />
                {s.notifyCustomer && (
                  <Select value={s.emailTemplate ?? ""} onChange={(e) => set(s.key, { emailTemplate: e.target.value || null })} className="sm:col-span-2" aria-label={t("s.templates")}>
                    <option value="">{ar ? "قالب «تحديث حالة الطلب»" : "“Order status update” template"}</option>
                    {data.templates.map((tp) => (
                      <option key={tp.key} value={tp.key}>
                        {tp.key}
                      </option>
                    ))}
                  </Select>
                )}
              </div>
              {!s.isSystem && s.orders === 0 && (
                <Button size="icon-sm" variant="ghost" className="text-red-600" aria-label={t("c.delete")} onClick={() => (setList((l) => l.filter((x) => x.key !== s.key)), setDirty(true))}>
                  <Trash2 />
                </Button>
              )}
            </div>
          )}
        />
        <div className="flex items-end gap-2 border-t border-ad-border p-4">
          <div className="max-w-xs flex-1">
            <Label hint="a-z, 0-9, _">{t("s.addStatus")}</Label>
            <TextInput value={newKey} onChange={(e) => setNewKey(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""))} placeholder="ready_for_pickup" dir="ltr" className="font-mono" />
          </div>
          <Button
            variant="outline"
            leftIcon={<Plus />}
            disabled={!validNew}
            onClick={() => {
              setList((l) => [...l, { key: newKey, label: { en: newKey.replace(/_/g, " "), ar: newKey }, color: "#64748b", isSystem: false, isFinal: false, restocks: false, countsAsSale: true, notifyCustomer: false, emailTemplate: null, orders: 0 }]);
              setNewKey("");
              setDirty(true);
            }}
          >
            {t("c.add")}
          </Button>
        </div>
      </Panel>
    </Shell>
  );
}

// ───────────────────────────── Email templates ──────────────────────────────

type Template = Awaited<ReturnType<typeof templateList>>[number];

export function TemplatesView({ templates }: { templates: Template[] }) {
  const { t, locale } = useAdmin();
  const router = useRouter();
  const ar = locale === "ar";
  const [key, setKey] = useState(templates[0]?.key ?? "");
  const current = templates.find((x) => x.key === key)!;
  const [form, setForm] = useState({ subject: current.subject, body: current.body, isEnabled: current.isEnabled });
  const [lang, setLang] = useState<"ar" | "en">(locale);
  const [dirty, setDirty] = useState(false);
  const [preview, setPreview] = useState<{ subject: string; html: string } | null>(null);
  const [pending, start] = useTransition();
  const bodyRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const tp = templates.find((x) => x.key === key);
    if (tp) setForm({ subject: tp.subject, body: tp.body, isEnabled: tp.isEnabled });
    setDirty(false);
    setPreview(null);
  }, [key, templates]);

  const refreshPreview = () =>
    start(async () => {
      const r = await previewTemplateAction(key, lang, { subject: form.subject[lang] ?? "", body: form.body[lang] ?? "" });
      if (r.ok) setPreview(r.data);
    });

  const insertVar = (v: string) => {
    const el = bodyRef.current;
    const token = `{{${v}}}`;
    const cur = form.body[lang] ?? "";
    const at = el?.selectionStart ?? cur.length;
    setForm({ ...form, body: { ...form.body, [lang]: cur.slice(0, at) + token + cur.slice(el?.selectionEnd ?? at) } });
    setDirty(true);
  };

  const groups = useMemo(() => ({ customer: templates.filter((x) => x.audience === "customer"), staff: templates.filter((x) => x.audience === "staff") }), [templates]);

  return (
    <Shell
      title={t("s.templates")}
      description={ar ? "المتغيرات بين {{ }} تُستبدل تلقائياً. HTML آمن فقط." : "Variables in {{ }} are filled in automatically. Safe HTML only."}
      dirty={dirty}
      pending={pending}
      onDiscard={() => (setForm({ subject: current.subject, body: current.body, isEnabled: current.isEnabled }), setDirty(false))}
      onSave={() =>
        start(async () => {
          const r = await saveTemplateAction(key, form);
          if (r.ok) {
            toast.success(t("c.saved"));
            setDirty(false);
            router.refresh();
          } else toast.error(t("c.fixErrors"));
        })
      }
    >
      <div className="grid gap-4 lg:grid-cols-[minmax(0,240px)_minmax(0,1fr)]">
        <Panel padded={false}>
          {(["customer", "staff"] as const).map((g) =>
            groups[g].length ? (
              <div key={g}>
                <p className="px-4 pb-1 pt-3 text-xs font-medium uppercase tracking-wide text-ad-muted">{g === "customer" ? (ar ? "للعملاء" : "Customers") : ar ? "للفريق" : "Staff"}</p>
                <ul className="p-1.5">
                  {groups[g].map((tp) => (
                    <li key={tp.key}>
                      <button
                        type="button"
                        onClick={() => (dirty && !window.confirm(t("c.unsaved")) ? null : setKey(tp.key))}
                        className={cn("flex w-full items-center gap-2 rounded-lg px-3 py-2 text-start text-[13px] transition", key === tp.key ? "bg-ad-accent/10 font-medium text-ad-accent" : "hover:bg-ad-hover")}
                      >
                        <span className="truncate font-mono">{tp.key}</span>
                        {tp.customized && <Star className="ms-auto size-3 shrink-0 fill-current text-amber-500" aria-label="customised" />}
                        {!tp.isEnabled && <Pill className="ms-auto">{t("c.inactive")}</Pill>}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null,
          )}
        </Panel>
        <div className="min-w-0 space-y-4">
          <Panel
            title={<span className="font-mono">{key}</span>}
            actions={
              <div className="flex items-center gap-2">
                <Segmented size="sm" value={lang} onChange={(v) => (setLang(v), setPreview(null))} options={[{ value: "ar", label: "AR" }, { value: "en", label: "EN" }]} />
                <Button
                  size="sm"
                  variant="ghost"
                  leftIcon={<RotateCcw />}
                  onClick={() =>
                    window.confirm(t("s.resetDefaults") + "?") &&
                    start(async () => {
                      const r = await resetTemplateAction(key);
                      if (r.ok) {
                        toast.success(t("c.saved"));
                        router.refresh();
                      }
                    })
                  }
                >
                  <span className="max-sm:hidden">{t("s.resetDefaults")}</span>
                </Button>
              </div>
            }
          >
            <div className="space-y-4">
              <Switch checked={form.isEnabled} onCheckedChange={(v) => (setForm({ ...form, isEnabled: v }), setDirty(true))} label={t("c.active")} description={ar ? "رموز التحقق واستعادة كلمة المرور تُرسل دائماً" : "Verification codes and password resets always send"} />
              <div>
                <Label>{t("s.subject")}</Label>
                <TextInput dir={lang === "ar" ? "rtl" : "ltr"} value={form.subject[lang] ?? ""} onChange={(e) => (setForm({ ...form, subject: { ...form.subject, [lang]: e.target.value } }), setDirty(true))} />
              </div>
              <div>
                <Label>HTML</Label>
                <TextArea ref={bodyRef} rows={12} dir={lang === "ar" ? "rtl" : "ltr"} className="font-mono text-xs leading-relaxed" value={form.body[lang] ?? ""} onChange={(e) => (setForm({ ...form, body: { ...form.body, [lang]: e.target.value } }), setDirty(true))} />
                <FieldError message={!(form.body[lang] ?? "").trim() ? t("c.required") : null} />
              </div>
              <div>
                <p className="mb-1.5 text-xs font-medium text-ad-muted">{t("s.templateVars")}</p>
                <div className="flex flex-wrap gap-1.5">
                  {current.variables.map((v) => (
                    <button key={v} type="button" onClick={() => insertVar(v)} className="rounded-md border border-ad-border bg-ad-sunken px-2 py-0.5 font-mono text-[11px] transition hover:border-ad-accent" dir="ltr">
                      {`{{${v}}}`}
                    </button>
                  ))}
                </div>
              </div>
              <Button variant="outline" size="sm" leftIcon={<Eye />} loading={pending} onClick={refreshPreview}>
                {t("s.preview")}
              </Button>
            </div>
          </Panel>
          {preview && (
            <Panel title={preview.subject} padded={false}>
              <iframe title={t("s.preview")} sandbox="" srcDoc={preview.html} className="h-[560px] w-full rounded-b-2xl bg-white" />
            </Panel>
          )}
        </div>
      </div>
    </Shell>
  );
}

"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { Plus, TicketPercent, Copy, Trash2, Sparkles, Zap } from "lucide-react";
import { toast } from "sonner";
import { useRouter, usePathname } from "@/i18n/navigation";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { useAdmin } from "../admin-context";
import { PageHeader, Panel, DataTable, Pill, Switch, AdminEmpty, ConfirmDialog, FilterTabs } from "../ui";
import { Label, TextInput, TextArea, Select, LocalizedField, MoneyInput, FieldError } from "../fields";
import { EditSheet, SectionTitle } from "../entity";
import { ProductPicker, type PickedProduct } from "../product-picker";
import { saveCouponAction, deleteCouponAction, bulkCouponsAction } from "@/actions/admin/operations";
import { BulkActions } from "../bulk-actions";
import { fmtDate } from "@/lib/time";
import type { couponList } from "@/server/admin/operations";

type Data = Awaited<ReturnType<typeof couponList>>;
type Row = Data["rows"][number];
type Form = Omit<Row, "id" | "label" | "usedCount" | "state">;

const toLocalInput = (iso: string | null) => (iso ? new Date(new Date(iso).getTime() - new Date().getTimezoneOffset() * 60_000).toISOString().slice(0, 16) : "");
const fromLocalInput = (v: string) => (v ? new Date(v).toISOString() : null);

const blank = (): Form => ({
  code: "",
  name: {},
  description: {},
  type: "PERCENT",
  value: 1000,
  maxDiscount: null,
  minSubtotal: null,
  scope: "ALL",
  targetIds: [],
  excludeSaleItems: false,
  firstOrderOnly: false,
  allowedEmails: [],
  usageLimit: null,
  usageLimitPerCustomer: null,
  startsAt: null,
  endsAt: null,
  isActive: true,
  isAutomatic: false,
});

const STATE_TONE = { active: "green", scheduled: "blue", expired: "neutral", exhausted: "amber", inactive: "neutral" } as const;

function randomCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = crypto.getRandomValues(new Uint8Array(8));
  return Array.from(bytes, (b) => chars[b % chars.length]).join("");
}

export function CouponsView({ data }: { data: Data }) {
  const { t, fmt, locale, money } = useAdmin();
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const [editing, setEditing] = useState<{ id: string | null; form: Form } | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [confirm, setConfirm] = useState<Row | null>(null);
  const [pending, start] = useTransition();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const filter = sp.get("state") ?? "";
  const [picked, setPicked] = useState<PickedProduct[]>([]);

  const stateLabel = (s: Row["state"]) =>
    s === "expired" ? t("cp.expired") : s === "scheduled" ? t("cp.scheduled") : s === "inactive" ? t("c.inactive") : s === "exhausted" ? (locale === "ar" ? "مستنفد" : "Used up") : t("c.active");

  const open = (row: Row | null) => {
    setErrors({});
    if (row) {
      const { id, label: _l, usedCount: _u, state: _s, ...form } = row;
      setEditing({ id, form: { ...form, code: form.code ?? "" } });
      setPicked(form.scope === "PRODUCTS" ? data.products.filter((p) => form.targetIds.includes(p.id)) : []);
    } else {
      setEditing({ id: null, form: blank() });
      setPicked([]);
    }
  };

  // Support deep links: ?new=1 and ?edit=<id>
  useEffect(() => {
    const id = sp.get("edit");
    if (sp.get("new")) open(null);
    else if (id) {
      const row = data.rows.find((r) => r.id === id);
      if (row) open(row);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const close = () => {
    setEditing(null);
    if (sp.get("new") || sp.get("edit")) router.replace(pathname);
  };

  const rows = useMemo(() => (filter ? data.rows.filter((r) => r.state === filter) : data.rows), [data.rows, filter]);
  const counts = useMemo(() => data.rows.reduce<Record<string, number>>((a, r) => ((a[r.state] = (a[r.state] ?? 0) + 1), a), {}), [data.rows]);

  const f = editing?.form;
  const set = <K extends keyof Form>(k: K, v: Form[K]) => setEditing((e) => (e ? { ...e, form: { ...e.form, [k]: v } } : e));

  const save = () =>
    editing &&
    start(async () => {
      const form = editing.form;
      const payload = { ...form, code: form.isAutomatic ? null : form.code || null, targetIds: form.scope === "PRODUCTS" ? picked.map((p) => p.id) : form.scope === "ALL" ? [] : form.targetIds };
      const r = await saveCouponAction(editing.id, payload);
      if (r.ok) {
        toast.success(t("c.saved"));
        close();
        router.refresh();
      } else {
        setErrors(Object.fromEntries(Object.entries(r.fieldErrors ?? {}).map(([k, v]) => [k, v[0] ?? ""])));
        toast.error(t("c.fixErrors"));
      }
    });

  const valueText = (r: Row) => (r.type === "PERCENT" ? `${r.value / 100}%` : r.type === "FIXED" ? fmt(r.value) : t("cp.type.FREE_SHIPPING"));
  const errText = (k: string) => (errors[k] ? (errors[k] === "code_taken" ? (locale === "ar" ? "هذا الرمز مستخدم" : "This code is already in use") : errors[k] === "end_before_start" ? (locale === "ar" ? "يجب أن ينتهي بعد البدء" : "Must end after it starts") : t("c.required")) : null);

  const targetOptions = f?.scope === "CATEGORIES" ? data.categories : f?.scope === "BRANDS" ? data.brands : [];

  return (
    <>
      <PageHeader
        title={t("cp.title")}
        description={locale === "ar" ? "رموز خصم وعروض تلقائية تُطبّق في السلة والدفع" : "Discount codes and automatic promotions applied in cart and checkout"}
        actions={
          <Button leftIcon={<Plus />} onClick={() => open(null)}>
            {t("cp.new")}
          </Button>
        }
      />
      <div className="mb-4">
        <FilterTabs
          param="state"
          options={[
            { value: "", label: t("c.all"), count: data.rows.length },
            ...(["active", "scheduled", "expired", "inactive"] as const).map((s) => ({ value: s, label: stateLabel(s), count: counts[s] ?? 0 })),
          ]}
        />
      </div>
      <Panel padded={false}>
        <DataTable
          rows={rows}
          onRowClick={(r) => open(r)}
          selectable
          selected={selected}
          onSelectedChange={setSelected}
          empty={
            <AdminEmpty
              icon={<TicketPercent />}
              action={
                <Button size="sm" leftIcon={<Plus />} onClick={() => open(null)}>
                  {t("cp.new")}
                </Button>
              }
            />
          }
          columns={[
            {
              key: "c",
              header: t("cp.code"),
              cell: (r) => (
                <div className="min-w-0">
                  <p className="flex items-center gap-2 font-mono text-[13px] font-semibold tracking-wide">
                    {r.isAutomatic ? (
                      <span className="flex items-center gap-1 font-sans text-violet-600">
                        <Zap className="size-3.5" /> {locale === "ar" ? "تلقائي" : "Automatic"}
                      </span>
                    ) : (
                      r.code
                    )}
                  </p>
                  <p className="truncate text-xs text-ad-muted">{r.label}</p>
                </div>
              ),
            },
            { key: "v", header: t("cp.value"), cell: (r) => <span className="font-medium">{valueText(r)}</span> },
            { key: "s", header: t("cp.scope"), cell: (r) => <span className="text-ad-muted">{t(`cp.scope.${r.scope}`)}</span> },
            { key: "u", header: locale === "ar" ? "الاستخدام" : "Usage", cell: (r) => <span className="tabular text-ad-muted">{r.usedCount}{r.usageLimit ? ` / ${r.usageLimit}` : ""}</span> },
            { key: "d", header: t("cp.ends"), cell: (r) => <span className="text-ad-muted">{r.endsAt ? fmtDate(r.endsAt, locale) : "—"}</span> },
            { key: "st", header: t("c.status"), cell: (r) => <Pill tone={STATE_TONE[r.state as keyof typeof STATE_TONE]}>{stateLabel(r.state)}</Pill> },
          ]}
          mobile={(r) => (
            <div className="flex items-center gap-3">
              <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-ad-sunken text-ad-muted">{r.isAutomatic ? <Zap className="size-4" /> : <TicketPercent className="size-4" />}</span>
              <div className="min-w-0 flex-1">
                <p className="truncate font-mono text-[13px] font-semibold">{r.code ?? r.label}</p>
                <p className="truncate text-xs text-ad-muted">
                  {valueText(r)} · {t("cp.used", { n: r.usedCount })}
                </p>
              </div>
              <Pill tone={STATE_TONE[r.state as keyof typeof STATE_TONE]}>{stateLabel(r.state)}</Pill>
            </div>
          )}
        />
      </Panel>

      <BulkActions
        selected={selected}
        onClear={() => setSelected(new Set())}
        ops={[
          { key: "activate", label: locale === "ar" ? "تفعيل" : "Activate" },
          { key: "deactivate", label: locale === "ar" ? "إيقاف" : "Deactivate" },
          { key: "delete", label: locale === "ar" ? "حذف" : "Delete", danger: true },
        ]}
        run={bulkCouponsAction as (ids: string[], op: string) => ReturnType<typeof bulkCouponsAction>}
        noun={locale === "ar" ? { one: "كوبون", many: "كوبونات" } : { one: "coupon", many: "coupons" }}
      />
      <EditSheet
        open={Boolean(editing)}
        onOpenChange={(o) => !o && close()}
        title={editing?.id ? (f?.code || t("c.edit")) : t("cp.new")}
        onSave={save}
        saving={pending}
        wide
        footerExtra={
          editing?.id && (
            <Button variant="ghost" className="text-red-600" leftIcon={<Trash2 />} onClick={() => setConfirm(data.rows.find((r) => r.id === editing.id) ?? null)}>
              {t("c.delete")}
            </Button>
          )
        }
      >
        {f && (
          <div className="space-y-5">
            <Switch checked={f.isAutomatic} onCheckedChange={(v) => set("isAutomatic", v)} label={t("cp.automatic")} description={locale === "ar" ? "يُطبّق تلقائياً على السلال المؤهلة" : "Applied automatically to eligible carts"} />
            {!f.isAutomatic && (
              <div>
                <Label>{t("cp.code")}</Label>
                <div className="flex gap-2">
                  <TextInput value={f.code ?? ""} onChange={(e) => set("code", e.target.value.toUpperCase().replace(/[^A-Z0-9_-]/g, ""))} className="font-mono tracking-wider" invalid={Boolean(errors.code)} maxLength={40} />
                  <Button variant="outline" leftIcon={<Sparkles />} onClick={() => set("code", randomCode())}>
                    {t("cp.generate")}
                  </Button>
                  {f.code && (
                    <Button variant="ghost" aria-label="Copy" onClick={() => navigator.clipboard.writeText(f.code ?? "").then(() => toast.success(t("c.copied")))}>
                      <Copy className="size-4" />
                    </Button>
                  )}
                </div>
                <FieldError message={errText("code")} />
              </div>
            )}
            <LocalizedField label={t("c.name")} value={f.name} onChange={(v) => set("name", v)} hint={locale === "ar" ? "يظهر للعميل في السلة" : "Shown to the shopper in the cart"} />
            <LocalizedField label={t("c.description")} value={f.description} onChange={(v) => set("description", v)} multiline rows={2} />

            <SectionTitle>{t("cp.type")}</SectionTitle>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label>{t("cp.type")}</Label>
                <Select value={f.type} onChange={(e) => set("type", e.target.value as Form["type"])}>
                  {(["PERCENT", "FIXED", "FREE_SHIPPING"] as const).map((x) => (
                    <option key={x} value={x}>
                      {t(`cp.type.${x}`)}
                    </option>
                  ))}
                </Select>
              </div>
              {f.type === "PERCENT" && (
                <div>
                  <Label>{t("cp.value")} (%)</Label>
                  <TextInput type="number" min={0.01} max={100} step={0.01} value={f.value / 100} onChange={(e) => set("value", Math.round(Number(e.target.value) * 100))} invalid={Boolean(errors.value)} />
                  <FieldError message={errText("value")} />
                </div>
              )}
              {f.type === "FIXED" && (
                <div>
                  <Label>{t("cp.value")}</Label>
                  <MoneyInput value={f.value} onChange={(v) => set("value", v ?? 0)} decimals={money.base.decimals} symbol={money.display.symbol} invalid={Boolean(errors.value)} />
                  <FieldError message={errText("value")} />
                </div>
              )}
              {f.type === "PERCENT" && (
                <div>
                  <Label optional>{t("cp.maxDiscount")}</Label>
                  <MoneyInput value={f.maxDiscount} onChange={(v) => set("maxDiscount", v)} decimals={money.base.decimals} symbol={money.display.symbol} />
                </div>
              )}
              <div>
                <Label optional>{t("cp.minSubtotal")}</Label>
                <MoneyInput value={f.minSubtotal} onChange={(v) => set("minSubtotal", v)} decimals={money.base.decimals} symbol={money.display.symbol} />
              </div>
            </div>

            <SectionTitle>{t("cp.scope")}</SectionTitle>
            <Select value={f.scope} onChange={(e) => (set("scope", e.target.value as Form["scope"]), set("targetIds", []))}>
              {(["ALL", "PRODUCTS", "CATEGORIES", "BRANDS"] as const).map((x) => (
                <option key={x} value={x}>
                  {t(`cp.scope.${x}`)}
                </option>
              ))}
            </Select>
            {f.scope === "PRODUCTS" && <ProductPicker value={picked} onChange={setPicked} max={200} />}
            {(f.scope === "CATEGORIES" || f.scope === "BRANDS") && (
              <div className="max-h-56 space-y-1 overflow-y-auto rounded-lg border border-ad-border p-2">
                {targetOptions.map((o) => (
                  <label key={o.id} className="flex cursor-pointer items-center gap-2 rounded px-2 py-1 text-sm hover:bg-ad-hover">
                    <input
                      type="checkbox"
                      className="accent-[var(--ad-accent)]"
                      checked={f.targetIds.includes(o.id)}
                      onChange={(e) => set("targetIds", e.target.checked ? [...f.targetIds, o.id] : f.targetIds.filter((x) => x !== o.id))}
                    />
                    {o.name}
                  </label>
                ))}
              </div>
            )}
            <FieldError message={errText("targetIds")} />
            <Switch checked={f.excludeSaleItems} onCheckedChange={(v) => set("excludeSaleItems", v)} label={t("cp.excludeSale")} />

            <SectionTitle>{locale === "ar" ? "القيود" : "Restrictions"}</SectionTitle>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label optional>{t("cp.usageLimit")}</Label>
                <TextInput type="number" min={1} value={f.usageLimit ?? ""} onChange={(e) => set("usageLimit", e.target.value ? Number(e.target.value) : null)} />
              </div>
              <div>
                <Label optional>{t("cp.perCustomer")}</Label>
                <TextInput type="number" min={1} value={f.usageLimitPerCustomer ?? ""} onChange={(e) => set("usageLimitPerCustomer", e.target.value ? Number(e.target.value) : null)} />
              </div>
              <div>
                <Label optional>{t("cp.starts")}</Label>
                <TextInput type="datetime-local" value={toLocalInput(f.startsAt)} onChange={(e) => set("startsAt", fromLocalInput(e.target.value))} />
              </div>
              <div>
                <Label optional>{t("cp.ends")}</Label>
                <TextInput type="datetime-local" value={toLocalInput(f.endsAt)} onChange={(e) => set("endsAt", fromLocalInput(e.target.value))} invalid={Boolean(errors.endsAt)} />
                <FieldError message={errText("endsAt")} />
              </div>
            </div>
            <Switch checked={f.firstOrderOnly} onCheckedChange={(v) => set("firstOrderOnly", v)} label={t("cp.firstOrder")} />
            <div>
              <Label optional>{t("cp.emails")}</Label>
              <TextArea
                rows={3}
                dir="ltr"
                defaultValue={f.allowedEmails.join("\n")}
                onBlur={(e) => set("allowedEmails", e.target.value.split(/[\s,;]+/).map((x) => x.trim().toLowerCase()).filter(Boolean))}
              />
              <FieldError message={errors.allowedEmails ? (locale === "ar" ? "بريد غير صالح" : "Invalid email address") : null} />
            </div>
            <Switch checked={f.isActive} onCheckedChange={(v) => set("isActive", v)} label={t("c.active")} />
          </div>
        )}
      </EditSheet>

      <ConfirmDialog
        open={Boolean(confirm)}
        onOpenChange={(o) => !o && setConfirm(null)}
        title={t("c.confirmDelete")}
        text={confirm?.code ?? confirm?.label}
        confirmLabel={t("c.delete")}
        onConfirm={async () => {
          if (!confirm) return;
          const r = await deleteCouponAction(confirm.id);
          if (r.ok) {
            toast.success(t("c.deleted"));
            setConfirm(null);
            close();
            router.refresh();
          }
        }}
      />
    </>
  );
}

"use client";

import { useMemo, useState, useTransition } from "react";
import { AlertTriangle, CheckCircle2, Globe2, Lock, MapPin, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/overlay";
import { Combobox } from "@/components/ui/combobox";
import { CountryFlag } from "@/components/store/geo-select";
import { useAdmin } from "../admin-context";
import { PageHeader, Panel, Pill, Switch } from "../ui";
import { Label } from "../fields";
import { applyCountryChangeAction, planCountryChangeAction, setDetectionAction } from "@/actions/admin/settings";
import { t as tr } from "@/lib/i18n-text";
import type { countryPage, planCountryChange } from "@/server/admin/country";

type Data = Awaited<ReturnType<typeof countryPage>>;
type Plan = Awaited<ReturnType<typeof planCountryChange>>;

/**
 * Primary store country (super-admin): the store's business defaults —
 * currency, phone country, tax, timezone, address rules, payment badges and
 * governorates. Visitors' own country only shapes their session defaults.
 */
export function CountryView({ data }: { data: Data }) {
  const { t, locale } = useAdmin();
  const ar = locale === "ar";
  const router = useRouter();
  const [target, setTarget] = useState(data.primary);
  const [plan, setPlan] = useState<Plan | null>(null);
  const [chosen, setChosen] = useState<Set<string>>(new Set());
  const [pending, start] = useTransition();
  const [detect, setDetect] = useState(data.detectFromHeaders);
  const current = data.countries.find((c) => c.code === data.primary);
  const options = useMemo(() => data.countries.map((c) => ({ value: c.code, label: c.name, hint: `${c.currency} · ${c.dialCode}`, icon: <CountryFlag code={c.code} />, keywords: `${c.code} ${c.currency} ${c.dialCode}` })), [data.countries]);

  const review = () =>
    start(async () => {
      const r = await planCountryChangeAction(target);
      if (!r.ok) return void toast.error(t("c.error"));
      setPlan(r.data);
      setChosen(new Set(r.data.changes.filter((c) => c.recommended).map((c) => c.key)));
    });
  const apply = () =>
    plan &&
    start(async () => {
      const r = await applyCountryChangeAction({ code: plan.code, apply: [...chosen] });
      if (!r.ok) return void toast.error(t("c.error"));
      toast.success(t("c.saved"));
      setPlan(null);
      router.refresh();
    });

  return (
    <>
      <PageHeader
        back={{ href: "/admin/settings", label: t("s.title") }}
        title={t("s.country")}
        description={ar ? "تحدد الإعدادات الافتراضية للمتجر: العملة ورمز الهاتف والضريبة والمنطقة الزمنية وحقول العنوان والمحافظات." : "Sets the store's defaults: currency, phone code, tax, timezone, address fields and governorates."}
        actions={
          <Pill tone="violet" className="gap-1">
            <Lock className="size-3" /> {ar ? "مدير النظام فقط" : "Super admin only"}
          </Pill>
        }
      />
      <div className="grid gap-4 xl:grid-cols-[1.4fr_1fr]">
        <Panel title={ar ? "الدولة الأساسية" : "Primary country"}>
          {current && (
            <div className="mb-5 flex flex-wrap items-center gap-4 rounded-xl border border-ad-border bg-ad-sunken/50 p-4">
              <CountryFlag code={current.code} className="h-8 w-11" />
              <div className="min-w-0 flex-1">
                <p className="text-lg font-semibold">{current.name}</p>
                <p className="text-sm text-ad-muted">
                  {current.currency} · {current.dialCode} · {current.timezone} · {current.taxRateBp ? `${ar ? "ضريبة" : "tax"} ${current.taxRateBp / 100}%` : ar ? "بدون ضريبة" : "no tax"} · {ar ? `${current.cities} مدينة` : `${current.cities} cities`}
                </p>
              </div>
              <Pill tone="green" className="gap-1">
                <CheckCircle2 className="size-3" /> {ar ? "الحالية" : "Current"}
              </Pill>
            </div>
          )}
          <Label>{ar ? "تغيير الدولة الأساسية" : "Change the primary country"}</Label>
          <div className="flex flex-wrap gap-2">
            <div className="min-w-[16rem] flex-1">
              <Combobox label={ar ? "الدولة" : "Country"} options={options} value={target} onChange={setTarget} searchable className="h-10 rounded-lg text-sm" />
            </div>
            <Button disabled={target === data.primary} loading={pending && !plan} onClick={review}>
              {ar ? "مراجعة التغيير" : "Review change"}
            </Button>
          </div>
          <p className="mt-3 text-xs text-ad-muted">{ar ? `العملة الأساسية لأسعار المنتجات: ${data.baseCurrency} — لا تتغير تلقائياً.` : `Base currency of product prices: ${data.baseCurrency} — never changed automatically.`}</p>
        </Panel>

        <Panel title={ar ? "دولة الزائر" : "Visitor country"} description={ar ? "منفصلة عن الدولة الأساسية." : "Kept separate from the primary country."}>
          <Switch
            checked={detect}
            onCheckedChange={(v) =>
              start(async () => {
                const r = await setDetectionAction(v);
                if (r.ok) setDetect(v);
                else toast.error(t("c.error"));
              })
            }
            label={ar ? "تحديد دولة الزائر من ترويسات CDN" : "Detect the visitor's country from CDN headers"}
            description={ar ? "بدون GPS أو خدمات خارجية." : "No GPS, no third-party lookups."}
          />
          <ul className="mt-4 space-y-2 text-[13px] text-ad-muted">
            <li className="flex gap-2"><Globe2 className="mt-0.5 size-4 shrink-0" />{ar ? "عند التعرف على دولة الزائر تُقترح عملتها ورمز هاتفها له فقط." : "When detected, the visitor gets their country's currency and phone code — for them only."}</li>
            <li className="flex gap-2"><MapPin className="mt-0.5 size-4 shrink-0" />{ar ? "إن تعذّر التحديد تُستخدم الدولة الأساسية." : "If detection fails, the primary country is used."}</li>
            <li className="flex gap-2"><ShieldCheck className="mt-0.5 size-4 shrink-0" />{ar ? "اختيارات العميل اليدوية تُحفظ ولا تُستبدل، والتحديد لا يغيّر إعدادات المتجر أبداً." : "A shopper's manual choices are kept, and detection never changes store settings."}</li>
          </ul>
        </Panel>
      </div>

      <Modal open={Boolean(plan)} onOpenChange={(o) => !o && !pending && setPlan(null)} title={plan ? (ar ? `تغيير الدولة الأساسية إلى ${tr(plan.profile.name, locale)}؟` : `Change the primary country to ${tr(plan.profile.name, locale)}?`) : ""}>
        {plan && (
          <div className="space-y-4 text-sm">
            <p className="text-ad-muted">{ar ? `الإعدادات الجديدة: ${plan.profile.currency} · ${plan.profile.dialCode} · ${plan.profile.timezone}` : `New defaults: ${plan.profile.currency} · ${plan.profile.dialCode} · ${plan.profile.timezone}`}</p>
            {plan.changes.length > 0 && (
              <div>
                <p className="mb-2 font-medium">{ar ? "الإعدادات التي ستتغير (يمكنك استثناء أي منها)" : "Settings that will change (untick to keep)"}</p>
                <ul className="space-y-1.5">
                  {plan.changes.map((c) => (
                    <li key={c.key}>
                      <label className="flex cursor-pointer items-start gap-2.5 rounded-lg border border-ad-border p-2.5">
                        <input type="checkbox" className="mt-0.5 size-4 accent-[var(--ad-accent)]" checked={chosen.has(c.key)} onChange={(e) => setChosen((s) => (e.target.checked ? new Set(s.add(c.key)) : (s.delete(c.key), new Set(s))))} />
                        <span className="min-w-0 flex-1">
                          <span className="block font-medium">{tr(c.label, locale)}</span>
                          <span className="block truncate text-xs text-ad-muted" dir="ltr">{c.from || "—"} → {c.to}</span>
                        </span>
                      </label>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {plan.attention.length > 0 && (
              <ul className="space-y-1.5 rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-[13px]">
                {plan.attention.map((a, i) => (
                  <li key={i} className="flex gap-2">
                    <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-600" />
                    {tr(a, locale)}
                  </li>
                ))}
              </ul>
            )}
            <div>
              <p className="mb-1.5 font-medium">{ar ? "لن يتغير" : "Stays exactly as it is"}</p>
              <ul className="grid gap-1 text-[13px] text-ad-muted sm:grid-cols-2">
                {plan.preserved.map((p, i) => (
                  <li key={i} className="flex gap-1.5">
                    <ShieldCheck className="mt-0.5 size-3.5 shrink-0 text-emerald-600" />
                    {tr(p, locale)}
                  </li>
                ))}
              </ul>
            </div>
            <div className="flex gap-2">
              <Button className="flex-1" loading={pending} onClick={apply}>
                {ar ? "تأكيد التغيير" : "Confirm change"}
              </Button>
              <Button variant="ghost" disabled={pending} onClick={() => setPlan(null)}>
                {t("c.cancel")}
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}

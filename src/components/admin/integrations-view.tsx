"use client";

import { useMemo, useState, useTransition } from "react";
import { CheckCircle2, Copy, ExternalLink, Lock, PlugZap, RefreshCw, XCircle } from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "@/i18n/navigation";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { SocialIcon, SOCIAL_PLATFORMS } from "@/components/ui/social-icon";
import { useAdmin } from "./admin-context";
import { PageHeader, Pill, Segmented, Switch, FilterTabs } from "./ui";
import { Label, TextInput, TextArea, Select } from "./fields";
import { EditSheet } from "./entity";
import { IconPreview } from "./icon-picker";
import { saveIntegrationAction, testIntegrationAction, syncIntegrationAction } from "@/actions/admin/integrations";
import { t as tr } from "@/lib/i18n-text";
import { timeAgo } from "@/lib/time";
import { cn } from "@/lib/utils";
import type { IntegrationListItem } from "@/server/integrations/service";

const CATEGORIES = ["payments", "analytics", "search", "marketing", "messaging", "shipping", "email"] as const;
const STATUS_TONE = { CONNECTED: "green", ERROR: "red", NOT_CONFIGURED: "neutral", DISABLED: "neutral" } as const;

type Form = { isEnabled: boolean; mode: "test" | "live"; config: Record<string, string | number | boolean>; secrets: Record<string, string>; clearSecrets: string[] };

function BrandIcon({ icon, className }: { icon: string; className?: string }) {
  if (icon.startsWith("lucide:")) return <IconPreview value={icon} className={className} />;
  return SOCIAL_PLATFORMS[icon] ? <SocialIcon platform={icon} className={className} /> : <PlugZap className={className} />;
}

export function IntegrationsView({ items, appUrl }: { items: IntegrationListItem[]; appUrl: string }) {
  const { t, locale, can } = useAdmin();
  const router = useRouter();
  const category = useSearchParams().get("category") ?? "";
  const [open, setOpen] = useState<IntegrationListItem | null>(null);
  const [form, setForm] = useState<Form | null>(null);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [pending, start] = useTransition();

  const visible = useMemo(() => items.filter((i) => !category || i.category === category).sort((a, b) => Number(b.availability === "available") - Number(a.availability === "available") || Number(b.isEnabled) - Number(a.isEnabled)), [items, category]);
  const counts = useMemo(() => Object.fromEntries(CATEGORIES.map((c) => [c, items.filter((i) => i.category === c && i.availability === "available").length])), [items]);
  const allowed = (i: IntegrationListItem) => can(i.category === "payments" ? "settings.payments" : "settings.integrations");

  const configure = (i: IntegrationListItem) => {
    setOpen(i);
    setResult(i.lastError ? { ok: false, message: i.lastError } : null);
    setForm({
      isEnabled: i.isEnabled,
      mode: i.mode === "live" ? "live" : "test",
      config: Object.fromEntries(i.fields.filter((f) => !f.type.startsWith("secret")).map((f) => [f.key, (i.config[f.key] as string | number | boolean | undefined) ?? (f.type === "boolean" ? false : "")])),
      secrets: {},
      clearSecrets: [],
    });
  };

  const save = (thenTest = false) =>
    open &&
    form &&
    start(async () => {
      const r = await saveIntegrationAction(open.key, form);
      if (!r.ok) return void toast.error(t("c.error"));
      if (r.data.lastError) setResult({ ok: false, message: r.data.lastError });
      else toast.success(t("c.saved"));
      if (thenTest && !r.data.lastError) {
        const tr2 = await testIntegrationAction(open.key);
        if (tr2.ok) setResult(tr2.data);
      }
      setForm((f) => (f ? { ...f, secrets: {}, clearSecrets: [] } : f));
      router.refresh();
    });

  const fieldsForMode = open?.fields.filter((f) => !f.mode || !open.supportsModes || f.mode === form?.mode) ?? [];
  const webhook = open?.category === "payments" && ["stripe", "paypal"].includes(open.key) ? `${appUrl}/api/payments/${open.key}/webhook` : null;

  return (
    <>
      <PageHeader title={t("int.title")} description={t("int.subtitle")} />
      <div className="mb-4">
        <FilterTabs param="category" options={[{ value: "", label: t("c.all") }, ...CATEGORIES.filter((c) => items.some((i) => i.category === c)).map((c) => ({ value: c, label: t(`int.cat.${c}`), count: counts[c] }))]} />
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {visible.map((i) => {
          const planned = i.availability !== "available";
          return (
            <article key={i.key} className={cn("flex flex-col rounded-2xl border border-ad-border bg-ad-panel p-4 transition", planned ? "opacity-70" : "hover:border-ad-fg/20 hover:shadow-sm")}>
              <div className="flex items-start gap-3">
                <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-ad-sunken">
                  <BrandIcon icon={i.icon} className="size-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <h3 className="flex items-center gap-2 font-semibold">
                    {i.name}
                    {i.supportsModes && i.isEnabled && <Pill tone={i.mode === "live" ? "violet" : "amber"}>{t(i.mode === "live" ? "int.live" : "int.test")}</Pill>}
                  </h3>
                  <p className="text-xs text-ad-muted">{t(`int.cat.${i.category}` as "int.cat.payments")}</p>
                </div>
                {planned ? <Pill>{t("int.comingSoon")}</Pill> : <Pill tone={STATUS_TONE[i.status as keyof typeof STATUS_TONE]}>{t(`int.status.${i.status}` as "int.status.CONNECTED")}</Pill>}
              </div>
              <p className="mt-3 line-clamp-3 flex-1 text-[13px] leading-relaxed text-ad-muted">{planned ? t("int.comingSoonText") : tr(i.description, locale)}</p>
              <div className="mt-4 flex items-center gap-2">
                {!planned &&
                  (allowed(i) ? (
                    <Button size="sm" variant={i.isEnabled ? "outline" : "primary"} onClick={() => configure(i)}>
                      {i.isEnabled ? t("int.configure") : t("int.connect")}
                    </Button>
                  ) : (
                    <span className="flex items-center gap-1 text-xs text-ad-muted">
                      <Lock className="size-3" /> {locale === "ar" ? "لا تملك الصلاحية" : "No permission"}
                    </span>
                  ))}
                {i.lastSyncAt && <span className="text-xs text-ad-muted">{t("int.lastSync", { when: timeAgo(i.lastSyncAt, locale) })}</span>}
                {i.docsUrl && (
                  <a href={i.docsUrl} target="_blank" rel="noopener noreferrer" className="ms-auto inline-flex items-center gap-1 text-xs text-ad-muted hover:text-ad-fg">
                    {t("int.docs")} <ExternalLink className="size-3" />
                  </a>
                )}
              </div>
            </article>
          );
        })}
      </div>

      <EditSheet
        open={Boolean(open && form)}
        onOpenChange={(o) => !o && (setOpen(null), setForm(null))}
        title={
          open && (
            <span className="flex items-center gap-2">
              <BrandIcon icon={open.icon} className="size-4" /> {open.name}
            </span>
          )
        }
        onSave={() => save(false)}
        saving={pending}
        footerExtra={
          open?.fields.length ? (
            <Button variant="outline" loading={pending} onClick={() => save(true)}>
              {t("int.testConnection")}
            </Button>
          ) : null
        }
      >
        {open && form && (
          <div className="space-y-5">
            <p className="text-[13px] leading-relaxed text-ad-muted">{tr(open.description, locale)}</p>
            <Switch checked={form.isEnabled} onCheckedChange={(v) => setForm({ ...form, isEnabled: v })} label={t("c.active")} />
            {open.supportsModes && (
              <div>
                <Label>{t("int.mode")}</Label>
                <Segmented value={form.mode} onChange={(v) => setForm({ ...form, mode: v })} options={[{ value: "test", label: t("int.test") }, { value: "live", label: t("int.live") }]} />
              </div>
            )}
            {fieldsForMode.map((f) => {
              const isSecret = f.type === "secret" || f.type === "secret-textarea";
              const isSet = open.secretsSet[f.key] && !form.clearSecrets.includes(f.key);
              return (
                <div key={f.key}>
                  {f.type === "boolean" ? (
                    <Switch checked={Boolean(form.config[f.key])} onCheckedChange={(v) => setForm({ ...form, config: { ...form.config, [f.key]: v } })} label={tr(f.label, locale)} description={f.help ? tr(f.help, locale) : undefined} />
                  ) : (
                    <>
                      <Label optional={!f.required} hint={f.help ? tr(f.help, locale) : undefined}>
                        {tr(f.label, locale)}
                      </Label>
                      {f.type === "select" ? (
                        <Select value={String(form.config[f.key] ?? "")} onChange={(e) => setForm({ ...form, config: { ...form.config, [f.key]: e.target.value } })}>
                          {f.options?.map((o) => (
                            <option key={o.value} value={o.value}>
                              {tr(o.label, locale)}
                            </option>
                          ))}
                        </Select>
                      ) : f.type === "textarea" || f.type === "secret-textarea" ? (
                        <TextArea
                          rows={5}
                          dir="ltr"
                          className="font-mono text-xs"
                          autoComplete="off"
                          spellCheck={false}
                          placeholder={isSecret && isSet ? t("int.secretSet") : f.placeholder}
                          value={isSecret ? (form.secrets[f.key] ?? "") : String(form.config[f.key] ?? "")}
                          onChange={(e) => setForm(isSecret ? { ...form, secrets: { ...form.secrets, [f.key]: e.target.value } } : { ...form, config: { ...form.config, [f.key]: e.target.value } })}
                        />
                      ) : (
                        <TextInput
                          type={isSecret ? "password" : f.type === "number" ? "number" : "text"}
                          dir="ltr"
                          autoComplete={isSecret ? "new-password" : "off"}
                          spellCheck={false}
                          placeholder={isSecret && isSet ? `•••••••• ${t("int.secretSet")}` : f.placeholder}
                          value={isSecret ? (form.secrets[f.key] ?? "") : String(form.config[f.key] ?? "")}
                          onChange={(e) => setForm(isSecret ? { ...form, secrets: { ...form.secrets, [f.key]: e.target.value } } : { ...form, config: { ...form.config, [f.key]: f.type === "number" ? Number(e.target.value) : e.target.value } })}
                        />
                      )}
                      {isSecret && isSet && (
                        <button type="button" className="mt-1 text-xs text-red-600 hover:underline" onClick={() => setForm({ ...form, clearSecrets: [...form.clearSecrets, f.key] })}>
                          {t("int.clearSecret")}
                        </button>
                      )}
                    </>
                  )}
                </div>
              );
            })}
            {webhook && (
              <div>
                <Label>{t("int.webhookUrl")}</Label>
                <div className="flex gap-2">
                  <TextInput readOnly value={webhook} dir="ltr" className="font-mono text-xs" onFocus={(e) => e.target.select()} />
                  <Button variant="outline" size="icon" aria-label="Copy" onClick={() => navigator.clipboard.writeText(webhook).then(() => toast.success(t("c.copied")))}>
                    <Copy />
                  </Button>
                </div>
              </div>
            )}
            {result && (
              <div className={cn("flex items-start gap-2 rounded-xl p-3 text-[13px]", result.ok ? "bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300" : "bg-red-50 text-red-800 dark:bg-red-950/40 dark:text-red-300")} role="status">
                {result.ok ? <CheckCircle2 className="mt-0.5 size-4 shrink-0" /> : <XCircle className="mt-0.5 size-4 shrink-0" />}
                <span className="break-words">{result.message}</span>
              </div>
            )}
            {open.canSync && open.isEnabled && (
              <Button
                variant="outline"
                size="sm"
                leftIcon={<RefreshCw />}
                loading={pending}
                onClick={() =>
                  start(async () => {
                    const r = await syncIntegrationAction(open.key);
                    if (r.ok) {
                      setResult(r.data);
                      router.refresh();
                    }
                  })
                }
              >
                {t("int.sync")}
              </Button>
            )}
          </div>
        )}
      </EditSheet>
    </>
  );
}

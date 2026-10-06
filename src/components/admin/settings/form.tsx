"use client";

import { useEffect, useState, useTransition, type ReactNode } from "react";
import { AlertCircle, X } from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { useAdmin } from "../admin-context";
import { PageHeader, Panel, Segmented, Switch } from "../ui";
import { Label, TextInput, TextArea, Select, LocalizedField, ImageField, ColorInput, MoneyInput, FieldError } from "../fields";
import { saveSettingsAction } from "@/actions/admin/settings";
import type { SettingsGroup } from "@/server/settings/schemas";
import { cn } from "@/lib/utils";

type L = readonly [string, string];
type Opt = { value: string; label: L };
type Base = { path: string; label: L; hint?: L; showIf?: (v: Record<string, unknown>) => boolean; wide?: boolean };
export type SettingField = Base &
  (
    | { type: "text" | "email" | "url" | "textarea"; placeholder?: string; ltr?: boolean }
    | { type: "localized" | "localizedTextarea" }
    | { type: "number"; min?: number; max?: number; step?: number; suffix?: string }
    | { type: "money" }
    | { type: "percentBp" }
    | { type: "boolean" }
    | { type: "select" | "segmented"; options: Opt[] }
    | { type: "color" }
    | { type: "image" }
    | { type: "secret" }
    | { type: "tags"; placeholder?: string; transform?: (s: string) => string }
    | { type: "hours" }
    | { type: "custom"; render: (value: unknown, set: (v: unknown) => void, all: Record<string, unknown>) => ReactNode }
  );
export type SettingSection = { title: L; description?: L; fields: SettingField[]; aside?: ReactNode };

const get = (obj: Record<string, unknown>, path: string): unknown => path.split(".").reduce<unknown>((o, k) => (o && typeof o === "object" ? (o as Record<string, unknown>)[k] : undefined), obj);
function set(obj: Record<string, unknown>, path: string, value: unknown): Record<string, unknown> {
  const [head, ...rest] = path.split(".");
  return { ...obj, [head]: rest.length ? set((obj[head] as Record<string, unknown>) ?? {}, rest.join("."), value) : value };
}

/**
 * Generic, declarative settings page: renders sections of typed fields bound
 * to dot-paths in one settings group, tracks dirty state and saves the whole
 * group through the validated server action.
 */
export function SettingsForm({
  group,
  title,
  description,
  initial,
  secrets = {},
  sections,
  before,
  after,
  onSaved,
}: {
  group: SettingsGroup;
  title: string;
  description?: string;
  initial: Record<string, unknown>;
  secrets?: Record<string, boolean>;
  sections: SettingSection[];
  before?: ReactNode;
  after?: ReactNode;
  onSaved?: () => void;
}) {
  const { t, locale } = useAdmin();
  const router = useRouter();
  const [value, setValue] = useState(initial);
  const [dirty, setDirty] = useState(false);
  const [clear, setClear] = useState<string[]>([]);
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [pending, start] = useTransition();
  const l = (x: L) => x[locale === "ar" ? 1 : 0];

  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => {
      if (dirty) e.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const update = (path: string, v: unknown) => {
    setValue((cur) => set(cur, path, v));
    setDirty(true);
  };

  const save = () =>
    start(async () => {
      const r = await saveSettingsAction(group, value, clear);
      if (r.ok) {
        toast.success(t("c.saved"));
        setDirty(false);
        setClear([]);
        setErrors({});
        // Secrets are never echoed back: blank the inputs after saving.
        for (const s of sections) for (const f of s.fields) if (f.type === "secret") setValue((cur) => set(cur, f.path, ""));
        onSaved?.();
        router.refresh();
      } else {
        setErrors(r.fieldErrors ?? {});
        toast.error(t("c.fixErrors"));
      }
    });

  const fieldError = (path: string) => {
    const e = errors[path]?.[0];
    if (!e) return null;
    return locale === "ar" ? "قيمة غير صالحة" : e === "Invalid colour" ? e : "Invalid value";
  };

  return (
    <>
      <PageHeader
        back={{ href: "/admin/settings", label: t("s.title") }}
        title={title}
        description={description}
        actions={
          <Button loading={pending} disabled={!dirty} onClick={save}>
            {t("c.save")}
          </Button>
        }
      />
      {before}
      <div className="space-y-4">
        {sections.map((s) => {
          const visible = s.fields.filter((f) => !f.showIf || f.showIf(value));
          return (
            <Panel key={s.title[0]} title={l(s.title)} description={s.description ? l(s.description) : undefined}>
              <div className={cn(s.aside && "grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,320px)]")}>
                <div className="grid gap-x-5 gap-y-4 sm:grid-cols-2">
                  {visible.map((f) => (
                    <div key={f.path} className={cn((f.wide || ["localized", "localizedTextarea", "textarea", "boolean", "tags", "hours", "image", "custom"].includes(f.type)) && "sm:col-span-2")}>
                      <Field field={f} value={get(value, f.path)} onChange={(v) => update(f.path, v)} all={value} isSecretSet={secrets[f.path] && !clear.includes(f.path)} onClearSecret={() => (setClear((c) => [...c, f.path]), setDirty(true))} error={fieldError(f.path)} />
                    </div>
                  ))}
                </div>
                {s.aside}
              </div>
            </Panel>
          );
        })}
      </div>
      {after}
      <div className={cn("fixed inset-x-3 bottom-20 z-30 mx-auto flex max-w-xl items-center gap-3 rounded-2xl border border-ad-border bg-ad-panel p-2.5 ps-4 shadow-pop transition lg:bottom-6", dirty ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-4 opacity-0")}>
        <span className="flex min-w-0 flex-1 items-center gap-2 text-sm">
          <AlertCircle className="size-4 shrink-0 text-amber-500" /> <span className="truncate max-sm:sr-only">{t("c.unsaved")}</span>
        </span>
        <Button variant="ghost" size="sm" onClick={() => (setValue(initial), setDirty(false), setClear([]), setErrors({}))}>
          {t("c.discard")}
        </Button>
        <Button size="sm" loading={pending} onClick={save}>
          {t("c.save")}
        </Button>
      </div>
    </>
  );
}

function Field({ field: f, value, onChange, all, isSecretSet, onClearSecret, error }: { field: SettingField; value: unknown; onChange: (v: unknown) => void; all: Record<string, unknown>; isSecretSet?: boolean; onClearSecret: () => void; error: string | null }) {
  const { t, locale, money } = useAdmin();
  const l = (x: L) => x[locale === "ar" ? 1 : 0];
  const label = l(f.label);
  const hint = f.hint ? l(f.hint) : undefined;
  switch (f.type) {
    case "boolean":
      return <Switch checked={Boolean(value)} onCheckedChange={onChange} label={label} description={hint} />;
    case "localized":
    case "localizedTextarea":
      return <LocalizedField label={label} hint={hint} value={(value as Record<string, string>) ?? {}} onChange={onChange} multiline={f.type === "localizedTextarea"} />;
    case "custom":
      return (
        <div>
          <Label hint={hint}>{label}</Label>
          {f.render(value, onChange, all)}
        </div>
      );
  }
  return (
    <div>
      <Label hint={hint}>{label}</Label>
      {(() => {
        switch (f.type) {
          case "text":
          case "email":
          case "url":
            return <TextInput type={f.type === "text" ? "text" : f.type} value={String(value ?? "")} onChange={(e) => onChange(e.target.value)} placeholder={f.placeholder} dir={f.ltr || f.type !== "text" ? "ltr" : undefined} invalid={Boolean(error)} />;
          case "textarea":
            return <TextArea rows={4} value={String(value ?? "")} onChange={(e) => onChange(e.target.value)} dir={f.ltr ? "ltr" : undefined} />;
          case "number":
            return (
              <div className="relative">
                <TextInput type="number" min={f.min} max={f.max} step={f.step ?? 1} value={value == null ? "" : String(value)} onChange={(e) => onChange(e.target.value === "" ? 0 : Number(e.target.value))} invalid={Boolean(error)} className={f.suffix ? "pe-14" : undefined} />
                {f.suffix && <span className="pointer-events-none absolute inset-y-0 end-3 flex items-center text-xs text-ad-muted">{f.suffix}</span>}
              </div>
            );
          case "money":
            return <MoneyInput value={(value as number) ?? 0} onChange={(v) => onChange(v ?? 0)} decimals={money.base.decimals} symbol={money.display.symbol} />;
          case "percentBp":
            return (
              <div className="relative">
                <TextInput type="number" min={0} max={100} step={0.01} value={((value as number) ?? 0) / 100} onChange={(e) => onChange(Math.round(Number(e.target.value) * 100))} className="pe-8" />
                <span className="pointer-events-none absolute inset-y-0 end-3 flex items-center text-xs text-ad-muted">%</span>
              </div>
            );
          case "select":
            return (
              <Select value={String(value ?? "")} onChange={(e) => onChange(e.target.value)}>
                {f.options.map((o) => (
                  <option key={o.value} value={o.value}>
                    {l(o.label)}
                  </option>
                ))}
              </Select>
            );
          case "segmented":
            return <Segmented value={String(value ?? f.options[0].value)} onChange={onChange} options={f.options.map((o) => ({ value: o.value, label: l(o.label) }))} />;
          case "color":
            return <ColorInput value={String(value ?? "")} onChange={onChange} />;
          case "image":
            return <ImageField value={value ? { url: String(value) } : null} onChange={(v) => onChange(v?.url ?? "")} folder="branding" aspect="aspect-[3/1]" />;
          case "secret":
            return (
              <>
                <TextInput type="password" autoComplete="new-password" value={String(value ?? "")} onChange={(e) => onChange(e.target.value)} placeholder={isSecretSet ? `•••••••• ${t("int.secretSet")}` : ""} dir="ltr" />
                {isSecretSet && (
                  <button type="button" onClick={onClearSecret} className="mt-1 text-xs text-red-600 hover:underline">
                    {t("int.clearSecret")}
                  </button>
                )}
              </>
            );
          case "tags":
            return <TagsInput value={(value as string[]) ?? []} onChange={onChange} placeholder={f.placeholder} transform={f.transform} />;
          case "hours":
            return <HoursInput value={(value as Hours) ?? []} onChange={onChange} />;
        }
      })()}
      <FieldError message={error} />
    </div>
  );
}

function TagsInput({ value, onChange, placeholder, transform = (s) => s.trim() }: { value: string[]; onChange: (v: string[]) => void; placeholder?: string; transform?: (s: string) => string }) {
  const [draft, setDraft] = useState("");
  const add = () => {
    const parts = draft.split(/[,\n]/).map(transform).filter(Boolean);
    if (parts.length) onChange([...new Set([...value, ...parts])]);
    setDraft("");
  };
  return (
    <div className="flex min-h-11 flex-wrap items-center gap-1.5 rounded-lg border border-ad-border bg-ad-panel p-1.5 focus-within:ring-2 focus-within:ring-ad-accent/30">
      {value.map((v) => (
        <span key={v} className="flex items-center gap-1 rounded-md bg-ad-sunken px-2 py-1 text-xs" dir="ltr">
          {v}
          <button type="button" aria-label={`Remove ${v}`} onClick={() => onChange(value.filter((x) => x !== v))} className="text-ad-muted hover:text-ad-fg">
            <X className="size-3" />
          </button>
        </span>
      ))}
      <input
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === ",") {
            e.preventDefault();
            add();
          } else if (e.key === "Backspace" && !draft && value.length) onChange(value.slice(0, -1));
        }}
        onBlur={add}
        placeholder={placeholder}
        dir="ltr"
        className="h-8 min-w-[10rem] flex-1 bg-transparent px-1.5 text-sm outline-none"
      />
    </div>
  );
}

type Hours = { day: number; open: string; close: string; closed: boolean }[];
function HoursInput({ value, onChange }: { value: Hours; onChange: (v: Hours) => void }) {
  const { locale } = useAdmin();
  const dayName = (d: number) => new Date(2024, 0, 7 + d).toLocaleDateString(locale === "ar" ? "ar" : "en", { weekday: "long" });
  return (
    <div className="divide-y divide-ad-border rounded-xl border border-ad-border">
      {value.map((h, i) => (
        <div key={h.day} className="flex flex-wrap items-center gap-3 px-3 py-2">
          <span className="w-24 text-sm">{dayName(h.day)}</span>
          <Switch checked={!h.closed} onCheckedChange={(v) => onChange(value.map((x, xi) => (xi === i ? { ...x, closed: !v } : x)))} label={<span className="sr-only">{dayName(h.day)}</span>} />
          {!h.closed ? (
            <span className="flex items-center gap-2" dir="ltr">
              <input type="time" value={h.open} onChange={(e) => onChange(value.map((x, xi) => (xi === i ? { ...x, open: e.target.value } : x)))} className="h-9 rounded-lg border border-ad-border bg-ad-panel px-2 text-sm" />
              –
              <input type="time" value={h.close} onChange={(e) => onChange(value.map((x, xi) => (xi === i ? { ...x, close: e.target.value } : x)))} className="h-9 rounded-lg border border-ad-border bg-ad-panel px-2 text-sm" />
            </span>
          ) : (
            <span className="text-xs text-ad-muted">{locale === "ar" ? "مغلق" : "Closed"}</span>
          )}
        </div>
      ))}
    </div>
  );
}

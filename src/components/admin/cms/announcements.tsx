"use client";

import { useEffect, useState, useTransition } from "react";
import { Megaphone, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { useAdmin } from "../admin-context";
import { PageHeader, Panel, Pill, Segmented, Switch, ConfirmDialog, AdminEmpty } from "../ui";
import { Label, TextInput, Select, LocalizedField, ColorInput, FieldError } from "../fields";
import { EditSheet } from "../entity";
import { SortableList } from "../sortable";
import { IconPicker, IconPreview } from "../icon-picker";
import { saveAnnouncementAction, deleteAnnouncementAction, reorderContentAction } from "@/actions/admin/content";
import { saveSettingsAction } from "@/actions/admin/settings";
import { t as tr, type LocalizedText } from "@/lib/i18n-text";
import { cn } from "@/lib/utils";
import type { announcementList } from "@/server/admin/content";
import type { Settings } from "@/server/settings/schemas";

type Row = Awaited<ReturnType<typeof announcementList>>[number];
type Form = Omit<Row, "id" | "live">;
type Ticker = Settings<"ticker">;

const toLocalInput = (iso: string | null) => (iso ? new Date(new Date(iso).getTime() - new Date().getTimezoneOffset() * 60_000).toISOString().slice(0, 16) : "");
const fromLocalInput = (v: string) => (v ? new Date(v).toISOString() : null);
const SEPARATORS = { dot: "•", diamond: "◆", slash: "/", none: "" } as const;

export function AnnouncementsView({ rows, ticker: initialTicker }: { rows: Row[]; ticker: Ticker }) {
  const { t, locale } = useAdmin();
  const router = useRouter();
  const [items, setItems] = useState(rows);
  const [editing, setEditing] = useState<{ id: string | null; form: Form } | null>(null);
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [confirm, setConfirm] = useState<Row | null>(null);
  const [ticker, setTicker] = useState(initialTicker);
  const [tickerDirty, setTickerDirty] = useState(false);
  const [pending, start] = useTransition();
  // Server data wins after each refresh (create/edit/delete).
  useEffect(() => setItems(rows), [rows]);

  const open = (r: Row | null) => {
    setErrors({});
    setEditing(r ? { id: r.id, form: { text: r.text, url: r.url, icon: r.icon, isActive: r.isActive, startsAt: r.startsAt, endsAt: r.endsAt } } : { id: null, form: { text: {}, url: "", icon: "", isActive: true, startsAt: null, endsAt: null } });
  };
  const set = <K extends keyof Form>(k: K, v: Form[K]) => setEditing((e) => (e ? { ...e, form: { ...e.form, [k]: v } } : e));
  const setT = <K extends keyof Ticker>(k: K, v: Ticker[K]) => (setTicker((x) => ({ ...x, [k]: v })), setTickerDirty(true));

  const save = () =>
    editing &&
    start(async () => {
      const r = await saveAnnouncementAction(editing.id, editing.form);
      if (r.ok) {
        toast.success(t("c.saved"));
        setEditing(null);
        router.refresh();
      } else {
        setErrors(r.fieldErrors ?? {});
        toast.error(t("c.fixErrors"));
      }
    });

  const live = items.filter((i) => i.live);
  const dirAttr = ticker.direction === "auto" ? undefined : ticker.direction === "reverse" ? (locale === "ar" ? "ltr" : "rtl") : locale === "ar" ? "rtl" : "ltr";

  return (
    <>
      <PageHeader
        title={t("cms.announcements")}
        description={locale === "ar" ? "الشريط المتحرك أعلى المتجر" : "The scrolling bar at the top of the store"}
        actions={
          <Button leftIcon={<Plus />} onClick={() => open(null)}>
            {t("cms.newAnnouncement")}
          </Button>
        }
      />

      {/* Live preview of the ticker with current settings */}
      <div className="mb-4 overflow-hidden rounded-xl border border-ad-border" aria-hidden>
        <div
          className={cn("flex h-10 items-center gap-6 overflow-hidden whitespace-nowrap px-4 text-[13px]", ticker.fontWeight === "semibold" ? "font-semibold" : ticker.fontWeight === "medium" ? "font-medium" : "font-normal")}
          style={{ background: ticker.background, color: ticker.textColor, opacity: ticker.enabled ? 1 : 0.45 }}
          dir={dirAttr}
        >
          {(live.length ? live : items).slice(0, 4).map((a, i) => (
            <span key={a.id} className="flex items-center gap-6">
              {i > 0 && SEPARATORS[ticker.separator] && <span className="opacity-60">{SEPARATORS[ticker.separator]}</span>}
              <span className="flex items-center gap-2">
                {a.icon && <IconPreview value={a.icon} className="size-3.5" />}
                {tr(a.text, locale)}
              </span>
            </span>
          ))}
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
        <Panel padded={false}>
          {items.length ? (
            <SortableList
              items={items}
              getId={(r) => r.id}
              onChange={(list) => {
                setItems(list);
                start(async () => {
                  await reorderContentAction("announcement", list.map((r) => r.id));
                  router.refresh();
                });
              }}
              className="divide-y divide-ad-border"
              render={(r, handle) => (
                <div className="flex items-center gap-2 px-3 py-3">
                  {handle}
                  <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-ad-sunken text-ad-muted">{r.icon ? <IconPreview value={r.icon} className="size-4" /> : <Megaphone className="size-4" />}</span>
                  <button type="button" onClick={() => open(r)} className="min-w-0 flex-1 text-start">
                    <span className="block truncate text-sm font-medium">{tr(r.text, locale)}</span>
                    {r.url && (
                      <span className="block truncate text-xs text-ad-muted" dir="ltr">
                        {r.url}
                      </span>
                    )}
                  </button>
                  <Pill tone={r.live ? "green" : r.isActive ? "blue" : "neutral"}>{r.live ? t("cms.live") : r.isActive ? t("cp.scheduled") : t("c.inactive")}</Pill>
                  <Button size="icon-sm" variant="ghost" aria-label={t("c.edit")} onClick={() => open(r)}>
                    <Pencil />
                  </Button>
                </div>
              )}
            />
          ) : (
            <AdminEmpty icon={<Megaphone />} action={<Button size="sm" leftIcon={<Plus />} onClick={() => open(null)}>{t("cms.newAnnouncement")}</Button>} />
          )}
        </Panel>

        <Panel title={t("cms.tickerSettings")}>
          <div className="space-y-4">
            <Switch checked={ticker.enabled} onCheckedChange={(v) => setT("enabled", v)} label={t("c.active")} />
            <div>
              <Label hint={`${ticker.speed}`}>{t("cms.speed")}</Label>
              <input type="range" min={10} max={200} value={ticker.speed} onChange={(e) => setT("speed", Number(e.target.value))} className="w-full accent-[var(--ad-accent)]" />
            </div>
            <div>
              <Label>{t("cms.direction")}</Label>
              <Segmented
                size="sm"
                value={ticker.direction}
                onChange={(v) => setT("direction", v)}
                options={[
                  { value: "auto", label: locale === "ar" ? "تلقائي" : "Auto" },
                  { value: "forward", label: locale === "ar" ? "أمامي" : "Forward" },
                  { value: "reverse", label: locale === "ar" ? "عكسي" : "Reverse" },
                ]}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>{t("cms.background")}</Label>
                <ColorInput value={ticker.background} onChange={(v) => setT("background", v)} />
              </div>
              <div>
                <Label>{t("cms.textColor")}</Label>
                <ColorInput value={ticker.textColor} onChange={(v) => setT("textColor", v)} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>{t("cms.separator")}</Label>
                <Select value={ticker.separator} onChange={(e) => setT("separator", e.target.value as Ticker["separator"])}>
                  <option value="dot">• dot</option>
                  <option value="diamond">◆ diamond</option>
                  <option value="slash">/ slash</option>
                  <option value="none">—</option>
                </Select>
              </div>
              <div>
                <Label>{locale === "ar" ? "سماكة الخط" : "Font weight"}</Label>
                <Select value={ticker.fontWeight} onChange={(e) => setT("fontWeight", e.target.value as Ticker["fontWeight"])}>
                  <option value="normal">Normal</option>
                  <option value="medium">Medium</option>
                  <option value="semibold">Semibold</option>
                </Select>
              </div>
            </div>
            <Switch checked={ticker.pauseOnHover} onCheckedChange={(v) => setT("pauseOnHover", v)} label={t("cms.pauseHover")} />
            <Button
              block
              size="sm"
              disabled={!tickerDirty}
              loading={pending}
              onClick={() =>
                start(async () => {
                  const r = await saveSettingsAction("ticker", ticker);
                  if (r.ok) {
                    toast.success(t("c.saved"));
                    setTickerDirty(false);
                  } else toast.error(t("c.error"));
                })
              }
            >
              {t("c.save")}
            </Button>
          </div>
        </Panel>
      </div>

      <EditSheet
        open={Boolean(editing)}
        onOpenChange={(o) => !o && setEditing(null)}
        title={editing?.id ? t("c.edit") : t("cms.newAnnouncement")}
        onSave={save}
        saving={pending}
        footerExtra={
          editing?.id && (
            <Button variant="ghost" className="text-red-600" leftIcon={<Trash2 />} onClick={() => setConfirm(items.find((r) => r.id === editing.id) ?? null)}>
              {t("c.delete")}
            </Button>
          )
        }
      >
        {editing && (
          <div className="space-y-5">
            <LocalizedField label={t("cms.text")} value={editing.form.text as LocalizedText} onChange={(v) => set("text", v as Record<string, string>)} required maxLength={300} error={errors.text ? t("c.required") : null} />
            <div>
              <Label optional>{t("cms.link")}</Label>
              <TextInput value={editing.form.url} onChange={(e) => set("url", e.target.value.trim())} dir="ltr" placeholder="/shop?sale=1" invalid={Boolean(errors.url)} />
              <FieldError message={errors.url ? (locale === "ar" ? "رابط غير صالح" : "Invalid link") : null} />
            </div>
            <IconPicker label={t("cms.icon")} value={editing.form.icon} onChange={(v) => set("icon", v ?? "")} />
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label optional>{t("cp.starts")}</Label>
                <TextInput type="datetime-local" value={toLocalInput(editing.form.startsAt)} onChange={(e) => set("startsAt", fromLocalInput(e.target.value))} />
              </div>
              <div>
                <Label optional>{t("cp.ends")}</Label>
                <TextInput type="datetime-local" value={toLocalInput(editing.form.endsAt)} onChange={(e) => set("endsAt", fromLocalInput(e.target.value))} invalid={Boolean(errors.endsAt)} />
                <FieldError message={errors.endsAt ? (locale === "ar" ? "يجب أن ينتهي بعد البدء" : "Must end after it starts") : null} />
              </div>
            </div>
            <Switch checked={editing.form.isActive} onCheckedChange={(v) => set("isActive", v)} label={t("c.active")} />
          </div>
        )}
      </EditSheet>

      <ConfirmDialog
        open={Boolean(confirm)}
        onOpenChange={(o) => !o && setConfirm(null)}
        title={t("c.confirmDelete")}
        text={confirm ? tr(confirm.text, locale) : ""}
        confirmLabel={t("c.delete")}
        onConfirm={async () => {
          if (!confirm) return;
          const r = await deleteAnnouncementAction(confirm.id);
          if (r.ok) {
            toast.success(t("c.deleted"));
            setConfirm(null);
            setEditing(null);
            setItems((list) => list.filter((x) => x.id !== confirm.id));
            router.refresh();
          }
        }}
      />
    </>
  );
}

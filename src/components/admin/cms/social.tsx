"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useAdmin } from "../admin-context";
import { PageHeader, Panel, Segmented, Switch } from "../ui";
import { Label, TextInput, LocalizedField, FieldError } from "../fields";
import { SectionTitle } from "../entity";
import { SortableList } from "../sortable";
import { SocialIcon, socialLabel } from "@/components/ui/social-icon";
import { saveSocialAction } from "@/actions/admin/content";
import { saveSettingsAction } from "@/actions/admin/settings";
import { cn } from "@/lib/utils";
import type { socialList } from "@/server/admin/content";
import type { Settings } from "@/server/settings/schemas";

type Item = Awaited<ReturnType<typeof socialList>>[number];
type Widgets = Settings<"widgets">;
const PLACEMENTS = ["header", "footer", "contact", "about", "home", "floating"] as const;

export function SocialView({ items: initial, widgets: initialWidgets }: { items: Item[]; widgets: Widgets }) {
  const { t, locale } = useAdmin();
  const [items, setItems] = useState(initial);
  const [widgets, setWidgets] = useState(initialWidgets);
  const [dirty, setDirty] = useState<{ social: boolean; widgets: boolean }>({ social: false, widgets: false });
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [pending, start] = useTransition();

  const setItem = (platform: string, patch: Partial<Item>) => (setItems((list) => list.map((i) => (i.platform === platform ? { ...i, ...patch } : i))), setDirty((d) => ({ ...d, social: true })));
  const setW = <G extends keyof Widgets>(group: G, patch: Partial<Widgets[G]>) => (setWidgets((w) => ({ ...w, [group]: { ...w[group], ...patch } })), setDirty((d) => ({ ...d, widgets: true })));

  const save = () =>
    start(async () => {
      let ok = true;
      if (dirty.social) {
        const r = await saveSocialAction(items.map(({ platform, label, url, isEnabled, placements }) => ({ platform, label, url, isEnabled, placements })));
        if (!r.ok) {
          ok = false;
          setErrors(r.fieldErrors ?? {});
        } else setErrors({});
      }
      if (dirty.widgets) {
        const r = await saveSettingsAction("widgets", widgets);
        if (!r.ok) ok = false;
      }
      if (ok) {
        toast.success(t("c.saved"));
        setDirty({ social: false, widgets: false });
      } else toast.error(t("c.fixErrors"));
    });

  const urlError = (i: number) => {
    const e = errors[`${i}.url`]?.[0];
    return e ? (e === "required" ? (locale === "ar" ? "أدخل الرابط لتفعيل المنصة" : "Add the URL to enable this platform") : locale === "ar" ? "يجب أن يبدأ الرابط بـ https://" : "Must be a full https:// URL") : null;
  };

  return (
    <>
      <PageHeader
        title={t("cms.social")}
        description={t("cms.socialHint")}
        actions={
          <Button loading={pending} disabled={!dirty.social && !dirty.widgets} onClick={save}>
            {t("c.save")}
          </Button>
        }
      />
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <Panel padded={false}>
          <SortableList
            items={items}
            getId={(i) => i.platform}
            onChange={(list) => (setItems(list), setDirty((d) => ({ ...d, social: true })))}
            className="divide-y divide-ad-border"
            render={(it, handle, i) => (
              <div className={cn("px-3 py-3", !it.isEnabled && "bg-ad-sunken/40")}>
                <div className="flex items-center gap-3">
                  {handle}
                  <span className={cn("grid size-9 shrink-0 place-items-center rounded-lg", it.isEnabled ? "bg-ad-fg text-ad-panel" : "bg-ad-sunken text-ad-muted")}>
                    <SocialIcon platform={it.platform} className="size-4" />
                  </span>
                  <span className="flex-1 text-sm font-medium">{socialLabel(it.platform)}</span>
                  <Switch checked={it.isEnabled} onCheckedChange={(v) => setItem(it.platform, { isEnabled: v })} label={<span className="sr-only">{socialLabel(it.platform)}</span>} />
                </div>
                {(it.isEnabled || it.url) && (
                  <div className="mt-3 space-y-3 ps-12">
                    <div>
                      <TextInput value={it.url} onChange={(e) => setItem(it.platform, { url: e.target.value.trim() })} dir="ltr" placeholder={`https://${it.platform === "x" ? "x.com" : `${it.platform}.com`}/yourstore`} aria-label={t("cms.socialUrl")} invalid={Boolean(urlError(i))} />
                      <FieldError message={urlError(i)} />
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {PLACEMENTS.map((p) => {
                        const on = it.placements.includes(p);
                        return (
                          <button
                            key={p}
                            type="button"
                            aria-pressed={on}
                            onClick={() => setItem(it.platform, { placements: on ? it.placements.filter((x) => x !== p) : [...it.placements, p] })}
                            className={cn("rounded-full border px-2.5 py-1 text-xs transition", on ? "border-ad-accent bg-ad-accent/10 font-medium text-ad-accent" : "border-ad-border text-ad-muted hover:border-ad-fg/30")}
                          >
                            {t(`cms.place.${p}`)}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}
          />
        </Panel>

        <Panel title={t("cms.floatingWidgets")}>
          <div className="space-y-4">
            <SectionTitle>{t("cms.socialWidget")}</SectionTitle>
            <Switch checked={widgets.social.enabled} onCheckedChange={(v) => setW("social", { enabled: v })} label={t("c.active")} description={locale === "ar" ? "يعرض المنصات المفعّلة مع موضع «الزر العائم»" : "Shows enabled platforms that have the “Floating button” placement"} />
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>{t("cms.widgetSide")}</Label>
                <Segmented size="sm" value={widgets.social.side} onChange={(v) => setW("social", { side: v })} options={[{ value: "start", label: t("cms.align.start") }, { value: "end", label: locale === "ar" ? "النهاية" : "End" }]} />
              </div>
              <div>
                <Label>{t("cms.widgetSize")}</Label>
                <Segmented size="sm" value={widgets.social.size} onChange={(v) => setW("social", { size: v })} options={(["sm", "md", "lg"] as const).map((s) => ({ value: s, label: s.toUpperCase() }))} />
              </div>
              <div>
                <Label>{t("cms.widgetAnimation")}</Label>
                <Segmented size="sm" value={widgets.social.animation} onChange={(v) => setW("social", { animation: v })} options={(["none", "pulse", "float"] as const).map((s) => ({ value: s, label: s === "none" ? "—" : s[0].toUpperCase() + s.slice(1) }))} />
              </div>
              <div>
                <Label>{t("cms.widgetStyle")}</Label>
                <Segmented size="sm" value={widgets.social.style} onChange={(v) => setW("social", { style: v })} options={[{ value: "brand", label: locale === "ar" ? "ألوان" : "Brand" }, { value: "mono", label: locale === "ar" ? "أحادي" : "Mono" }]} />
              </div>
            </div>

            <SectionTitle>{t("cms.supportWidget")}</SectionTitle>
            <Switch checked={widgets.support.enabled} onCheckedChange={(v) => setW("support", { enabled: v })} label={t("c.active")} />
            <div>
              <Label>{t("cms.widgetSide")}</Label>
              <Segmented size="sm" value={widgets.support.side} onChange={(v) => setW("support", { side: v })} options={[{ value: "start", label: t("cms.align.start") }, { value: "end", label: locale === "ar" ? "النهاية" : "End" }]} />
            </div>
            <Switch checked={widgets.support.whatsapp} onCheckedChange={(v) => setW("support", { whatsapp: v })} label="WhatsApp" />
            <Switch checked={widgets.support.liveChat} onCheckedChange={(v) => setW("support", { liveChat: v })} label={t("nav.chat")} />
            <div>
              <Label hint={locale === "ar" ? "بالصيغة الدولية بدون + أو أصفار" : "International format, digits only"}>{t("cms.whatsappNumber")}</Label>
              <TextInput value={widgets.whatsapp.number} onChange={(e) => setW("whatsapp", { number: e.target.value.replace(/[^\d]/g, "") })} dir="ltr" inputMode="tel" placeholder="9627XXXXXXXX" />
            </div>
            <LocalizedField label={t("cms.whatsappMessage")} value={widgets.whatsapp.message} onChange={(v) => setW("whatsapp", { message: v })} />
          </div>
        </Panel>
      </div>
    </>
  );
}

"use client";

import { useState, useTransition } from "react";
import { ChevronDown, Copy, Eye, EyeOff, GalleryHorizontal, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { useAdmin } from "../admin-context";
import { PageHeader, Panel, Pill, Segmented, Switch, ConfirmDialog, AdminEmpty } from "../ui";
import { Label, TextInput, Select, LocalizedField, ImageField, ColorInput, FieldError, type MediaRef } from "../fields";
import { SectionTitle } from "../entity";
import { SortableList } from "../sortable";
import { saveSliderAction, deleteSliderAction } from "@/actions/admin/content";
import { t as tr, type LocalizedText } from "@/lib/i18n-text";
import { cn } from "@/lib/utils";
import type { sliderList } from "@/server/admin/content";

type SliderRow = Awaited<ReturnType<typeof sliderList>>[number];
type SlideRow = SliderRow["slides"][number];
type Slide = Omit<SlideRow, "desktopImage" | "mobileImage" | "id"> & { id?: string; key: string; desktopImage: MediaRef; mobileImage: MediaRef };
type Form = { id: string | null; key: string; name: string; settings: SliderRow["settings"]; slides: Slide[] };

const toLocalInput = (iso: string | null) => (iso ? new Date(new Date(iso).getTime() - new Date().getTimezoneOffset() * 60_000).toISOString().slice(0, 16) : "");
const fromLocalInput = (v: string) => (v ? new Date(v).toISOString() : null);
let seq = 0;
const newKey = () => `n${Date.now().toString(36)}${(seq++).toString(36)}`;

const blankSlide = (): Slide => ({
  key: newKey(),
  isVisible: true,
  startsAt: null,
  endsAt: null,
  desktopImage: null,
  mobileImage: null,
  eyebrow: {},
  heading: {},
  body: {},
  primaryCta: { label: {}, href: "" },
  secondaryCta: { label: {}, href: "" },
  style: { align: "start", vertical: "center", textColor: "#ffffff", overlay: "#000000", overlayOpacity: 35, background: "#0f172a", animation: "fade-up", buttonStyle: "solid" },
});

const toForm = (s: SliderRow | null): Form =>
  s
    ? { id: s.id, key: s.key, name: s.name, settings: s.settings, slides: s.slides.map((x) => ({ ...x, key: x.id, desktopImage: x.desktopImage, mobileImage: x.mobileImage })) }
    : { id: null, key: "", name: "", settings: { autoplay: true, interval: 6000, transition: "fade", loop: true, showArrows: true, showDots: true }, slides: [blankSlide()] };

export function SlidersView({ sliders }: { sliders: SliderRow[] }) {
  const { t, locale } = useAdmin();
  const router = useRouter();
  const [activeId, setActiveId] = useState<string | null>(sliders[0]?.id ?? null);
  const [form, setForm] = useState<Form>(() => toForm(sliders[0] ?? null));
  const [open, setOpen] = useState<string | null>(form.slides[0]?.key ?? null);
  const [dirty, setDirty] = useState(false);
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [confirm, setConfirm] = useState(false);
  const [pending, start] = useTransition();

  const pick = (s: SliderRow | null) => {
    if (dirty && !window.confirm(t("c.unsaved"))) return;
    setActiveId(s?.id ?? "new");
    const f = toForm(s);
    setForm(f);
    setOpen(f.slides[0]?.key ?? null);
    setDirty(false);
    setErrors({});
  };
  const set = (patch: Partial<Form>) => (setForm((f) => ({ ...f, ...patch })), setDirty(true));
  const setSlide = (key: string, patch: Partial<Slide>) => set({ slides: form.slides.map((s) => (s.key === key ? { ...s, ...patch } : s)) });
  const setStyle = (key: string, patch: Partial<Slide["style"]>) => setSlide(key, { style: { ...form.slides.find((s) => s.key === key)!.style, ...patch } });

  const save = () =>
    start(async () => {
      const payload = {
        key: form.key,
        name: form.name,
        settings: form.settings,
        slides: form.slides.map(({ key: _k, desktopImage, mobileImage, ...s }) => ({ ...s, desktopImageId: desktopImage?.id ?? null, mobileImageId: mobileImage?.id ?? null })),
      };
      const r = await saveSliderAction(form.id, payload);
      if (r.ok) {
        toast.success(t("c.saved"));
        setDirty(false);
        setErrors({});
        setActiveId(r.data.id);
        setForm((f) => ({ ...f, id: r.data.id }));
        router.refresh();
      } else {
        setErrors(r.fieldErrors ?? {});
        toast.error(t("c.fixErrors"));
      }
    });

  const slideTitle = (s: Slide, i: number) => tr(s.heading, locale) || `${t("cms.slide")} ${i + 1}`;
  const keyError = errors.key ? (errors.key[0] === "taken" ? t("cms.slugTaken") : t("c.required")) : null;

  return (
    <>
      <PageHeader
        title={t("nav.sliders")}
        description={locale === "ar" ? "شرائح بصور منفصلة لسطح المكتب والجوال، مع جدولة" : "Slides with separate desktop and mobile art, plus scheduling"}
        actions={
          <Button variant="outline" leftIcon={<Plus />} onClick={() => pick(null)}>
            {t("cms.newSlider")}
          </Button>
        }
      />
      <div className="grid gap-4 lg:grid-cols-[minmax(0,260px)_minmax(0,1fr)]">
        <Panel padded={false}>
          {sliders.length ? (
            <ul className="divide-y divide-ad-border">
              {sliders.map((s) => (
                <li key={s.id}>
                  <button type="button" onClick={() => pick(s)} className={cn("flex w-full items-center gap-3 px-4 py-3 text-start transition hover:bg-ad-hover", activeId === s.id && "bg-ad-accent/5")}>
                    <GalleryHorizontal className={cn("size-4", activeId === s.id ? "text-ad-accent" : "text-ad-muted")} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{s.name}</span>
                      <span className="block truncate text-xs text-ad-muted">
                        {s.slides.length} {t("cms.slides").toLowerCase()} · {s.usedOn.length ? s.usedOn.map((x) => `/${x === "home" ? "" : x}`).join(", ") : t("cms.notUsed")}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <AdminEmpty icon={<GalleryHorizontal />} />
          )}
        </Panel>

        <div className="min-w-0 space-y-4">
          <Panel title={form.id ? form.name : t("cms.newSlider")}>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label>{t("c.name")}</Label>
                <TextInput value={form.name} onChange={(e) => set({ name: e.target.value, ...(!form.id && !form.key ? {} : {}) })} invalid={Boolean(errors.name)} />
              </div>
              <div>
                <Label hint={t("cms.sliderKey")}>Key</Label>
                <TextInput value={form.key} onChange={(e) => set({ key: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "") })} dir="ltr" invalid={Boolean(errors.key)} />
                <FieldError message={keyError} />
              </div>
            </div>
            <SectionTitle>{t("cms.sliderSettings")}</SectionTitle>
            <div className="grid gap-4 sm:grid-cols-2">
              <Switch checked={form.settings.autoplay} onCheckedChange={(v) => set({ settings: { ...form.settings, autoplay: v } })} label={t("cms.autoplay")} />
              <Switch checked={form.settings.loop} onCheckedChange={(v) => set({ settings: { ...form.settings, loop: v } })} label={t("cms.loop")} />
              <Switch checked={form.settings.showArrows} onCheckedChange={(v) => set({ settings: { ...form.settings, showArrows: v } })} label={t("cms.arrows")} />
              <Switch checked={form.settings.showDots} onCheckedChange={(v) => set({ settings: { ...form.settings, showDots: v } })} label={t("cms.dots")} />
              <div>
                <Label>{t("cms.interval")}</Label>
                <TextInput type="number" min={2} max={30} step={0.5} value={form.settings.interval / 1000} onChange={(e) => set({ settings: { ...form.settings, interval: Math.round(Number(e.target.value) * 1000) } })} />
              </div>
              <div>
                <Label>{t("cms.transition")}</Label>
                <Segmented
                  value={form.settings.transition}
                  onChange={(v) => set({ settings: { ...form.settings, transition: v } })}
                  options={[
                    { value: "fade", label: locale === "ar" ? "تلاشي" : "Fade" },
                    { value: "slide", label: locale === "ar" ? "انزلاق" : "Slide" },
                  ]}
                />
              </div>
            </div>
          </Panel>

          <Panel title={`${t("cms.slides")} · ${form.slides.length}`} padded={false}>
            <SortableList
              items={form.slides}
              getId={(s) => s.key}
              onChange={(slides) => set({ slides })}
              className="divide-y divide-ad-border"
              render={(s, handle, i) => (
                <div className={cn(!s.isVisible && "opacity-60")}>
                  <div className="flex items-center gap-2 px-3 py-2.5">
                    {handle}
                    {s.desktopImage?.url ? <img src={s.desktopImage.url} alt="" className="h-10 w-16 shrink-0 rounded-md object-cover" /> : <span className="h-10 w-16 shrink-0 rounded-md" style={{ background: s.style.background }} />}
                    <button type="button" onClick={() => setOpen(open === s.key ? null : s.key)} className="flex min-w-0 flex-1 items-center gap-2 text-start" aria-expanded={open === s.key}>
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-medium">{slideTitle(s, i)}</span>
                        {(s.startsAt || s.endsAt) && (
                          <span className="block text-xs text-ad-muted">
                            {t("cms.schedule")}: {s.startsAt ? new Date(s.startsAt).toLocaleDateString(locale) : "…"} → {s.endsAt ? new Date(s.endsAt).toLocaleDateString(locale) : "…"}
                          </span>
                        )}
                      </span>
                      {Object.keys(errors).some((k) => k.startsWith(`slides.${i}.`)) && <Pill tone="red">!</Pill>}
                      <ChevronDown className={cn("ms-auto size-4 shrink-0 text-ad-muted transition", open === s.key && "rotate-180")} />
                    </button>
                    <Button size="icon-sm" variant="ghost" aria-label={s.isVisible ? t("c.hidden") : t("c.visible")} onClick={() => setSlide(s.key, { isVisible: !s.isVisible })}>
                      {s.isVisible ? <Eye /> : <EyeOff />}
                    </Button>
                    <Button size="icon-sm" variant="ghost" aria-label={t("c.duplicate")} onClick={() => set({ slides: [...form.slides.slice(0, i + 1), { ...structuredClone(s), id: undefined, key: newKey() }, ...form.slides.slice(i + 1)] })}>
                      <Copy />
                    </Button>
                    <Button size="icon-sm" variant="ghost" className="text-red-600" aria-label={t("c.delete")} onClick={() => set({ slides: form.slides.filter((x) => x.key !== s.key) })}>
                      <Trash2 />
                    </Button>
                  </div>
                  {open === s.key && (
                    <div className="space-y-5 border-t border-ad-border bg-ad-sunken/40 p-4">
                      <div className="grid gap-4 sm:grid-cols-[2fr_1fr]">
                        <ImageField label={t("cms.desktopImage")} value={s.desktopImage} onChange={(v) => setSlide(s.key, { desktopImage: v })} folder="slides" aspect="aspect-[16/7]" />
                        <ImageField label={t("cms.mobileImage")} value={s.mobileImage} onChange={(v) => setSlide(s.key, { mobileImage: v })} folder="slides" aspect="aspect-[4/5]" />
                      </div>
                      <LocalizedField label={t("cms.eyebrow")} value={s.eyebrow as LocalizedText} onChange={(v) => setSlide(s.key, { eyebrow: v as Record<string, string> })} />
                      <LocalizedField label={t("cms.heading")} value={s.heading as LocalizedText} onChange={(v) => setSlide(s.key, { heading: v as Record<string, string> })} />
                      <LocalizedField label={t("cms.body")} value={s.body as LocalizedText} onChange={(v) => setSlide(s.key, { body: v as Record<string, string> })} multiline rows={2} />
                      {(["primaryCta", "secondaryCta"] as const).map((k) => (
                        <div key={k} className="grid gap-3 sm:grid-cols-[2fr_1fr]">
                          <LocalizedField label={t(k === "primaryCta" ? "cms.primaryCta" : "cms.secondaryCta")} value={s[k].label} onChange={(v) => setSlide(s.key, { [k]: { ...s[k], label: v } })} />
                          <div>
                            <Label>{t("cms.buttonUrl")}</Label>
                            <TextInput value={s[k].href} onChange={(e) => setSlide(s.key, { [k]: { ...s[k], href: e.target.value.trim() } })} dir="ltr" placeholder="/shop" />
                          </div>
                        </div>
                      ))}
                      <SectionTitle>{t("c.appearance")}</SectionTitle>
                      <div className="grid gap-4 sm:grid-cols-2">
                        <div>
                          <Label>{t("cms.textAlign")}</Label>
                          <Segmented size="sm" value={s.style.align} onChange={(v) => setStyle(s.key, { align: v })} options={(["start", "center", "end"] as const).map((v) => ({ value: v, label: v === "start" ? t("cms.align.start") : v === "center" ? t("cms.align.center") : locale === "ar" ? "النهاية" : "End" }))} />
                        </div>
                        <div>
                          <Label>{t("cms.vertical")}</Label>
                          <Segmented size="sm" value={s.style.vertical} onChange={(v) => setStyle(s.key, { vertical: v })} options={(["top", "center", "bottom"] as const).map((v) => ({ value: v, label: locale === "ar" ? { top: "أعلى", center: "وسط", bottom: "أسفل" }[v] : v[0].toUpperCase() + v.slice(1) }))} />
                        </div>
                        <div>
                          <Label>{t("cms.textColor")}</Label>
                          <ColorInput value={s.style.textColor} onChange={(v) => setStyle(s.key, { textColor: v })} />
                        </div>
                        <div>
                          <Label hint={locale === "ar" ? "عند عدم وجود صورة" : "When there's no image"}>{t("cms.background")}</Label>
                          <ColorInput value={s.style.background} onChange={(v) => setStyle(s.key, { background: v })} />
                        </div>
                        <div>
                          <Label>{t("cms.overlay")}</Label>
                          <ColorInput value={s.style.overlay} onChange={(v) => setStyle(s.key, { overlay: v })} />
                        </div>
                        <div>
                          <Label hint={`${s.style.overlayOpacity}%`}>{t("cms.overlayOpacity")}</Label>
                          <input type="range" min={0} max={90} value={s.style.overlayOpacity} onChange={(e) => setStyle(s.key, { overlayOpacity: Number(e.target.value) })} className="w-full accent-[var(--ad-accent)]" />
                        </div>
                        <div>
                          <Label>{t("cms.animation")}</Label>
                          <Select value={s.style.animation} onChange={(e) => setStyle(s.key, { animation: e.target.value as Slide["style"]["animation"] })}>
                            <option value="fade-up">Fade up</option>
                            <option value="fade">Fade</option>
                            <option value="zoom">Zoom</option>
                            <option value="none">{locale === "ar" ? "بدون" : "None"}</option>
                          </Select>
                        </div>
                        <div>
                          <Label>{t("cms.buttonStyle")}</Label>
                          <Select value={s.style.buttonStyle} onChange={(e) => setStyle(s.key, { buttonStyle: e.target.value as Slide["style"]["buttonStyle"] })}>
                            <option value="solid">Solid</option>
                            <option value="outline">Outline</option>
                            <option value="glass">Glass</option>
                          </Select>
                        </div>
                      </div>
                      <SectionTitle>{t("cms.schedule")}</SectionTitle>
                      <div className="grid gap-4 sm:grid-cols-2">
                        <div>
                          <Label optional>{t("cp.starts")}</Label>
                          <TextInput type="datetime-local" value={toLocalInput(s.startsAt)} onChange={(e) => setSlide(s.key, { startsAt: fromLocalInput(e.target.value) })} />
                        </div>
                        <div>
                          <Label optional>{t("cp.ends")}</Label>
                          <TextInput type="datetime-local" value={toLocalInput(s.endsAt)} onChange={(e) => setSlide(s.key, { endsAt: fromLocalInput(e.target.value) })} invalid={Boolean(errors[`slides.${i}.endsAt`])} />
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            />
            <div className="border-t border-ad-border p-3">
              <Button
                size="sm"
                variant="outline"
                leftIcon={<Plus />}
                disabled={form.slides.length >= 20}
                onClick={() => {
                  const s = blankSlide();
                  set({ slides: [...form.slides, s] });
                  setOpen(s.key);
                }}
              >
                {t("cms.addSlide")}
              </Button>
            </div>
          </Panel>

          <div className="flex flex-wrap items-center gap-2">
            <Button loading={pending} onClick={save} disabled={!dirty && Boolean(form.id)}>
              {t("c.save")}
            </Button>
            {form.id && (
              <Button variant="ghost" className="text-red-600" leftIcon={<Trash2 />} onClick={() => setConfirm(true)}>
                {t("c.delete")}
              </Button>
            )}
            {dirty && <span className="text-sm text-ad-muted">{t("c.unsaved")}</span>}
          </div>
        </div>
      </div>
      <ConfirmDialog
        open={confirm}
        onOpenChange={setConfirm}
        title={t("c.confirmDelete")}
        text={sliders.find((s) => s.id === form.id)?.usedOn.length ? `${t("cms.usedOn")}: ${sliders.find((s) => s.id === form.id)!.usedOn.join(", ")}` : form.name}
        confirmLabel={t("c.delete")}
        onConfirm={async () => {
          if (!form.id) return;
          const r = await deleteSliderAction(form.id);
          if (r.ok) {
            toast.success(t("c.deleted"));
            setConfirm(false);
            const next = sliders.find((s) => s.id !== form.id) ?? null;
            setActiveId(next?.id ?? null);
            setForm(toForm(next));
            setDirty(false);
            router.refresh();
          }
        }}
      />
    </>
  );
}

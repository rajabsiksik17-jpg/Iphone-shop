"use client";

import { useState } from "react";
import { Monitor, Smartphone, Tablet } from "lucide-react";
import { useAdmin } from "../admin-context";
import { Segmented } from "../ui";
import { ImageField, type MediaRef } from "../fields";
import { HERO_RATIO, HERO_UPLOAD, type HeroDevice } from "@/lib/hero";
import { t as tr, type LocalizedText } from "@/lib/i18n-text";
import { cn } from "@/lib/utils";

export type DeviceArt = { desktop: MediaRef; tablet: MediaRef; mobile: MediaRef };
/** Default images live on the slide itself; language overrides are grouped per device. */
export type SlideArt = { desktopImage: MediaRef; tabletImage: MediaRef; mobileImage: MediaRef; localeImages: { ar: DeviceArt; en: DeviceArt } };
const KEY = { desktop: "desktopImage", tablet: "tabletImage", mobile: "mobileImage" } as const;
const defaults = (s: SlideArt): DeviceArt => ({ desktop: s.desktopImage, tablet: s.tabletImage, mobile: s.mobileImage });
type Scope = "default" | "ar" | "en";

type PreviewSlide = SlideArt & {
  eyebrow: LocalizedText | Record<string, string>;
  heading: LocalizedText | Record<string, string>;
  body: LocalizedText | Record<string, string>;
  primaryCta: { label: LocalizedText | Record<string, string>; href: string };
  style: {
    align: "start" | "center" | "end";
    vertical: "top" | "center" | "bottom";
    textColor: string;
    overlay: string;
    overlayOpacity: number;
    background: string;
    headingSize: "sm" | "md" | "lg";
    mobileAlign: "inherit" | "start" | "center" | "end";
    mobileVertical: "inherit" | "top" | "center" | "bottom";
    showBodyOnMobile: boolean;
  };
};

const ASPECT: Record<HeroDevice, string> = { desktop: "aspect-[8/3]", tablet: "aspect-[2/1]", mobile: "aspect-[16/11]" };
const DEVICES: HeroDevice[] = ["desktop", "tablet", "mobile"];

/** The image a shopper on this device and language actually sees (same fallbacks as the storefront). */
export function resolveArt(s: SlideArt, device: HeroDevice, lang: "ar" | "en"): MediaRef {
  const o = s.localeImages[lang];
  const chain: Record<HeroDevice, HeroDevice[]> = { desktop: ["desktop", "tablet", "mobile"], tablet: ["tablet", "desktop", "mobile"], mobile: ["mobile", "tablet", "desktop"] };
  for (const d of chain[device]) {
    const hit = o[d] ?? s[KEY[d]];
    if (hit) return hit;
  }
  return null;
}

/**
 * Banner artwork per device (desktop / tablet / mobile), with optional
 * Arabic- and English-specific versions for banners that contain text.
 */
export function SlideArtwork({ value, onChange }: { value: SlideArt; onChange: (patch: Partial<SlideArt>) => void }) {
  const { locale } = useAdmin();
  const ar = locale === "ar";
  const [scope, setScope] = useState<Scope>("default");
  const label = (d: HeroDevice) => ({ desktop: ar ? "سطح المكتب" : "Desktop", tablet: ar ? "تابلت" : "Tablet", mobile: ar ? "جوال" : "Mobile" })[d];
  const current = scope === "default" ? defaults(value) : value.localeImages[scope];
  const set = (d: HeroDevice, v: MediaRef) =>
    scope === "default" ? onChange({ [KEY[d]]: v } as Partial<SlideArt>) : onChange({ localeImages: { ...value.localeImages, [scope]: { ...value.localeImages[scope], [d]: v } } });
  const overrides = (l: "ar" | "en") => DEVICES.filter((d) => value.localeImages[l][d]).length;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-medium">{ar ? "صور البانر" : "Banner artwork"}</p>
        <Segmented
          size="sm"
          value={scope}
          onChange={setScope}
          options={[
            { value: "default", label: ar ? "الافتراضية" : "Default" },
            { value: "ar", label: `العربية${overrides("ar") ? ` · ${overrides("ar")}` : ""}` },
            { value: "en", label: `English${overrides("en") ? ` · ${overrides("en")}` : ""}` },
          ]}
        />
      </div>
      <p className="text-xs text-ad-muted">
        {scope === "default"
          ? ar
            ? "تُستخدم لكل اللغات. إذا تركت صورة التابلت أو الجوال فارغة تُستخدم أقرب صورة متاحة."
            : "Used for every language. Leave tablet or mobile empty to reuse the closest available image."
          : ar
            ? "اختياري: صور خاصة بهذه اللغة (مثلاً عندما يحتوي التصميم على نص). الفارغ يستخدم الصورة الافتراضية."
            : "Optional: artwork just for this language (e.g. when the design contains text). Empty slots use the default image."}
      </p>
      <div className="grid gap-4 sm:grid-cols-[2fr_1.4fr_1fr]">
        {DEVICES.map((d) => (
          <ImageField
            key={d}
            label={
              <span className="flex items-center gap-1.5">
                {label(d)}
                <span className="font-normal text-ad-muted" dir="ltr">
                  {HERO_UPLOAD[d]}
                </span>
              </span>
            }
            value={current[d]}
            onChange={(v) => set(d, v)}
            folder="slides"
            aspect={ASPECT[d]}
          />
        ))}
      </div>
    </div>
  );
}

/** Simulated device preview of one slide, using the storefront's proportions and fallbacks. */
export function SlidePreview({ slide }: { slide: PreviewSlide }) {
  const { locale } = useAdmin();
  const ar = locale === "ar";
  const [device, setDevice] = useState<HeroDevice>("desktop");
  const [lang, setLang] = useState<"ar" | "en">(locale === "ar" ? "ar" : "en");
  const img = resolveArt(slide, device, lang);
  const mobile = device === "mobile";
  const align = mobile && slide.style.mobileAlign !== "inherit" ? slide.style.mobileAlign : slide.style.align;
  const vertical = mobile && slide.style.mobileVertical !== "inherit" ? slide.style.mobileVertical : slide.style.vertical;
  const heading = tr(slide.heading, lang);
  const size = { desktop: { sm: "text-2xl", md: "text-3xl", lg: "text-4xl" }, tablet: { sm: "text-xl", md: "text-2xl", lg: "text-3xl" }, mobile: { sm: "text-sm", md: "text-base", lg: "text-lg" } }[device][slide.style.headingSize];
  const width = { desktop: "w-full", tablet: "w-[78%]", mobile: "w-[46%] min-w-[220px]" }[device];
  const ratio = { desktop: HERO_RATIO.desktop.md, tablet: HERO_RATIO.tablet, mobile: HERO_RATIO.mobile }[device];

  return (
    <div className="rounded-xl border border-ad-border bg-ad-panel">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-ad-border px-3 py-2">
        <div className="flex items-center gap-1" role="tablist" aria-label={ar ? "الجهاز" : "Device"}>
          {DEVICES.map((d) => {
            const Icon = d === "desktop" ? Monitor : d === "tablet" ? Tablet : Smartphone;
            return (
              <button
                key={d}
                type="button"
                role="tab"
                aria-selected={device === d}
                onClick={() => setDevice(d)}
                className={cn("flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-xs font-medium transition", device === d ? "bg-ad-fg text-ad-panel" : "text-ad-muted hover:bg-ad-hover")}
              >
                <Icon className="size-3.5" /> {{ desktop: ar ? "سطح المكتب" : "Desktop", tablet: ar ? "تابلت" : "Tablet", mobile: ar ? "جوال" : "Mobile" }[d]}
              </button>
            );
          })}
        </div>
        <Segmented size="sm" value={lang} onChange={setLang} options={[{ value: "ar", label: "AR" }, { value: "en", label: "EN" }]} />
      </div>
      <div className="grid place-items-center bg-ad-sunken/60 p-4">
        <div className={cn("overflow-hidden rounded-lg shadow-sm", width)} style={{ aspectRatio: ratio }} dir={lang === "ar" ? "rtl" : "ltr"}>
          <div className="relative size-full" style={{ backgroundColor: slide.style.background }}>
            {img?.url && <img src={img.url} alt="" className="absolute inset-0 size-full object-cover" />}
            <div className="absolute inset-0" style={{ backgroundColor: slide.style.overlay, opacity: slide.style.overlayOpacity / 100 }} />
            <div
              className={cn(
                "relative flex size-full flex-col",
                mobile ? "px-3" : "px-6",
                vertical === "top" ? "justify-start pt-3" : vertical === "bottom" ? "justify-end pb-4" : "justify-center",
                align === "center" ? "items-center text-center" : align === "end" ? "items-end text-end" : "items-start text-start",
              )}
              style={{ color: slide.style.textColor }}
            >
              {tr(slide.eyebrow, lang) && <span className="mb-1 rounded-full bg-white/15 px-1.5 text-[8px] font-semibold uppercase tracking-wider">{tr(slide.eyebrow, lang)}</span>}
              {heading && <p className={cn("max-w-[85%] font-semibold leading-tight whitespace-pre-line", size)}>{heading}</p>}
              {tr(slide.body, lang) && (!mobile || slide.style.showBodyOnMobile) && <p className="mt-1 line-clamp-2 max-w-[70%] text-[10px] opacity-85">{tr(slide.body, lang)}</p>}
              {tr(slide.primaryCta.label, lang) && <span className={cn("mt-2 rounded-md bg-white font-semibold text-neutral-900", mobile ? "px-2 py-0.5 text-[8px]" : "px-3 py-1 text-[10px]")}>{tr(slide.primaryCta.label, lang)}</span>}
            </div>
          </div>
        </div>
        {!img && <p className="mt-2 text-xs text-ad-muted">{ar ? "لا توجد صورة لهذا الجهاز — سيظهر لون الخلفية." : "No image for this device — the background colour is shown."}</p>}
      </div>
    </div>
  );
}

"use client";

import { useCallback, useEffect, useState } from "react";
import useEmblaCarousel from "embla-carousel-react";
import Autoplay from "embla-carousel-autoplay";
import Fade from "embla-carousel-fade";
import { ChevronLeft, ChevronRight, Pause, Play } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import type { ImageDTO } from "@/types/catalog";

export type SlideDTO = {
  id: string;
  eyebrow: string;
  heading: string;
  body: string;
  primary: { label: string; href: string } | null;
  secondary: { label: string; href: string } | null;
  desktop: ImageDTO | null;
  tablet: ImageDTO | null;
  mobile: ImageDTO | null;
  style: {
    align: "start" | "center" | "end";
    vertical: "top" | "center" | "bottom";
    textColor: string;
    overlay: string;
    overlayOpacity: number;
    background: string;
    animation: "fade-up" | "fade" | "zoom" | "none";
    buttonStyle: "solid" | "outline" | "glass";
    headingSize: "sm" | "md" | "lg";
    mobileAlign: "inherit" | "start" | "center" | "end";
    mobileVertical: "inherit" | "top" | "center" | "bottom";
    showBodyOnMobile: boolean;
  };
};

// Literal class maps (Tailwind needs complete class names). Phones use the
// mobile-specific value when set; tablet/desktop use the main one.
const ALIGN_MOBILE = { start: "items-start text-start", center: "items-center text-center", end: "items-end text-end" } as const;
const ALIGN_MD = { start: "md:items-start md:text-start", center: "md:items-center md:text-center", end: "md:items-end md:text-end" } as const;
const VERTICAL_MOBILE = { top: "justify-start pt-5", center: "justify-center", bottom: "justify-end pb-10" } as const;
const VERTICAL_MD = { top: "md:justify-start md:pt-14 md:pb-0", center: "md:justify-center md:py-0", bottom: "md:justify-end md:pb-20 md:pt-0" } as const;
const BUTTONS_MOBILE = { start: "justify-start", center: "justify-center", end: "justify-end" } as const;
const BUTTONS_MD = { start: "md:justify-start", center: "md:justify-center", end: "md:justify-end" } as const;
const HEADING = {
  sm: "text-xl md:text-4xl lg:text-5xl",
  md: "text-[1.6rem] md:text-5xl lg:text-6xl",
  lg: "text-[1.85rem] md:text-6xl lg:text-7xl",
} as const;

/**
 * Art-directed banner image: one <picture> per slide so each device downloads
 * only its own artwork (mobile -> tablet -> desktop fallbacks).
 */
function ArtPicture({ s, priority }: { s: SlideDTO; priority: boolean }) {
  const base = s.mobile ?? s.tablet ?? s.desktop;
  if (!base) return null;
  const set = (img: ImageDTO) => (img.srcSet.length ? img.srcSet.map((r) => `${r.url} ${r.w}w`).join(", ") : img.url);
  const desktop = s.desktop ?? s.tablet ?? base;
  const tablet = s.tablet ?? s.desktop ?? base;
  return (
    <picture className="absolute inset-0">
      <source media="(min-width: 1024px)" srcSet={set(desktop)} sizes="100vw" />
      <source media="(min-width: 768px)" srcSet={set(tablet)} sizes="100vw" />
      <img
        src={base.url}
        srcSet={set(base)}
        sizes="100vw"
        alt={base.alt}
        loading={priority ? "eager" : "lazy"}
        decoding={priority ? "sync" : "async"}
        fetchPriority={priority ? "high" : "auto"}
        className="size-full object-cover"
      />
    </picture>
  );
}

type Settings = { autoplay: boolean; interval: number; transition: "slide" | "fade"; loop: boolean; showArrows: boolean; showDots: boolean };

/**
 * Hero slider: swipe/drag (touch & mouse), arrows, dots, autoplay with pause
 * (stops on hover/focus and honours reduced motion), RTL-aware direction,
 * per-slide mobile artwork. First slide is the LCP image (eager, high priority).
 */
export function HeroSlider({ slides, settings, height, rounded }: { slides: SlideDTO[]; settings: Settings; height: "md" | "lg" | "screen"; rounded: boolean }) {
  const locale = useLocale();
  const t = useTranslations("common");
  const rtl = locale === "ar";
  const reduced = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  const [autoplay] = useState(() => Autoplay({ delay: settings.interval, stopOnInteraction: false, stopOnMouseEnter: true, stopOnFocusIn: true, playOnInit: settings.autoplay && !reduced }));
  const [emblaRef, embla] = useEmblaCarousel({ loop: settings.loop && slides.length > 1, direction: rtl ? "rtl" : "ltr", duration: 28 }, slides.length > 1 ? [autoplay, ...(settings.transition === "fade" ? [Fade()] : [])] : []);
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(settings.autoplay && !reduced);

  useEffect(() => {
    if (!embla) return;
    const onSelect = () => setIndex(embla.selectedScrollSnap());
    embla.on("select", onSelect);
    onSelect();
    return () => void embla.off("select", onSelect);
  }, [embla]);

  const toggle = useCallback(() => {
    const ap = embla?.plugins()?.autoplay;
    if (!ap) return;
    if (ap.isPlaying()) {
      ap.stop();
      setPlaying(false);
    } else {
      ap.play();
      setPlaying(true);
    }
  }, [embla]);

  // Landscape on every device (see lib/hero): compact on phones, wider on tablets and desktops.
  const heights = {
    md: "aspect-[16/11] md:aspect-[2/1] lg:aspect-[8/3] lg:max-h-[620px]",
    lg: "aspect-[16/11] md:aspect-[2/1] lg:aspect-[16/7] lg:max-h-[680px]",
    screen: "aspect-[16/11] md:aspect-auto md:h-[calc(100dvh-120px)] md:min-h-[520px]",
  }[height];
  if (!slides.length) return null;

  return (
    <div className={cn("group/hero relative", rounded && "container-store")} aria-roledescription="carousel">
      <div className={cn("overflow-hidden", rounded && "rounded-[calc(var(--nq-radius)*1.6)]")} ref={emblaRef}>
        <div className="flex touch-pan-y">
          {slides.map((s, i) => {
            const mAlign = s.style.mobileAlign === "inherit" ? s.style.align : s.style.mobileAlign;
            const mVertical = s.style.mobileVertical === "inherit" ? s.style.vertical : s.style.mobileVertical;
            const justify = cn(ALIGN_MOBILE[mAlign], ALIGN_MD[s.style.align]);
            const vertical = cn(VERTICAL_MOBILE[mVertical], VERTICAL_MD[s.style.vertical]);
            const active = i === index;
            const anim = s.style.animation === "none" ? "" : active ? (s.style.animation === "fade" ? "animate-fade-in" : s.style.animation === "zoom" ? "animate-scale-in" : "animate-fade-up") : "opacity-0";
            const btn = (variant: "primary" | "secondary") =>
              cn(
                "inline-flex h-10 items-center rounded-btn px-5 text-sm font-semibold transition hover:scale-[1.03] active:scale-[0.98] md:h-12 md:px-7 md:text-[15px]",
                variant === "primary"
                  ? s.style.buttonStyle === "glass"
                    ? "border border-white/30 bg-white/15 text-white backdrop-blur-md hover:bg-white/25"
                    : s.style.buttonStyle === "outline"
                      ? "border-2 border-current"
                      : "bg-white text-neutral-950 shadow-lg"
                  : "border border-current/40 hover:bg-white/10",
              );
            return (
              <div key={s.id} className={cn("relative min-w-0 shrink-0 grow-0 basis-full", heights)} role="group" aria-roledescription="slide" aria-label={`${i + 1} / ${slides.length}`} style={{ backgroundColor: s.style.background }}>
                <ArtPicture s={s} priority={i === 0} />
                <div className="absolute inset-0" style={{ backgroundColor: s.style.overlay, opacity: s.style.overlayOpacity / 100 }} aria-hidden />
                <div className={cn("relative flex h-full flex-col px-5 md:px-14", vertical, justify)} style={{ color: s.style.textColor }}>
                  <div key={active ? `a${index}` : "i"} className={cn("flex max-w-[85%] flex-col md:max-w-xl", justify, anim)}>
                    {s.eyebrow && <p className="mb-2 inline-flex rounded-full bg-white/12 px-2.5 py-0.5 text-[10.5px] font-semibold uppercase tracking-[0.14em] backdrop-blur md:mb-4 md:px-3 md:py-1 md:text-xs">{s.eyebrow}</p>}
                    {i === 0 ? (
                      <h1 className={cn("font-semibold leading-[1.08] tracking-[-0.03em] whitespace-pre-line text-balance", HEADING[s.style.headingSize])}>{s.heading}</h1>
                    ) : (
                      <h2 className={cn("font-semibold leading-[1.08] tracking-[-0.03em] whitespace-pre-line text-balance", HEADING[s.style.headingSize])}>{s.heading}</h2>
                    )}
                    {s.body && <p className={cn("mt-2 max-w-md text-sm leading-relaxed opacity-85 line-clamp-2 md:mt-5 md:line-clamp-none md:text-lg", !s.style.showBodyOnMobile && "max-md:hidden")}>{s.body}</p>}
                    {(s.primary || s.secondary) && (
                      <div className={cn("mt-4 flex flex-wrap gap-2.5 md:mt-8 md:gap-3", BUTTONS_MOBILE[mAlign], BUTTONS_MD[s.style.align])}>
                        {s.primary && (
                          <Link href={s.primary.href} className={btn("primary")} tabIndex={active ? 0 : -1}>
                            {s.primary.label}
                          </Link>
                        )}
                        {s.secondary && (
                          <Link href={s.secondary.href} className={cn(btn("secondary"), "max-sm:hidden")} tabIndex={active ? 0 : -1}>
                            {s.secondary.label}
                          </Link>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {slides.length > 1 && (
        <>
          {settings.showArrows && (
            <>
              <button type="button" onClick={() => embla?.scrollPrev()} className={cn("absolute start-4 top-1/2 hidden size-12 -translate-y-1/2 place-items-center rounded-full bg-white/15 text-white opacity-0 backdrop-blur-md transition hover:bg-white/30 group-hover/hero:opacity-100 focus-visible:opacity-100 md:grid", rounded && "start-8 md:start-12")} aria-label={t("previous")}>
                <ChevronLeft className="flip-rtl size-6" />
              </button>
              <button type="button" onClick={() => embla?.scrollNext()} className={cn("absolute end-4 top-1/2 hidden size-12 -translate-y-1/2 place-items-center rounded-full bg-white/15 text-white opacity-0 backdrop-blur-md transition hover:bg-white/30 group-hover/hero:opacity-100 focus-visible:opacity-100 md:grid", rounded && "end-8 md:end-12")} aria-label={t("next")}>
                <ChevronRight className="flip-rtl size-6" />
              </button>
            </>
          )}
          <div className={cn("absolute bottom-3 flex items-center gap-3 md:bottom-6", rounded ? "start-8 md:start-20" : "start-5 md:start-14")}>
            {settings.showDots && (
              <div className="flex items-center gap-2" role="tablist">
                {slides.map((s, i) => (
                  <button
                    key={s.id}
                    type="button"
                    role="tab"
                    aria-selected={i === index}
                    aria-label={`${i + 1}`}
                    onClick={() => embla?.scrollTo(i)}
                    className={cn("h-1.5 rounded-full bg-white/40 transition-all duration-500", i === index ? "w-8 bg-white" : "w-1.5 hover:bg-white/70")}
                  />
                ))}
              </div>
            )}
            {settings.autoplay && (
              <button type="button" onClick={toggle} className="grid size-7 place-items-center rounded-full text-white/80 hover:text-white" aria-label={playing ? "Pause" : "Play"}>
                {playing ? <Pause className="size-3.5" /> : <Play className="size-3.5" />}
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}

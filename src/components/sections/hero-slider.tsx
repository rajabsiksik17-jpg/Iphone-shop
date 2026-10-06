"use client";

import { useCallback, useEffect, useState } from "react";
import useEmblaCarousel from "embla-carousel-react";
import Autoplay from "embla-carousel-autoplay";
import Fade from "embla-carousel-fade";
import { ChevronLeft, ChevronRight, Pause, Play } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Picture } from "@/components/ui/picture";
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
  mobile: ImageDTO | null;
  style: { align: "start" | "center" | "end"; vertical: "top" | "center" | "bottom"; textColor: string; overlay: string; overlayOpacity: number; background: string; animation: "fade-up" | "fade" | "zoom" | "none"; buttonStyle: "solid" | "outline" | "glass" };
};

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

  const heights = { md: "h-[440px] md:h-[460px]", lg: "h-[560px] md:h-[600px]", screen: "h-[calc(100dvh-120px)] min-h-[520px]" }[height];
  if (!slides.length) return null;

  return (
    <div className={cn("group/hero relative", rounded && "container-store")} aria-roledescription="carousel">
      <div className={cn("overflow-hidden", rounded && "rounded-[calc(var(--nq-radius)*1.6)]")} ref={emblaRef}>
        <div className="flex touch-pan-y">
          {slides.map((s, i) => {
            const justify = s.style.align === "center" ? "items-center text-center" : s.style.align === "end" ? "items-end text-end" : "items-start text-start";
            const vertical = s.style.vertical === "top" ? "justify-start pt-16" : s.style.vertical === "bottom" ? "justify-end pb-20" : "justify-center";
            const active = i === index;
            const anim = s.style.animation === "none" ? "" : active ? (s.style.animation === "fade" ? "animate-fade-in" : s.style.animation === "zoom" ? "animate-scale-in" : "animate-fade-up") : "opacity-0";
            const btn = (variant: "primary" | "secondary") =>
              cn(
                "inline-flex h-12 items-center rounded-btn px-7 text-[15px] font-semibold transition hover:scale-[1.03] active:scale-[0.98]",
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
                {s.mobile && <Picture image={s.mobile} sizes="100vw" priority={i === 0} className="absolute inset-0 md:hidden" />}
                {s.desktop && <Picture image={s.desktop} sizes="100vw" priority={i === 0} className={cn("absolute inset-0", s.mobile && "max-md:hidden")} />}
                <div className="absolute inset-0" style={{ backgroundColor: s.style.overlay, opacity: s.style.overlayOpacity / 100 }} aria-hidden />
                <div className={cn("relative flex h-full flex-col px-6 md:px-14", vertical, justify)} style={{ color: s.style.textColor }}>
                  <div key={active ? `a${index}` : "i"} className={cn("max-w-xl", anim)}>
                    {s.eyebrow && <p className="mb-4 inline-flex rounded-full bg-white/12 px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] backdrop-blur">{s.eyebrow}</p>}
                    {i === 0 ? (
                      <h1 className="text-[2.4rem] font-semibold leading-[1.05] tracking-[-0.03em] whitespace-pre-line text-balance md:text-6xl">{s.heading}</h1>
                    ) : (
                      <h2 className="text-[2.4rem] font-semibold leading-[1.05] tracking-[-0.03em] whitespace-pre-line text-balance md:text-6xl">{s.heading}</h2>
                    )}
                    {s.body && <p className="mt-5 max-w-md text-[16px] leading-relaxed opacity-85 md:text-lg">{s.body}</p>}
                    {(s.primary || s.secondary) && (
                      <div className={cn("mt-8 flex flex-wrap gap-3", s.style.align === "center" && "justify-center", s.style.align === "end" && "justify-end")}>
                        {s.primary && (
                          <Link href={s.primary.href} className={btn("primary")} tabIndex={active ? 0 : -1}>
                            {s.primary.label}
                          </Link>
                        )}
                        {s.secondary && (
                          <Link href={s.secondary.href} className={btn("secondary")} tabIndex={active ? 0 : -1}>
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
          <div className={cn("absolute bottom-6 flex items-center gap-3", rounded ? "start-10 md:start-20" : "start-6 md:start-14")}>
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

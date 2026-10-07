"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import useEmblaCarousel from "embla-carousel-react";
import { useLocale, useTranslations } from "next-intl";
import { Expand, X } from "lucide-react";
import * as D from "@radix-ui/react-dialog";
import { Picture } from "@/components/ui/picture";
import { cn } from "@/lib/utils";
import type { ImageDTO } from "@/types/catalog";

/**
 * Product gallery: swipeable main image (touch + mouse drag), thumbnail rail,
 * keyboard arrows, and a full-screen zoom viewer. Selecting a colour elsewhere
 * on the page jumps to that colour's image via `activeIndex`.
 */
export function Gallery({ images, name, activeIndex, badges }: { images: ImageDTO[]; name: string; activeIndex?: number | null; badges?: React.ReactNode }) {
  const t = useTranslations("product");
  const locale = useLocale();
  const [emblaRef, embla] = useEmblaCarousel({ direction: locale === "ar" ? "rtl" : "ltr", loop: false });
  const [index, setIndex] = useState(0);
  const [zoom, setZoom] = useState(false);

  useEffect(() => {
    if (!embla) return;
    const onSelect = () => setIndex(embla.selectedScrollSnap());
    embla.on("select", onSelect);
    return () => void embla.off("select", onSelect);
  }, [embla]);

  useEffect(() => {
    if (embla && activeIndex != null && activeIndex >= 0) embla.scrollTo(activeIndex);
  }, [activeIndex, embla]);

  const go = useCallback((i: number) => embla?.scrollTo(i), [embla]);

  // Keep the active thumbnail visible in the rail (without scrolling the page).
  const railRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const rail = railRef.current;
    const el = rail?.querySelector<HTMLElement>('[aria-current="true"]');
    if (!rail || !el) return;
    const r = rail.getBoundingClientRect();
    const e = el.getBoundingClientRect();
    if (e.left < r.left) rail.scrollBy({ left: e.left - r.left - 8, behavior: "smooth" });
    else if (e.right > r.right) rail.scrollBy({ left: e.right - r.right + 8, behavior: "smooth" });
    if (e.top < r.top) rail.scrollBy({ top: e.top - r.top - 8, behavior: "smooth" });
    else if (e.bottom > r.bottom) rail.scrollBy({ top: e.bottom - r.bottom + 8, behavior: "smooth" });
  }, [index]);

  if (!images.length) return <div className="aspect-square rounded-[calc(var(--nq-radius)*1.4)] bg-surface" />;

  return (
    <div className="flex flex-col-reverse gap-3 lg:flex-row" aria-label={t("gallery")}>
      {images.length > 1 && (
        <div ref={railRef} className="no-scrollbar flex gap-2 overflow-x-auto lg:max-h-[600px] lg:w-20 lg:flex-col lg:overflow-y-auto">
          {images.map((img, i) => (
            <Thumb key={img.url + i} image={img} active={i === index} onClick={() => go(i)} label={`${i + 1} / ${images.length}`} className="size-16 rounded-xl lg:size-20" sizes="80px" />
          ))}
        </div>
      )}
      <div className="relative min-w-0 flex-1">
        <div
          className="overflow-hidden rounded-[calc(var(--nq-radius)*1.4)] bg-surface"
          ref={emblaRef}
          tabIndex={0}
          onKeyDown={(e) => {
            const rtl = locale === "ar";
            if (e.key === "ArrowRight") (rtl ? embla?.scrollPrev() : embla?.scrollNext());
            if (e.key === "ArrowLeft") (rtl ? embla?.scrollNext() : embla?.scrollPrev());
          }}
        >
          <div className="flex touch-pan-y">
            {images.map((img, i) => (
              <div key={img.url + i} className="relative aspect-square min-w-0 shrink-0 grow-0 basis-full">
                <Picture image={img} sizes="(min-width:1024px) 50vw, 100vw" priority={i === 0} className="size-full" alt={img.alt || name} />
              </div>
            ))}
          </div>
        </div>
        {badges && <div className="pointer-events-none absolute start-4 top-4">{badges}</div>}
        <button type="button" onClick={() => setZoom(true)} className="absolute end-4 top-4 grid size-10 place-items-center rounded-full bg-bg/90 shadow-sm ring-1 ring-black/5 backdrop-blur transition hover:scale-105" aria-label={t("zoom")}>
          <Expand className="size-4" />
        </button>
        {images.length > 1 && (
          <div className="absolute inset-x-0 bottom-4 flex justify-center gap-1.5 lg:hidden">
            {images.map((_, i) => (
              <span key={i} className={cn("h-1.5 rounded-full bg-fg/25 transition-all", i === index ? "w-5 bg-fg/70" : "w-1.5")} />
            ))}
          </div>
        )}
      </div>

      <D.Root open={zoom} onOpenChange={setZoom}>
        <D.Portal>
          <D.Overlay className="sheet-overlay fixed inset-0 z-[90] bg-bg" />
          <D.Content aria-describedby={undefined} className="fixed inset-0 z-[91] flex flex-col outline-none">
            <D.Title className="sr-only">{name}</D.Title>
            <div className="flex items-center justify-between p-4">
              <span className="tabular text-sm text-muted">
                {index + 1} / {images.length}
              </span>
              <D.Close className="grid size-11 place-items-center rounded-full hover:bg-surface" aria-label="Close">
                <X className="size-5" />
              </D.Close>
            </div>
            <div className="flex-1 overflow-auto">
              <img src={images[index]?.url} alt={images[index]?.alt || name} className="mx-auto max-h-none w-full max-w-5xl object-contain md:w-auto md:max-h-[calc(100dvh-140px)]" />
            </div>
            {/* safe center: centred when it fits, scrollable from the start when it doesn't. */}
            <div className="no-scrollbar flex gap-2 overflow-x-auto p-4 [justify-content:safe_center]">
              {images.map((img, i) => (
                <Thumb key={i} image={img} active={i === index} onClick={() => (setIndex(i), go(i))} label={`${i + 1} / ${images.length}`} className="size-14 rounded-lg" sizes="56px" />
              ))}
            </div>
          </D.Content>
        </D.Portal>
      </D.Root>
    </div>
  );
}

/**
 * Thumbnail button. The selected state is drawn inside the thumbnail (an
 * overlaid border with an inner gap) rather than as an outer ring, so a
 * scrolling rail can never clip it — at any size, edge or direction.
 */
function Thumb({ image, active, onClick, label, className, sizes }: { image: ImageDTO; active: boolean; onClick: () => void; label: string; className?: string; sizes: string }) {
  return (
    <button type="button" onClick={onClick} aria-label={label} aria-current={active} className={cn("relative shrink-0 overflow-hidden bg-surface transition focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent", active ? "opacity-100" : "opacity-65 hover:opacity-100", className)}>
      <Picture image={image} sizes={sizes} className="size-full" />
      <span aria-hidden className={cn("pointer-events-none absolute inset-0 rounded-[inherit] border-2 transition-colors", active ? "border-fg shadow-[inset_0_0_0_2px_var(--color-bg)]" : "border-transparent")} />
    </button>
  );
}

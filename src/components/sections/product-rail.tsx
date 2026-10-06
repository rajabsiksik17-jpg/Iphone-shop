"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useTranslations } from "next-intl";
import { ProductCard } from "@/components/store/product-card";
import { cn } from "@/lib/utils";
import type { ProductCardDTO } from "@/types/catalog";

/**
 * Horizontal product rail using native scroll-snap (swipe on touch, wheel /
 * trackpad on desktop) with RTL-aware arrow buttons. Light JS: only the arrows.
 */
export function ProductRail({ products }: { products: ProductCardDTO[] }) {
  const t = useTranslations("common");
  const ref = useRef<HTMLDivElement>(null);
  const [edges, setEdges] = useState({ start: true, end: false });

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => {
      const max = el.scrollWidth - el.clientWidth;
      const pos = Math.abs(el.scrollLeft); // negative in RTL
      setEdges({ start: pos < 8, end: pos > max - 8 });
    };
    update();
    el.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => {
      el.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, []);

  const scroll = (dir: 1 | -1) => {
    const el = ref.current;
    if (!el) return;
    const rtl = getComputedStyle(el).direction === "rtl";
    el.scrollBy({ left: dir * (rtl ? -1 : 1) * el.clientWidth * 0.85, behavior: "smooth" });
  };

  return (
    <div className="group/rail relative">
      <div ref={ref} className="no-scrollbar -mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto scroll-px-4 px-4 pb-2 sm:-mx-6 sm:gap-5 sm:scroll-px-6 sm:px-6 lg:mx-0 lg:scroll-px-0 lg:px-0">
        {products.map((p) => (
          <div key={p.id} className="w-[46%] shrink-0 snap-start sm:w-[31%] lg:w-[calc((100%-3*1.25rem)/4)] xl:w-[calc((100%-4*1.25rem)/5)]">
            <ProductCard product={p} />
          </div>
        ))}
      </div>
      {[-1, 1].map((d) => (
        <button
          key={d}
          type="button"
          onClick={() => scroll(d as 1 | -1)}
          disabled={d === -1 ? edges.start : edges.end}
          className={cn(
            "absolute top-[38%] z-10 hidden size-11 -translate-y-1/2 place-items-center rounded-full bg-bg shadow-pop ring-1 ring-border transition hover:scale-105 disabled:pointer-events-none disabled:opacity-0 lg:grid",
            d === -1 ? "-start-5" : "-end-5",
          )}
          aria-label={d === -1 ? t("previous") : t("next")}
        >
          {d === -1 ? <ChevronLeft className="flip-rtl size-5" /> : <ChevronRight className="flip-rtl size-5" />}
        </button>
      ))}
    </div>
  );
}

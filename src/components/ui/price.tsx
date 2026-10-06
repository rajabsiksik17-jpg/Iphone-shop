"use client";

import { useTranslations } from "next-intl";
import { useStore } from "@/components/providers/store-context";
import { cn } from "@/lib/utils";
import type { PriceDTO } from "@/types/catalog";

/**
 * Price display: current price, struck-through regular price and savings.
 * The sale presentation is clear but restrained (no flashing, no fake urgency).
 */
export function Price({ price, size = "md", showSavings = false, className, range = true }: { price: PriceDTO; size?: "sm" | "md" | "lg" | "xl"; showSavings?: boolean; className?: string; range?: boolean }) {
  const { format } = useStore();
  const t = useTranslations();
  const sizes = { sm: "text-sm", md: "text-[15px]", lg: "text-xl", xl: "text-3xl" };
  const showFrom = range && price.min !== price.max;
  return (
    <div className={cn("flex flex-wrap items-baseline gap-x-2 gap-y-0.5", className)}>
      {showFrom && <span className="text-xs text-muted">{t("common.from")}</span>}
      <span className={cn("tabular font-semibold tracking-tight", sizes[size], price.onSale && "text-sale")}>{format(price.current)}</span>
      {price.onSale && price.regular > price.current && (
        <s className={cn("tabular text-muted decoration-muted/60", size === "xl" ? "text-lg" : "text-[0.85em]")} aria-label={`${format(price.regular)}`}>
          {format(price.regular)}
        </s>
      )}
      {showSavings && price.onSale && price.savings > 0 && (
        <span className="rounded-full bg-sale/10 px-2 py-0.5 text-xs font-semibold text-sale">
          {t("product.save", { amount: format(price.savings) })} · {t("product.off", { percent: price.percent })}
        </span>
      )}
    </div>
  );
}

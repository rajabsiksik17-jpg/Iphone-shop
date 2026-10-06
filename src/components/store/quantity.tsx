"use client";

import { Minus, Plus } from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";

export function QuantityStepper({ value, onChange, min = 1, max = 99, size = "md", disabled }: { value: number; onChange: (v: number) => void; min?: number; max?: number; size?: "sm" | "md"; disabled?: boolean }) {
  const t = useTranslations("product");
  const h = size === "sm" ? "h-9" : "h-12";
  const w = size === "sm" ? "w-8" : "w-11";
  return (
    <div className={cn("inline-flex items-center rounded-full border border-border bg-bg", h, disabled && "opacity-60")}>
      <button type="button" className={cn("grid h-full place-items-center rounded-s-full text-fg/80 transition hover:bg-surface disabled:opacity-35", w)} onClick={() => onChange(Math.max(min, value - 1))} disabled={disabled || value <= min} aria-label={t("decrease")}>
        <Minus className="size-4" />
      </button>
      <input
        className={cn("tabular h-full w-9 bg-transparent text-center text-sm font-semibold outline-none", size === "md" && "w-10")}
        value={value}
        inputMode="numeric"
        aria-label={t("quantity")}
        disabled={disabled}
        onChange={(e) => {
          const n = Number(e.target.value.replace(/\D/g, ""));
          if (Number.isFinite(n) && n >= min) onChange(Math.min(max, n));
        }}
      />
      <button type="button" className={cn("grid h-full place-items-center rounded-e-full text-fg/80 transition hover:bg-surface disabled:opacity-35", w)} onClick={() => onChange(Math.min(max, value + 1))} disabled={disabled || value >= max} aria-label={t("increase")}>
        <Plus className="size-4" />
      </button>
    </div>
  );
}

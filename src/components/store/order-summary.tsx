"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Tag, X, Coins } from "lucide-react";
import { toast } from "sonner";
import { Picture } from "@/components/ui/picture";
import { Button } from "@/components/ui/button";
import { useStore } from "@/components/providers/store-context";
import { useCart } from "./cart-provider";
import { cn } from "@/lib/utils";
import type { CartTotals } from "@/server/commerce/cart";

export function CouponBox({ totals }: { totals: CartTotals }) {
  const t = useTranslations("cart");
  const tc = useTranslations("common");
  const { applyCoupon } = useCart();
  const [code, setCode] = useState("");
  const [pending, setPending] = useState(false);
  const apply = async (value: string | null) => {
    setPending(true);
    const res = await applyCoupon(value);
    setPending(false);
    if (!res) return;
    if (value && res.coupon && !res.coupon.valid) toast.error(t(`couponErrors.${res.coupon.reason ?? "inactive"}`));
    else if (value) {
      toast.success(t("couponApplied"));
      setCode("");
    } else toast(t("couponRemoved"));
  };
  if (totals.coupon?.valid)
    return (
      <div className="flex items-center justify-between rounded-xl bg-success/8 px-3.5 py-2.5 text-sm">
        <span className="flex items-center gap-2 font-medium text-success">
          <Tag className="size-4" /> {totals.coupon.code}
        </span>
        <button type="button" onClick={() => apply(null)} className="grid size-7 place-items-center rounded-full text-muted hover:bg-bg hover:text-fg" aria-label={t("remove")}>
          <X className="size-4" />
        </button>
      </div>
    );
  return (
    // Not a <form>: it is also rendered inside the checkout form (nested forms are invalid HTML).
    <div className="flex gap-2">
      <label htmlFor="coupon" className="sr-only">
        {t("coupon")}
      </label>
      <input id="coupon" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder={t("couponPlaceholder")}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            if (code.trim()) void apply(code.trim());
          }
        }}
        className="h-11 min-w-0 flex-1 rounded-xl border border-border bg-bg px-3.5 text-sm uppercase tracking-wide outline-none placeholder:normal-case placeholder:tracking-normal focus:border-accent" autoComplete="off" />
      <Button type="button" variant="outline" size="sm" className="h-11" loading={pending} onClick={() => code.trim() && void apply(code.trim())}>
        {tc("apply")}
      </Button>
    </div>
  );
}

export function PointsBox({ totals }: { totals: CartTotals }) {
  const t = useTranslations("cart");
  const { format } = useStore();
  const { usePoints } = useCart();
  const p = totals.points;
  if (!p.enabled || p.balance <= 0 || p.maxUsable <= 0) return null;
  const on = p.using > 0;
  return (
    <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-border px-3.5 py-3 text-sm">
      <Coins className="size-4 shrink-0 text-amber-500" />
      <span className="flex-1">
        <span className="block font-medium">{t("points")}</span>
        <span className="block text-xs text-muted">{on ? t("pointsUsing", { points: p.using }) : t("pointsAvailable", { points: p.balance, value: format(p.maxUsable * p.pointValue) })}</span>
      </span>
      <input type="checkbox" checked={on} onChange={(e) => usePoints(e.target.checked ? p.maxUsable : 0)} className="size-5 accent-[var(--color-accent)]" />
    </label>
  );
}

export function SummaryLines({ totals, shipping, compact }: { totals: CartTotals; shipping?: number | null; compact?: boolean }) {
  const t = useTranslations("cart");
  const tc = useTranslations("common");
  const { format } = useStore();
  const grand = totals.total + (shipping ?? 0);
  const row = "flex items-center justify-between gap-4";
  return (
    <dl className="space-y-2.5 text-sm">
      <div className={row}>
        <dt className="text-muted">{t("subtotal")}</dt>
        <dd className="tabular font-medium">{format(totals.subtotal)}</dd>
      </div>
      {totals.discounts.map((d) => (
        <div key={d.couponId} className={cn(row, "text-success")}>
          <dt className="flex items-center gap-1.5">
            <Tag className="size-3.5" /> {d.label}
          </dt>
          <dd className="tabular">-{format(d.amount)}</dd>
        </div>
      ))}
      {totals.points.value > 0 && (
        <div className={cn(row, "text-success")}>
          <dt className="flex items-center gap-1.5">
            <Coins className="size-3.5" /> {t("pointsUsing", { points: totals.points.using })}
          </dt>
          <dd className="tabular">-{format(totals.points.value)}</dd>
        </div>
      )}
      <div className={row}>
        <dt className="text-muted">{t("shipping")}</dt>
        <dd className="tabular">{shipping == null ? <span className="text-muted">{t("shippingAtCheckout")}</span> : shipping === 0 ? <span className="font-medium text-success">{tc("free")}</span> : format(shipping)}</dd>
      </div>
      {totals.tax.enabled && !totals.tax.included && (
        <div className={row}>
          <dt className="text-muted">{totals.tax.label}</dt>
          <dd className="tabular">{format(totals.tax.amount)}</dd>
        </div>
      )}
      <div className={cn(row, "border-t border-border pt-3.5")}>
        <dt className="text-base font-semibold">{t("total")}</dt>
        <dd className="tabular text-xl font-semibold">{format(grand)}</dd>
      </div>
      {totals.tax.enabled && totals.tax.included && totals.tax.amount > 0 && <p className="text-end text-xs text-muted">{t("taxIncluded", { amount: format(totals.tax.amount), label: totals.tax.label })}</p>}
      {!compact && totals.compareAtSubtotal > totals.subtotal - totals.discountTotal && (
        <p className="rounded-xl bg-success/8 px-3 py-2 text-center text-xs font-medium text-success">{t("youSave", { amount: format(totals.compareAtSubtotal - totals.subtotal + totals.discountTotal + totals.points.value) })}</p>
      )}
      {totals.points.enabled && totals.points.earnable > 0 && <p className="text-center text-xs text-muted">{t("pointsEarn", { points: totals.points.earnable })}</p>}
    </dl>
  );
}

export function MiniLines({ totals }: { totals: CartTotals }) {
  const { format } = useStore();
  return (
    <ul className="space-y-3">
      {totals.lines.map((l) => (
        <li key={l.id} className="flex items-center gap-3">
          <div className="relative shrink-0">
            <Picture image={l.image} sizes="56px" className="size-14 rounded-xl bg-surface" />
            <span className="absolute -end-1.5 -top-1.5 grid min-w-5 place-items-center rounded-full bg-fg px-1 text-[10px] font-semibold leading-5 text-bg">{l.quantity}</span>
          </div>
          <div className="min-w-0 flex-1">
            <p className="line-clamp-1 text-sm font-medium">{l.name}</p>
            {l.variantLabel && <p className="text-xs text-muted">{l.variantLabel}</p>}
          </div>
          <span className="tabular text-sm font-medium">{format(l.lineTotal)}</span>
        </li>
      ))}
    </ul>
  );
}

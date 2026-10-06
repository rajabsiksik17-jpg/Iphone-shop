"use client";

import { useEffect } from "react";
import { useTranslations } from "next-intl";
import { Lock, ShoppingBag, Trash2, AlertCircle, ShieldCheck, Truck, RotateCcw } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Picture } from "@/components/ui/picture";
import { EmptyState } from "@/components/ui/misc";
import { Skeleton } from "@/components/ui/spinner";
import { useStore } from "@/components/providers/store-context";
import { useCart } from "./cart-provider";
import { QuantityStepper } from "./quantity";
import { FreeShippingMeter } from "./cart-drawer";
import { CouponBox, PointsBox, SummaryLines } from "./order-summary";
import { cn } from "@/lib/utils";
import type { CartTotals } from "@/server/commerce/cart";

export function CartPageView({ initial }: { initial: CartTotals }) {
  const t = useTranslations();
  const { format } = useStore();
  const { totals: live, refresh, update, remove, pending } = useCart();
  useEffect(() => {
    if (!live) void refresh();
  }, [live, refresh]);
  const totals = live ?? initial;

  if (!totals.lines.length)
    return (
      <EmptyState
        icon={<ShoppingBag />}
        title={t("cart.empty")}
        text={t("cart.emptyHint")}
        action={
          <Button asChild size="lg">
            <Link href="/shop">{t("cart.startShopping")}</Link>
          </Button>
        }
        className="py-24"
      />
    );

  return (
    <div className="grid grid-cols-1 gap-10 lg:grid-cols-[minmax(0,1fr)_400px]">
      <div>
        <FreeShippingMeter subtotal={totals.subtotal - totals.discountTotal} threshold={totals.freeShippingThreshold} className="mb-6" />
        <ul className="divide-y divide-border border-y border-border">
          {totals.lines.map((l) => (
            <li key={l.id} className={cn("flex gap-4 py-5 transition-opacity sm:gap-6", pending.has(l.id) && "opacity-60")}>
              <Link href={`/product/${l.slug}`} className="shrink-0">
                <Picture image={l.image} sizes="128px" className="size-24 rounded-2xl bg-surface sm:size-32" />
              </Link>
              <div className="flex min-w-0 flex-1 flex-col">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    {l.brand && <p className="text-[11px] font-semibold uppercase tracking-wider text-muted">{l.brand}</p>}
                    <Link href={`/product/${l.slug}`} className="font-medium leading-snug hover:underline">
                      {l.name}
                    </Link>
                    {l.options.length > 0 && (
                      <p className="mt-1 text-sm text-muted">
                        {l.options.map((o) => (
                          <span key={o.label} className="me-3">
                            {o.label}: {o.value}
                          </span>
                        ))}
                      </p>
                    )}
                  </div>
                  <div className="text-end">
                    <p className="tabular font-semibold">{format(l.lineTotal)}</p>
                    {l.quantity > 1 && <p className="tabular text-xs text-muted">{format(l.unitPrice)} × {l.quantity}</p>}
                    {l.onSale && <s className="tabular text-xs text-muted">{format(l.regularUnitPrice * l.quantity)}</s>}
                  </div>
                </div>
                {l.issue && (
                  <p className="mt-2 flex items-center gap-1.5 text-sm font-medium text-red-600">
                    <AlertCircle className="size-4" />
                    {t(`cart.issues.${l.issue}`, { max: l.maxQty })}
                  </p>
                )}
                <div className="mt-auto flex items-center justify-between pt-3">
                  <QuantityStepper size="sm" value={l.quantity} max={Math.max(1, l.maxQty)} onChange={(q) => update(l.id, q)} disabled={pending.has(l.id) || l.issue === "unavailable"} />
                  <button type="button" onClick={() => remove(l.id)} className="flex items-center gap-1.5 text-sm text-muted hover:text-red-600">
                    <Trash2 className="size-4" /> {t("cart.remove")}
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
        <Link href="/shop" className="mt-6 inline-block text-sm font-medium text-muted hover:text-fg">
          ← {t("cart.continueShopping")}
        </Link>
      </div>

      <aside className="lg:sticky lg:top-32 lg:self-start">
        <div className="space-y-5 rounded-[calc(var(--nq-radius)*1.4)] border border-border bg-bg p-6">
          <h2 className="text-lg font-semibold">{t("checkout.summary")}</h2>
          <CouponBox totals={totals} />
          <PointsBox totals={totals} />
          <SummaryLines totals={totals} />
          <Button asChild size="lg" block disabled={totals.hasIssues}>
            <Link href="/checkout" aria-disabled={totals.hasIssues}>
              <Lock /> {t("cart.checkout")}
            </Link>
          </Button>
        </div>
        <ul className="mt-5 space-y-3 text-sm text-muted">
          <li className="flex items-center gap-3">
            <ShieldCheck className="size-4" /> {t("product.genuine")}
          </li>
          <li className="flex items-center gap-3">
            <RotateCcw className="size-4" /> {t("product.returns")}
          </li>
          <li className="flex items-center gap-3">
            <Truck className="size-4" /> {t("product.securePay")}
          </li>
        </ul>
      </aside>
    </div>
  );
}

export function CartSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-10 lg:grid-cols-[minmax(0,1fr)_400px]">
      <div className="space-y-6">
        {[0, 1].map((i) => (
          <div key={i} className="flex gap-6">
            <Skeleton className="size-32 rounded-2xl" />
            <div className="flex-1 space-y-3">
              <Skeleton className="h-5 w-2/3" />
              <Skeleton className="h-4 w-1/3" />
            </div>
          </div>
        ))}
      </div>
      <Skeleton className="h-80 rounded-3xl" />
    </div>
  );
}

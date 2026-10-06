"use client";

import { useEffect } from "react";
import { useTranslations } from "next-intl";
import { ShoppingBag, Trash2, Truck, Lock, AlertCircle } from "lucide-react";
import { Sheet } from "@/components/ui/overlay";
import { Button } from "@/components/ui/button";
import { Picture } from "@/components/ui/picture";
import { EmptyState } from "@/components/ui/misc";
import { Skeleton } from "@/components/ui/spinner";
import { Link } from "@/i18n/navigation";
import { useStore } from "@/components/providers/store-context";
import { useCart } from "./cart-provider";
import { QuantityStepper } from "./quantity";
import { cn } from "@/lib/utils";

export function FreeShippingMeter({ subtotal, threshold, className }: { subtotal: number; threshold: number | null; className?: string }) {
  const t = useTranslations("cart");
  const { format } = useStore();
  if (!threshold) return null;
  const remaining = Math.max(0, threshold - subtotal);
  const pct = Math.min(100, (subtotal / threshold) * 100);
  return (
    <div className={cn("rounded-2xl bg-surface p-3.5", className)}>
      <p className="flex items-center gap-2 text-sm">
        <Truck className={cn("size-4 shrink-0", remaining === 0 ? "text-success" : "text-muted")} />
        {remaining === 0 ? <span className="font-medium text-success">{t("freeShippingUnlocked")}</span> : t.rich("freeShippingProgress", { amount: () => <strong className="font-semibold">{format(remaining)}</strong> })}
      </p>
      <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-border" role="progressbar" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100}>
        <div className={cn("h-full rounded-full transition-[width] duration-700 ease-out", remaining === 0 ? "bg-success" : "bg-accent")} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export function CartDrawer() {
  const t = useTranslations();
  const { cartOpen, setCartOpen, format, cartCount } = useStore();
  const { totals, loading, refresh, update, remove, pending } = useCart();

  useEffect(() => {
    if (cartOpen && !totals) void refresh();
  }, [cartOpen, totals, refresh]);

  const empty = totals && totals.lines.length === 0;
  return (
    <Sheet
      open={cartOpen}
      onOpenChange={setCartOpen}
      title={
        <span className="flex items-center gap-2">
          {t("cart.title")}
          {cartCount > 0 && <span className="rounded-full bg-surface px-2 py-0.5 text-xs font-semibold text-muted">{cartCount}</span>}
        </span>
      }
      closeLabel={t("common.close")}
      footer={
        totals && !empty ? (
          <div className="space-y-3">
            {totals.discountTotal > 0 && (
              <div className="flex justify-between text-sm text-success">
                <span>{t("cart.discount")}</span>
                <span className="tabular">-{format(totals.discountTotal)}</span>
              </div>
            )}
            <div className="flex items-baseline justify-between">
              <span className="text-sm text-muted">{t("cart.subtotal")}</span>
              <span className="tabular text-lg font-semibold">{format(totals.subtotal - totals.discountTotal)}</span>
            </div>
            <p className="text-xs text-muted">{t("cart.shippingAtCheckout")}</p>
            <div className="grid grid-cols-2 gap-2">
              <Button asChild variant="outline" onClick={() => setCartOpen(false)}>
                <Link href="/cart">{t("cart.viewCart")}</Link>
              </Button>
              <Button asChild disabled={totals.hasIssues} onClick={() => setCartOpen(false)}>
                <Link href="/checkout">
                  <Lock className="size-4" />
                  {t("cart.checkout")}
                </Link>
              </Button>
            </div>
            <button type="button" onClick={() => setCartOpen(false)} className="w-full py-1 text-center text-sm text-muted underline-offset-4 hover:text-fg hover:underline">
              {t("cart.continueShopping")}
            </button>
          </div>
        ) : null
      }
    >
      {!totals && loading && (
        <div className="space-y-4 p-5">
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex gap-4">
              <Skeleton className="size-20 rounded-xl" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/3" />
                <Skeleton className="h-8 w-28 rounded-full" />
              </div>
            </div>
          ))}
        </div>
      )}
      {empty && (
        <EmptyState
          icon={<ShoppingBag />}
          title={t("cart.empty")}
          text={t("cart.emptyHint")}
          action={
            <Button asChild onClick={() => setCartOpen(false)}>
              <Link href="/shop">{t("cart.startShopping")}</Link>
            </Button>
          }
        />
      )}
      {totals && !empty && (
        <div className="space-y-4 p-5">
          <FreeShippingMeter subtotal={totals.subtotal - totals.discountTotal} threshold={totals.freeShippingThreshold} />
          <ul className="divide-y divide-border">
            {totals.lines.map((line) => (
              <li key={line.id} className={cn("flex gap-4 py-4 transition-opacity first:pt-0", pending.has(line.id) && "opacity-60")}>
                <Link href={`/product/${line.slug}`} onClick={() => setCartOpen(false)} className="shrink-0">
                  <Picture image={line.image} sizes="80px" className="size-20 rounded-xl bg-surface" />
                </Link>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <Link href={`/product/${line.slug}`} onClick={() => setCartOpen(false)} className="line-clamp-2 text-sm font-medium leading-snug hover:underline">
                        {line.name}
                      </Link>
                      {line.variantLabel && <p className="mt-0.5 text-xs text-muted">{line.variantLabel}</p>}
                    </div>
                    <button type="button" onClick={() => remove(line.id)} className="-me-1 -mt-1 grid size-8 shrink-0 place-items-center rounded-full text-muted transition hover:bg-surface hover:text-red-600" aria-label={`${t("cart.remove")} ${line.name}`}>
                      <Trash2 className="size-4" />
                    </button>
                  </div>
                  {line.issue && (
                    <p className="mt-1.5 flex items-center gap-1.5 text-xs font-medium text-red-600">
                      <AlertCircle className="size-3.5" />
                      {t(`cart.issues.${line.issue}`, { max: line.maxQty })}
                    </p>
                  )}
                  <div className="mt-2.5 flex items-center justify-between gap-2">
                    <QuantityStepper size="sm" value={line.quantity} max={Math.max(1, line.maxQty)} onChange={(q) => update(line.id, q)} disabled={pending.has(line.id) || line.issue === "unavailable"} />
                    <div className="text-end">
                      <p className="tabular text-sm font-semibold">{format(line.lineTotal)}</p>
                      {line.onSale && <s className="tabular text-xs text-muted">{format(line.regularUnitPrice * line.quantity)}</s>}
                    </div>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Sheet>
  );
}

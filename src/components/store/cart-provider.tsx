"use client";

import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from "react";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import { useStore } from "@/components/providers/store-context";
import { addToCartAction, applyCouponAction, getCartAction, removeCartItemAction, updateCartItemAction, usePointsAction } from "@/actions/cart";
import { useErrorMessage } from "@/lib/use-action";
import { track } from "@/lib/analytics-client";
import type { CartTotals } from "@/server/commerce/cart";
import type { ActionResult } from "@/server/errors";

type CartCtx = {
  totals: CartTotals | null;
  loading: boolean;
  pending: Set<string>;
  lastAdded: { name: string; image: string | null } | null;
  refresh: () => Promise<void>;
  add: (input: { productId: string; variantId?: string | null; quantity?: number; name: string; price: number; brand?: string | null; category?: string | null; openDrawer?: boolean }) => Promise<boolean>;
  update: (itemId: string, quantity: number) => Promise<void>;
  remove: (itemId: string) => Promise<void>;
  applyCoupon: (code: string | null) => Promise<CartTotals | null>;
  usePoints: (points: number) => Promise<void>;
};

const Ctx = createContext<CartCtx | null>(null);

export function CartProvider({ children }: { children: ReactNode }) {
  const locale = useLocale();
  const t = useTranslations();
  const errorMessage = useErrorMessage();
  const { setCartCount, setCartOpen } = useStore();
  const [totals, setTotals] = useState<CartTotals | null>(null);
  const [loading, setLoading] = useState(false);
  const [pending, setPending] = useState<Set<string>>(new Set());
  const [lastAdded, setLastAdded] = useState<CartCtx["lastAdded"]>(null);
  const inflight = useRef<Promise<void> | null>(null);

  const apply = useCallback(
    (res: ActionResult<CartTotals>) => {
      if (res.ok) {
        setTotals(res.data);
        setCartCount(res.data.itemCount);
        return res.data;
      }
      toast.error(errorMessage(res));
      return null;
    },
    [setCartCount, errorMessage],
  );

  const refresh = useCallback(async () => {
    if (inflight.current) return inflight.current;
    setLoading(true);
    inflight.current = getCartAction(locale)
      .then((r) => void apply(r))
      .finally(() => {
        setLoading(false);
        inflight.current = null;
      });
    return inflight.current;
  }, [locale, apply]);

  const mark = (id: string, on: boolean) =>
    setPending((p) => {
      const n = new Set(p);
      if (on) n.add(id);
      else n.delete(id);
      return n;
    });

  const add: CartCtx["add"] = useCallback(
    async ({ productId, variantId, quantity = 1, name, price, brand, category, openDrawer = true }) => {
      const res = await addToCartAction({ productId, variantId: variantId ?? null, quantity, locale });
      const data = apply(res);
      if (!data) return false;
      const line = data.lines.find((l) => l.productId === productId && l.variantId === (variantId ?? null));
      setLastAdded({ name, image: line?.image?.url ?? null });
      track.addToCart({ id: productId, name, price, quantity, brand, category, variant: line?.variantLabel });
      if (openDrawer) setCartOpen(true);
      else toast.success(t("product.added"));
      return true;
    },
    [locale, apply, setCartOpen, t],
  );

  const update = useCallback(
    async (itemId: string, quantity: number) => {
      mark(itemId, true);
      // Optimistic quantity update for instant feedback.
      setTotals((prev) => (prev ? { ...prev, lines: prev.lines.map((l) => (l.id === itemId ? { ...l, quantity } : l)) } : prev));
      apply(await updateCartItemAction({ itemId, quantity, locale }));
      mark(itemId, false);
    },
    [locale, apply],
  );

  const remove = useCallback(
    async (itemId: string) => {
      const line = totals?.lines.find((l) => l.id === itemId);
      mark(itemId, true);
      const data = apply(await removeCartItemAction({ itemId, locale }));
      mark(itemId, false);
      if (data && line) {
        track.removeFromCart({ id: line.productId, name: line.name, price: line.unitPrice, quantity: line.quantity });
        toast(t("cart.removed"), {
          action: {
            label: t("cart.undo"),
            onClick: () => void add({ productId: line.productId, variantId: line.variantId, quantity: line.quantity, name: line.name, price: line.unitPrice, openDrawer: false }),
          },
        });
      }
    },
    [locale, apply, totals, t, add],
  );

  const applyCoupon = useCallback(async (code: string | null) => apply(await applyCouponAction({ code, locale })), [locale, apply]);
  const usePoints = useCallback(async (points: number) => void apply(await usePointsAction({ points, locale })), [locale, apply]);

  return <Ctx.Provider value={{ totals, loading, pending, lastAdded, refresh, add, update, remove, applyCoupon, usePoints }}>{children}</Ctx.Provider>;
}

export function useCart() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useCart must be used inside CartProvider");
  return v;
}

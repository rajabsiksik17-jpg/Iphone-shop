"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { formatMoney, type MoneyContext } from "@/lib/money";

export type StoreConfig = {
  locale: "ar" | "en";
  storeName: string;
  money: MoneyContext;
  currencies: { code: string; symbol: string; name: string }[];
  user: { id: string; name: string; email: string } | null;
  defaultCountry: string;
  detectedCountry: string | null;
  card: { style: "minimal" | "bordered" | "elevated"; imageRatio: "1/1" | "4/5" | "3/4"; showBrand: boolean; showRating: boolean; quickAdd: boolean; hoverSecondImage: boolean };
  badges: { new: string; sale: string; bestSeller: string; limited: string; lowStock: string; outOfStock: string; showNew: boolean; showSale: boolean; showBestSeller: boolean; showLowStock: boolean; salePercent: boolean };
  freeShippingThreshold: number | null;
  analytics: { gaId: string | null; metaPixelId: string | null; tiktokPixel: string | null; requireConsent: boolean; firstParty: boolean; consentBanner: boolean; trackEcommerce: boolean };
  chat: { enabled: boolean };
};

type StoreState = StoreConfig & {
  format: (minor: number, opts?: { trimZeros?: boolean }) => string;
  cartCount: number;
  setCartCount: (n: number) => void;
  cartOpen: boolean;
  setCartOpen: (o: boolean) => void;
  wishlist: Set<string>;
  setWishlist: (ids: string[]) => void;
  toggleWishlistLocal: (id: string, on: boolean) => void;
  chatOpen: boolean;
  setChatOpen: (o: boolean) => void;
};

const Ctx = createContext<StoreState | null>(null);

export function StoreProvider({ config, initialCartCount, initialWishlist, children }: { config: StoreConfig; initialCartCount: number; initialWishlist: string[]; children: ReactNode }) {
  const [cartCount, setCartCount] = useState(initialCartCount);
  const [cartOpen, setCartOpen] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [wishlist, setWishlistState] = useState(() => new Set(initialWishlist));
  const setWishlist = useCallback((ids: string[]) => setWishlistState(new Set(ids)), []);
  const toggleWishlistLocal = useCallback((id: string, on: boolean) => {
    setWishlistState((prev) => {
      const next = new Set(prev);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });
  }, []);
  // Whole amounts drop their zero fraction ("1,109 JOD" rather than "1,109.000 JOD").
  const format = useCallback((minor: number, opts?: { trimZeros?: boolean }) => formatMoney(minor, config.money, { trimZeros: opts?.trimZeros ?? true }), [config.money]);

  const value = useMemo<StoreState>(
    () => ({ ...config, format, cartCount, setCartCount, cartOpen, setCartOpen, wishlist, setWishlist, toggleWishlistLocal, chatOpen, setChatOpen }),
    [config, format, cartCount, cartOpen, wishlist, setWishlist, toggleWishlistLocal, chatOpen],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useStore() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useStore must be used inside StoreProvider");
  return v;
}

/** Same hook but tolerant of being rendered outside the storefront (e.g. admin previews). */
export function useOptionalStore() {
  return useContext(Ctx);
}

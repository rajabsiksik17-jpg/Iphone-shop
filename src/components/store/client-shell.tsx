"use client";

import { useEffect, type ReactNode } from "react";
import { TooltipProvider } from "@/components/ui/menu";
import { StoreProvider, useStore, type StoreConfig } from "@/components/providers/store-context";
import { CartProvider } from "./cart-provider";
import { CartDrawer } from "./cart-drawer";
import { guestWishlist } from "@/lib/local-store";
import { mergeWishlistAction, trackAction } from "@/actions/store";
import { usePathname } from "@/i18n/navigation";

function WishlistSync() {
  const { user, setWishlist, wishlist } = useStore();
  useEffect(() => {
    const local = guestWishlist.get();
    if (!user) {
      if (local.length) setWishlist(local);
      return;
    }
    // Just signed in with a guest list: merge it into the account once.
    if (local.length) {
      mergeWishlistAction(local).then((r) => {
        if (r.ok) {
          setWishlist(r.data);
          guestWishlist.clear();
        }
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);
  void wishlist;
  return null;
}

/** Leaving the admin via client navigation must restore the storefront theme. */
function ResetAdminMode() {
  useEffect(() => {
    document.documentElement.classList.remove("admin-mode", "ad-dark");
  }, []);
  return null;
}

function PageViews() {
  const pathname = usePathname();
  const { analytics } = useStore();
  useEffect(() => {
    if (!analytics.firstParty) return;
    const t = setTimeout(() => trackAction("PAGE_VIEW", { path: pathname }).catch(() => {}), 300);
    return () => clearTimeout(t);
  }, [pathname, analytics.firstParty]);
  return null;
}

export function ClientShell({ config, cartCount, wishlist, children }: { config: StoreConfig; cartCount: number; wishlist: string[]; children: ReactNode }) {
  return (
    <StoreProvider config={config} initialCartCount={cartCount} initialWishlist={wishlist}>
      <TooltipProvider>
        <CartProvider>
          <ResetAdminMode />
          <WishlistSync />
          <PageViews />
          {children}
          <CartDrawer />
        </CartProvider>
      </TooltipProvider>
    </StoreProvider>
  );
}

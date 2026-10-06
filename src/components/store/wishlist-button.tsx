"use client";

import { useState, useTransition } from "react";
import { Heart } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { useStore } from "@/components/providers/store-context";
import { toggleWishlistAction } from "@/actions/store";
import { Link, useRouter } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import { guestWishlist } from "@/lib/local-store";

/**
 * Optimistic heart: instant fill + pop animation, then persist (account) or
 * store locally (guest, merged on sign-in). Rolls back if the server refuses.
 */
export function WishlistButton({ productId, className, size = "md" }: { productId: string; className?: string; size?: "sm" | "md" | "lg" }) {
  const t = useTranslations("product");
  const { wishlist, toggleWishlistLocal, user } = useStore();
  const active = wishlist.has(productId);
  const [anim, setAnim] = useState(false);
  const [, start] = useTransition();
  const router = useRouter();

  const toggle = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const next = !active;
    toggleWishlistLocal(productId, next);
    if (next) setAnim(true);
    if (!user) guestWishlist.toggle(productId, next);
    toast.success(next ? t("wishlistAdded") : t("wishlistRemoved"), {
      action: next ? { label: t("viewWishlist"), onClick: () => router.push("/wishlist") } : undefined,
      duration: 2500,
    });
    if (user) {
      start(async () => {
        const res = await toggleWishlistAction(productId, next);
        if (!res.ok) toggleWishlistLocal(productId, !next);
      });
    }
  };

  const dims = { sm: "size-8", md: "size-10", lg: "size-12" }[size];
  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={active}
      aria-label={active ? t("removeFromWishlist") : t("addToWishlist")}
      className={cn("grid place-items-center rounded-full bg-bg/90 text-fg shadow-sm ring-1 ring-black/5 backdrop-blur transition hover:scale-105 active:scale-95", dims, className)}
    >
      <Heart onAnimationEnd={() => setAnim(false)} className={cn("size-[45%] transition-colors", active ? "fill-sale text-sale" : "text-fg/70", anim && "animate-heart")} strokeWidth={2} />
    </button>
  );
}

export function WishlistLink({ className }: { className?: string }) {
  const { wishlist } = useStore();
  const t = useTranslations("common");
  return (
    <Link href="/wishlist" className={cn("relative grid size-10 place-items-center rounded-full transition hover:bg-surface", className)} aria-label={t("wishlist")}>
      <Heart className="size-[22px]" strokeWidth={1.75} />
      {wishlist.size > 0 && <span className="absolute end-1 top-1 grid min-w-4 place-items-center rounded-full bg-sale px-1 text-[10px] font-bold leading-4 text-white">{wishlist.size}</span>}
    </Link>
  );
}

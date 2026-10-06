"use client";

import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Heart } from "lucide-react";
import { useStore } from "@/components/providers/store-context";
import { productCardsAction } from "@/actions/store";
import { ProductGrid, ProductCardSkeleton } from "./product-card";
import { EmptyState } from "@/components/ui/misc";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import type { ProductCardDTO } from "@/types/catalog";

/** Works for guests (device list) and members (account list) alike; updates live as hearts toggle. */
export function WishlistView() {
  const t = useTranslations();
  const locale = useLocale();
  const { wishlist, user } = useStore();
  const [items, setItems] = useState<ProductCardDTO[] | null>(null);
  const ids = [...wishlist];
  const key = ids.join(",");

  useEffect(() => {
    if (!ids.length) {
      setItems([]);
      return;
    }
    productCardsAction(ids.slice(0, 24), locale).then((r) => r.ok && setItems(r.data));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, locale]);

  if (items === null)
    return (
      <div className="grid grid-cols-2 gap-5 md:grid-cols-3 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <ProductCardSkeleton key={i} />
        ))}
      </div>
    );
  const visible = items.filter((i) => wishlist.has(i.id));
  if (!visible.length)
    return (
      <EmptyState
        icon={<Heart />}
        title={t("common.wishlist")}
        text={t("cart.emptyHint")}
        action={
          <Button asChild>
            <Link href="/shop">{t("cart.startShopping")}</Link>
          </Button>
        }
        className="py-20"
      />
    );
  return (
    <>
      {!user && (
        <p className="mb-6 rounded-2xl bg-surface px-4 py-3 text-sm text-muted">
          <Link href="/account/login?next=/wishlist" className="font-medium text-fg underline">
            {t("common.signIn")}
          </Link>{" "}
          — {t("auth.signInSubtitle")}
        </p>
      )}
      <ProductGrid products={visible} />
    </>
  );
}

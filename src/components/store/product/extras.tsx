"use client";

import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Plus, Check } from "lucide-react";
import { Picture } from "@/components/ui/picture";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { useStore } from "@/components/providers/store-context";
import { useCart } from "@/components/store/cart-provider";
import { ProductRail } from "@/components/sections/product-rail";
import { SectionHeading } from "@/components/ui/misc";
import { productCardsAction } from "@/actions/store";
import { recentlyViewed } from "@/lib/local-store";
import { cn } from "@/lib/utils";
import type { ProductCardDTO } from "@/types/catalog";

/** Frequently bought together: the current product + up to 3 add-ons, toggleable, one click to add all. */
export function BoughtTogether({ main, items }: { main: ProductCardDTO; items: ProductCardDTO[] }) {
  const t = useTranslations("product");
  const { format } = useStore();
  const { add } = useCart();
  const addable = items.filter((i) => i.quickAdd);
  const [on, setOn] = useState<Set<string>>(new Set(addable.map((i) => i.id)));
  const [pending, setPending] = useState(false);
  if (!addable.length) return null;
  const chosen = addable.filter((i) => on.has(i.id));
  const total = (main.quickAdd ? main.price.current : 0) + chosen.reduce((s, i) => s + i.price.current, 0);
  return (
    <section className="rounded-[calc(var(--nq-radius)*1.4)] border border-border p-5 md:p-7">
      <h2 className="text-xl font-semibold tracking-tight">{t("frequentlyBought")}</h2>
      <div className="mt-5 flex flex-col gap-6 md:flex-row md:items-center">
        <div className="flex flex-1 items-center gap-2 overflow-x-auto">
          {[main, ...addable].map((p, i) => (
            <div key={p.id} className="flex items-center gap-2">
              {i > 0 && <Plus className="size-4 shrink-0 text-muted" />}
              <button
                type="button"
                disabled={i === 0}
                onClick={() => setOn((s) => (s.has(p.id) ? new Set([...s].filter((x) => x !== p.id)) : new Set([...s, p.id])))}
                className={cn("relative w-28 shrink-0 text-start transition", i > 0 && !on.has(p.id) && "opacity-40")}
                aria-pressed={i === 0 || on.has(p.id)}
              >
                <Picture image={p.image} sizes="112px" className="aspect-square rounded-xl bg-surface" />
                {i > 0 && (
                  <span className={cn("absolute end-1.5 top-1.5 grid size-5 place-items-center rounded-full border", on.has(p.id) ? "border-accent bg-accent text-accent-fg" : "border-border bg-bg")}>
                    {on.has(p.id) && <Check className="size-3" strokeWidth={3} />}
                  </span>
                )}
                <span className="mt-2 line-clamp-2 block text-xs font-medium">{p.name}</span>
                <span className="tabular text-xs text-muted">{format(p.price.current)}</span>
              </button>
            </div>
          ))}
        </div>
        <div className="shrink-0 md:w-56">
          <p className="text-sm text-muted">{t("totalPrice")}</p>
          <p className="tabular text-2xl font-semibold">{format(total)}</p>
          <Button
            className="mt-3"
            block
            loading={pending}
            onClick={async () => {
              setPending(true);
              const list = [...(main.quickAdd ? [main] : []), ...chosen];
              for (const [idx, p] of list.entries()) await add({ productId: p.id, name: p.name, price: p.price.current, brand: p.brand?.name, openDrawer: idx === list.length - 1 });
              setPending(false);
            }}
          >
            {t("addAllToCart")}
          </Button>
        </div>
      </div>
    </section>
  );
}

/** Recently viewed (stored on the device; no tracking cookies). */
export function RecentlyViewed({ excludeId }: { excludeId?: string }) {
  const t = useTranslations("product");
  const locale = useLocale();
  const [items, setItems] = useState<ProductCardDTO[]>([]);
  useEffect(() => {
    const ids = recentlyViewed.get().filter((id) => id !== excludeId).slice(0, 10);
    if (!ids.length) return;
    productCardsAction(ids, locale).then((r) => r.ok && setItems(r.data));
  }, [excludeId, locale]);
  if (!items.length) return null;
  return (
    <section className="container-store py-12">
      <SectionHeading title={t("recentlyViewed")} />
      <ProductRail products={items} />
    </section>
  );
}

export function StickyMobileBar({ name, price, onClickTarget }: { name: string; price: string; onClickTarget: string }) {
  const t = useTranslations("product");
  return (
    <div className="fixed inset-x-0 bottom-16 z-30 flex items-center gap-3 border-t border-border bg-bg/95 px-4 py-2.5 backdrop-blur-lg md:hidden">
      <div className="min-w-0 flex-1">
        <p className="truncate text-xs text-muted">{name}</p>
        <p className="tabular font-semibold">{price}</p>
      </div>
      <Button asChild size="sm">
        <Link href={onClickTarget}>{t("addToCart")}</Link>
      </Button>
    </div>
  );
}

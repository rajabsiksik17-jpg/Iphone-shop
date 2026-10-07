"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Plus, Check } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { Picture } from "@/components/ui/picture";
import { Price } from "@/components/ui/price";
import { RatingSummary } from "@/components/ui/rating";
import { Spinner } from "@/components/ui/spinner";
import { useStore } from "@/components/providers/store-context";
import { WishlistButton } from "./wishlist-button";
import { useCart } from "./cart-provider";
import { cn } from "@/lib/utils";
import type { BadgeKey, ProductCardDTO } from "@/types/catalog";

const ratioClass = { "1/1": "aspect-square", "4/5": "aspect-[4/5]", "3/4": "aspect-[3/4]" } as const;

export function ProductBadges({ badges, percent, className }: { badges: BadgeKey[]; percent: number; className?: string }) {
  const t = useTranslations("product");
  const { badges: cfg } = useStore();
  const visible = badges.filter((b) => {
    if (b === "new") return cfg.showNew;
    if (b === "sale") return cfg.showSale;
    if (b === "bestSeller") return cfg.showBestSeller;
    if (b === "lowStock") return cfg.showLowStock;
    return true;
  });
  if (!visible.length) return null;
  const color: Record<BadgeKey, string> = { new: cfg.new, sale: cfg.sale, bestSeller: cfg.bestSeller, limited: cfg.limited, lowStock: cfg.lowStock, outOfStock: cfg.outOfStock, preorder: cfg.new };
  return (
    <div className={cn("flex flex-col items-start gap-1.5", className)}>
      {visible.slice(0, 2).map((b) => (
        <span key={b} className="rounded-full px-2.5 py-1 text-[10.5px] font-semibold uppercase tracking-wide text-white shadow-sm" style={{ backgroundColor: color[b] }}>
          {b === "sale" && cfg.salePercent && percent > 0 ? t("off", { percent }) : t(`badges.${b}`)}
        </span>
      ))}
    </div>
  );
}

export function ProductCard({ product, priority, sizes = "(min-width:1280px) 22vw, (min-width:768px) 30vw, 46vw", className }: { product: ProductCardDTO; priority?: boolean; sizes?: string; className?: string }) {
  const t = useTranslations("product");
  const { card } = useStore();
  const { add } = useCart();
  const [adding, setAdding] = useState(false);
  const [added, setAdded] = useState(false);
  // Previewed colour: hovering/tapping a swatch shows that colour's photo.
  const [swatch, setSwatch] = useState<number | null>(null);
  const preview = swatch != null ? product.swatches[swatch]?.image : null;
  const soldOut = product.stockStatus === "OUT_OF_STOCK";

  const quickAdd = async (e: React.MouseEvent) => {
    e.preventDefault();
    setAdding(true);
    const ok = await add({ productId: product.id, name: product.name, price: product.price.current, brand: product.brand?.name, category: product.category });
    setAdding(false);
    if (ok) {
      setAdded(true);
      setTimeout(() => setAdded(false), 1600);
    }
  };

  return (
    <article
      className={cn(
        "group/card relative flex flex-col",
        card.style === "bordered" && "rounded-card border border-border bg-bg p-2.5",
        card.style === "elevated" && "rounded-card bg-bg p-2.5 shadow-card transition-shadow duration-300 hover:shadow-pop",
        className,
      )}
    >
      <div className={cn("relative overflow-hidden rounded-card bg-surface", ratioClass[card.imageRatio])}>
        <Link href={`/product/${product.slug}`} className="absolute inset-0" tabIndex={-1} aria-hidden>
          <Picture image={product.image} sizes={sizes} priority={priority} className="absolute inset-0 transition duration-700 ease-[var(--ease-out-expo)] group-hover/card:scale-[1.04]" />
          {preview && <Picture key={preview.url} image={preview} sizes={sizes} className="absolute inset-0 z-[1] animate-fade-in bg-surface" />}
          {card.hoverSecondImage && product.hoverImage && !preview && (
            <Picture image={product.hoverImage} sizes={sizes} className="absolute inset-0 opacity-0 transition-opacity duration-500 group-hover/card:opacity-100 max-md:hidden" />
          )}
          {soldOut && <div className="absolute inset-0 bg-white/40" />}
        </Link>
        <ProductBadges badges={product.badges} percent={product.price.percent} className="pointer-events-none absolute start-2.5 top-2.5" />
        <WishlistButton productId={product.id} size="sm" className="absolute end-2.5 top-2.5 z-10 opacity-100 md:opacity-0 md:group-hover/card:opacity-100 md:focus-visible:opacity-100 md:[&[aria-pressed=true]]:opacity-100" />
        {card.quickAdd && !soldOut && (
          <div className="absolute inset-x-2.5 bottom-2.5 z-10 translate-y-0 transition duration-300 md:translate-y-3 md:opacity-0 md:group-hover/card:translate-y-0 md:group-hover/card:opacity-100 md:group-focus-within/card:translate-y-0 md:group-focus-within/card:opacity-100">
            {product.quickAdd ? (
              <button
                type="button"
                onClick={quickAdd}
                disabled={adding}
                className="ms-auto flex h-10 items-center justify-center gap-2 rounded-full bg-bg/95 px-3.5 text-sm font-medium text-fg shadow-md ring-1 ring-black/5 backdrop-blur transition hover:bg-primary hover:text-primary-fg max-md:size-10 max-md:px-0 md:w-full"
                aria-label={`${t("quickAdd")}: ${product.name}`}
              >
                {adding ? <Spinner className="size-4" /> : added ? <Check className="size-4 animate-scale-in" /> : <Plus className="size-4" />}
                <span className="max-md:sr-only">{added ? t("added") : t("addToCart")}</span>
              </button>
            ) : (
              <Link
                href={`/product/${product.slug}`}
                className="ms-auto flex h-10 items-center justify-center gap-2 rounded-full bg-bg/95 px-3.5 text-sm font-medium text-fg shadow-md ring-1 ring-black/5 backdrop-blur transition hover:bg-primary hover:text-primary-fg max-md:size-10 max-md:px-0 md:w-full"
                aria-label={`${t("selectOptions")}: ${product.name}`}
              >
                <Plus className="size-4 md:hidden" />
                <span className="max-md:sr-only">{t("selectOptions")}</span>
              </Link>
            )}
          </div>
        )}
      </div>

      <div className="flex flex-1 flex-col pt-3">
        {card.showBrand && product.brand && <p className="mb-0.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">{product.brand.name}</p>}
        <h3 className="line-clamp-2 text-[14.5px] font-medium leading-snug text-fg">
          <Link href={`/product/${product.slug}`} className="after:absolute after:inset-0 focus-visible:outline-none focus-visible:after:rounded-card focus-visible:after:ring-2 focus-visible:after:ring-accent">
            {product.name}
          </Link>
        </h3>
        {product.cardSpecs.length > 0 && <p className="mt-1 truncate text-xs text-muted">{product.cardSpecs.join(" · ")}</p>}
        {card.showRating && product.ratingCount > 0 && <RatingSummary value={product.rating} count={product.ratingCount} className="mt-1.5" countLabel={t("reviewsCount", { count: product.ratingCount })} />}
        <div className="mt-auto flex flex-col-reverse gap-1.5 pt-2 sm:flex-row sm:items-end sm:justify-between sm:gap-2">
          <Price price={product.price} size="md" />
          {product.swatches.length > 1 && (
            <div className="relative z-10 flex items-center gap-1 pb-0.5" role="group" aria-label={t("colors")} onMouseLeave={() => setSwatch(null)}>
              {product.swatches.slice(0, 4).map((s, i) => (
                <button
                  key={s.hex + s.label}
                  type="button"
                  title={s.label}
                  aria-label={s.label}
                  aria-pressed={swatch === i}
                  onMouseEnter={() => setSwatch(i)}
                  onFocus={() => setSwatch(i)}
                  onClick={(e) => (e.preventDefault(), setSwatch(swatch === i ? null : i))}
                  className={cn(
                    "grid size-[18px] place-items-center rounded-full transition duration-200",
                    swatch === i ? "ring-[1.5px] ring-fg ring-offset-[1.5px] ring-offset-bg" : "hover:scale-110",
                  )}
                >
                  <span className="size-3.5 rounded-full" style={{ backgroundColor: s.hex, boxShadow: "inset 0 0 0 1px rgb(0 0 0 / 0.14)" }} />
                </button>
              ))}
              {product.swatches.length > 4 && <span className="tabular ps-0.5 text-[11px] font-medium text-muted">+{product.swatches.length - 4}</span>}
            </div>
          )}
        </div>
        {soldOut && <p className="mt-1 text-xs font-medium text-muted">{t("outOfStock")}</p>}
      </div>
    </article>
  );
}

export function ProductCardSkeleton() {
  return (
    <div className="flex flex-col">
      <div className="skeleton aspect-square rounded-card" />
      <div className="skeleton mt-3 h-3 w-16 rounded" />
      <div className="skeleton mt-2 h-4 w-4/5 rounded" />
      <div className="skeleton mt-3 h-4 w-24 rounded" />
    </div>
  );
}

export function ProductGrid({ products, priorityCount = 0, className }: { products: ProductCardDTO[]; priorityCount?: number; className?: string }) {
  return (
    <div className={cn("grid grid-cols-2 gap-x-3 gap-y-8 sm:gap-x-5 md:grid-cols-3 xl:grid-cols-4", className)}>
      {products.map((p, i) => (
        <ProductCard key={p.id} product={p} priority={i < priorityCount} />
      ))}
    </div>
  );
}

"use client";

import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Check, Share2, ShieldCheck, Truck, RotateCcw, CreditCard, Zap } from "lucide-react";
import { toast } from "sonner";
import { Link, useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Price } from "@/components/ui/price";
import { Stars } from "@/components/ui/rating";
import { useStore } from "@/components/providers/store-context";
import { useCart } from "@/components/store/cart-provider";
import { QuantityStepper } from "@/components/store/quantity";
import { WishlistButton } from "@/components/store/wishlist-button";
import { ProductBadges } from "@/components/store/product-card";
import { Gallery } from "./gallery";
import { Countdown } from "./countdown";
import { track } from "@/lib/analytics-client";
import { recentlyViewed } from "@/lib/local-store";
import { trackAction } from "@/actions/store";
import { cn } from "@/lib/utils";
import type { ProductDetailDTO, VariantDTO } from "@/server/catalog/product";

/**
 * Variant selection that never lets shoppers pick an impossible combination:
 * option values that don't exist with the current selection are shown as
 * unavailable, and choosing one snaps the other options to a valid variant.
 */
function useVariantSelection(product: ProductDetailDTO) {
  const initial = useMemo(() => {
    const firstInStock = product.variants.find((v) => v.stockStatus !== "OUT_OF_STOCK") ?? product.variants[0];
    return firstInStock ? { ...firstInStock.options } : {};
  }, [product]);
  const [selected, setSelected] = useState<Record<string, string>>(initial);

  const variant: VariantDTO | null = useMemo(() => {
    if (!product.variants.length) return null;
    return product.variants.find((v) => product.options.every((o) => v.options[o.key] === selected[o.key])) ?? null;
  }, [product, selected]);

  const isAvailable = (key: string, value: string) =>
    product.variants.some((v) => v.options[key] === value && product.options.every((o) => o.key === key || v.options[o.key] === selected[o.key]));

  const isInStock = (key: string, value: string) =>
    product.variants.some((v) => v.options[key] === value && v.stockStatus !== "OUT_OF_STOCK" && product.options.every((o) => o.key === key || v.options[o.key] === selected[o.key]));

  const choose = (key: string, value: string) => {
    const next = { ...selected, [key]: value };
    const exact = product.variants.find((v) => product.options.every((o) => v.options[o.key] === next[o.key]));
    if (exact) return setSelected(next);
    // Snap to the closest valid variant that keeps the chosen value.
    const fallback = product.variants.filter((v) => v.options[key] === value).sort((a, b) => (a.stockStatus === "OUT_OF_STOCK" ? 1 : 0) - (b.stockStatus === "OUT_OF_STOCK" ? 1 : 0))[0];
    if (fallback) setSelected({ ...fallback.options });
  };

  return { selected, variant, choose, isAvailable, isInStock };
}

export function ProductPurchase({ product, shippingNote }: { product: ProductDetailDTO; shippingNote: string | null }) {
  const t = useTranslations("product");
  const router = useRouter();
  const { format } = useStore();
  const { add } = useCart();
  const { selected, variant, choose, isAvailable, isInStock } = useVariantSelection(product);
  const [qty, setQty] = useState(product.minQty);
  const [adding, setAdding] = useState<"cart" | "buy" | null>(null);
  const [justAdded, setJustAdded] = useState(false);

  const isVariable = product.variants.length > 0;
  const price = variant?.price ?? product.price;
  const stockStatus = variant?.stockStatus ?? product.stockStatus;
  const stock = variant?.stock ?? product.stock;
  const soldOut = stockStatus === "OUT_OF_STOCK";
  const maxQty = Math.max(1, Math.min(product.maxQty ?? 99, product.trackInventory && stockStatus !== "BACKORDER" ? stock : 99));

  // Jump the gallery to the selected colour's image.
  const colorKey = product.options.find((o) => o.type === "COLOR")?.key;
  const activeImage = useMemo(() => {
    if (variant?.imageIndex != null) return variant.imageIndex;
    if (colorKey) {
      const i = product.images.findIndex((img) => img.valueSlug === selected[colorKey]);
      return i >= 0 ? i : null;
    }
    return null;
  }, [variant, colorKey, selected, product.images]);

  useEffect(() => {
    recentlyViewed.push(product.id);
    track.viewItem({ id: product.id, name: product.name, price: product.price.current, brand: product.brand?.name, category: product.category });
    trackAction("PRODUCT_VIEW", { productId: product.id, path: `/product/${product.slug}` }).catch(() => {});
  }, [product]);

  const addToCart = async (mode: "cart" | "buy") => {
    if (isVariable && !variant) return toast.error(t("combinationUnavailable"));
    setAdding(mode);
    const ok = await add({ productId: product.id, variantId: variant?.id ?? null, quantity: qty, name: product.name, price: price.current, brand: product.brand?.name, category: product.category, openDrawer: mode === "cart" });
    setAdding(null);
    if (!ok) return;
    if (mode === "buy") router.push("/checkout");
    else {
      setJustAdded(true);
      setTimeout(() => setJustAdded(false), 1800);
    }
  };

  const share = async () => {
    const url = window.location.href;
    try {
      if (navigator.share) await navigator.share({ title: product.name, url });
      else {
        await navigator.clipboard.writeText(url);
        toast.success(t("shareCopied"));
      }
    } catch {
      /* user cancelled */
    }
  };

  const stockLine =
    stockStatus === "OUT_OF_STOCK" ? (
      <span className="text-muted">{t("outOfStock")}</span>
    ) : stockStatus === "LOW_STOCK" ? (
      <span className="font-medium text-warning">{t("lowStock", { count: stock })}</span>
    ) : stockStatus === "BACKORDER" ? (
      <span className="text-warning">{t("backorder")}</span>
    ) : (
      <span className="flex items-center gap-1.5 font-medium text-success">
        <span className="size-2 rounded-full bg-success" /> {t("inStock")}
      </span>
    );

  return (
    <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] lg:gap-14">
      <div className="lg:sticky lg:top-32 lg:self-start">
        <Gallery images={product.images} name={product.name} activeIndex={activeImage} badges={<ProductBadges badges={product.badges} percent={price.percent} />} />
      </div>

      <div className="min-w-0">
        {product.brandInfo && (
          <Link href={`/brand/${product.brandInfo.slug}`} className="text-xs font-semibold uppercase tracking-[0.12em] text-accent hover:underline">
            {product.brandInfo.name}
          </Link>
        )}
        <h1 className="mt-2 text-[1.75rem] font-semibold leading-tight tracking-tight text-balance md:text-4xl">{product.name}</h1>
        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
          {product.ratingCount > 0 && (
            <a href="#reviews" className="flex items-center gap-2 hover:underline">
              <Stars value={product.rating} />
              <span className="font-medium">{product.rating.toFixed(1)}</span>
              <span className="text-muted">({t("reviewsCount", { count: product.ratingCount })})</span>
            </a>
          )}
          {(variant?.sku ?? product.sku) && (
            <span className="text-muted">
              {t("sku")}: <span className="tabular">{variant?.sku ?? product.sku}</span>
            </span>
          )}
        </div>

        <div className="mt-6 rounded-[calc(var(--nq-radius)*1.2)] border border-border p-5">
          <Price price={price} size="xl" showSavings range={false} />
          {price.onSale && price.saleEndsAt && (
            <div className="mt-3">
              <Countdown to={price.saleEndsAt} label={t("saleEnds")} />
            </div>
          )}
          {product.shortDescription && <p className="mt-4 text-[15px] leading-relaxed text-fg/75">{product.shortDescription}</p>}

          {product.options.map((o) => (
            <fieldset key={o.key} className="mt-6">
              <legend className="mb-2.5 text-sm">
                <span className="font-semibold">{o.label}:</span> <span className="text-muted">{o.values.find((v) => v.slug === selected[o.key])?.label}</span>
              </legend>
              <div className="flex flex-wrap gap-2">
                {o.values.map((v) => {
                  const active = selected[o.key] === v.slug;
                  const available = isAvailable(o.key, v.slug);
                  const inStock = isInStock(o.key, v.slug);
                  return o.type === "COLOR" && v.hex ? (
                    <button
                      key={v.slug}
                      type="button"
                      onClick={() => choose(o.key, v.slug)}
                      aria-pressed={active}
                      aria-label={`${v.label}${!inStock ? ` — ${t("outOfStock")}` : ""}`}
                      title={v.label}
                      className={cn("relative size-11 rounded-full ring-offset-2 ring-offset-bg transition", active ? "ring-2 ring-fg" : "ring-1 ring-border hover:ring-fg/40", !inStock && "opacity-50")}
                    >
                      <span className="absolute inset-1 rounded-full" style={{ backgroundColor: v.hex, boxShadow: "inset 0 0 0 1px rgb(0 0 0 / 0.1)" }} />
                      {!inStock && <span className="absolute inset-0 m-auto h-px w-9 -rotate-45 bg-fg/60" />}
                    </button>
                  ) : (
                    <button
                      key={v.slug}
                      type="button"
                      onClick={() => choose(o.key, v.slug)}
                      aria-pressed={active}
                      disabled={!available && !product.variants.some((x) => x.options[o.key] === v.slug)}
                      className={cn(
                        "relative min-w-16 rounded-xl border px-4 py-2.5 text-sm font-medium transition",
                        active ? "border-fg bg-fg text-bg" : "border-border hover:border-fg/40",
                        !inStock && !active && "text-muted line-through decoration-muted/60",
                      )}
                    >
                      {v.label}
                    </button>
                  );
                })}
              </div>
            </fieldset>
          ))}

          <div className="mt-6 text-sm">{stockLine}</div>

          <div className="mt-4 flex gap-3">
            <QuantityStepper value={Math.min(qty, maxQty)} onChange={setQty} min={product.minQty} max={maxQty} disabled={soldOut} />
            <Button size="lg" className="h-12 min-w-0 flex-1 max-sm:px-3" onClick={() => addToCart("cart")} disabled={soldOut || (isVariable && !variant)} loading={adding === "cart"} leftIcon={justAdded ? <Check className="animate-scale-in" /> : undefined}>
              <span className="truncate">{soldOut ? t("outOfStock") : justAdded ? t("added") : t("addToCart")}</span>
            </Button>
            <WishlistButton productId={product.id} size="lg" className="shrink-0 shadow-none ring-border" />
          </div>
          {!soldOut && (
            <Button size="lg" variant="accent" block className="mt-3 h-12" onClick={() => addToCart("buy")} loading={adding === "buy"} leftIcon={<Zap />}>
              {t("buyNow")}
            </Button>
          )}
          <button type="button" onClick={share} className="mt-4 flex items-center gap-2 text-sm text-muted hover:text-fg">
            <Share2 className="size-4" /> {t("share")}
          </button>
        </div>

        <ul className="mt-5 grid gap-3 text-sm sm:grid-cols-2">
          {[
            { icon: Truck, text: shippingNote },
            { icon: ShieldCheck, text: product.warranty || t("genuine") },
            { icon: RotateCcw, text: t("returns") },
            { icon: CreditCard, text: t("securePay") },
          ]
            .filter((x) => x.text)
            .map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-center gap-3 rounded-2xl bg-surface px-4 py-3">
                <Icon className="size-5 shrink-0 text-fg/70" />
                <span className="text-fg/80">{text}</span>
              </li>
            ))}
        </ul>
        <p className="sr-only">{format(price.current)}</p>
      </div>
    </div>
  );
}

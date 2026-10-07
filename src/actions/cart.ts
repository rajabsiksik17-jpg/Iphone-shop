"use server";

import { z } from "zod";
import { cookies } from "next/headers";
import { addToCart, getCartTotals, removeCartItem, setCartCoupon, setCartDestination, setCartPoints, updateCartItem } from "@/server/commerce/cart";
import { quoteShipping } from "@/server/commerce/shipping";
import { limitBy } from "@/server/rate-limit";
import { requestMeta } from "@/server/request";
import { Errors } from "@/server/errors";
import { recordEvent } from "@/server/analytics/events";
import { switchableCurrencies } from "@/server/commerce/currency";
import { idSchema, localeSchema, run } from "./helpers";

async function guard() {
  const meta = await requestMeta();
  const r = limitBy("cart", meta.ip ?? "unknown");
  if (!r.ok) throw Errors.rateLimited(r.retryAfterSec);
}

export async function getCartAction(locale: string) {
  return run(async () => getCartTotals(localeSchema.parse(locale)));
}

export async function addToCartAction(input: { productId: string; variantId?: string | null; quantity: number; locale: string }) {
  return run(async () => {
    await guard();
    const p = z.object({ productId: idSchema, variantId: idSchema.nullable().optional(), quantity: z.number().int().min(1).max(99), locale: localeSchema }).parse(input);
    await addToCart(p.productId, p.variantId ?? null, p.quantity);
    recordEvent("ADD_TO_CART", { productId: p.productId }).catch(() => {});
    return getCartTotals(p.locale);
  });
}

export async function updateCartItemAction(input: { itemId: string; quantity: number; locale: string }) {
  return run(async () => {
    await guard();
    const p = z.object({ itemId: idSchema, quantity: z.number().int().min(0).max(99), locale: localeSchema }).parse(input);
    await updateCartItem(p.itemId, p.quantity);
    return getCartTotals(p.locale);
  });
}

export async function removeCartItemAction(input: { itemId: string; locale: string }) {
  return run(async () => {
    await guard();
    const p = z.object({ itemId: idSchema, locale: localeSchema }).parse(input);
    await removeCartItem(p.itemId);
    return getCartTotals(p.locale);
  });
}

export async function applyCouponAction(input: { code: string | null; locale: string }) {
  return run(async () => {
    await guard();
    const p = z.object({ code: z.string().trim().max(40).nullable(), locale: localeSchema }).parse(input);
    await setCartCoupon(p.code || null);
    return getCartTotals(p.locale);
  });
}

export async function usePointsAction(input: { points: number; locale: string }) {
  return run(async () => {
    const p = z.object({ points: z.number().int().min(0).max(10_000_000), locale: localeSchema }).parse(input);
    await setCartPoints(p.points);
    return getCartTotals(p.locale);
  });
}

/**
 * Delivery options for the chosen destination. Also stores the destination on
 * the cart and returns fresh totals, so country/city-targeted offers apply (or
 * drop) in the same round trip.
 */
export async function shippingQuotesAction(input: { country: string; regionId?: string | null; locale: string }) {
  return run(async () => {
    const p = z.object({ country: z.string().length(2), regionId: z.string().max(64).nullable().optional(), locale: localeSchema }).parse(input);
    await setCartDestination(p.country.toUpperCase(), p.regionId ?? null);
    const totals = await getCartTotals(p.locale);
    const quotes = await quoteShipping({
      country: p.country,
      regionId: p.regionId ?? null,
      subtotal: totals.subtotal - totals.discountTotal,
      weightGrams: totals.weightGrams,
      freeShipping: totals.freeShipping,
      requiresShipping: totals.requiresShipping,
      locale: p.locale,
    });
    return { quotes, totals };
  });
}

export async function setDisplayCurrencyAction(code: string) {
  return run(async () => {
    const list = await switchableCurrencies();
    if (!list.some((c) => c.code === code)) throw Errors.invalid();
    (await cookies()).set("NQ_CURRENCY", code, { path: "/", maxAge: 31_536_000, sameSite: "lax" });
  });
}

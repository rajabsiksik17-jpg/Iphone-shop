import "server-only";
import { cookies } from "next/headers";
import { db, type Tx } from "../db";
import { hmac, randomToken } from "../crypto";
import { AppError } from "../errors";
import { getSettings } from "../settings/service";
import { COOKIE, cookieOptions, getCurrentUser } from "../auth/session";
import { t } from "@/lib/i18n-text";
import { resolvePrice, variantPriceSource, stockState } from "@/lib/pricing";
import { evaluateCoupon, type CouponRejection, type DiscountLine } from "@/lib/discounts";
import { imageDTO } from "../catalog/dto";
import { freeShippingThreshold } from "./shipping";
import { baseCurrency } from "./currency";
import type { ImageDTO } from "@/types/catalog";

const CART_COOKIE_DAYS = 60;
export const MAX_LINE_QTY = 99;

const cartInclude = {
  items: {
    orderBy: { addedAt: "asc" },
    include: {
      product: {
        include: {
          images: { orderBy: { position: "asc" }, take: 1, include: { media: true } },
          brand: { select: { id: true, name: true } },
          categories: { select: { categoryId: true, category: { select: { path: true } } } },
        },
      },
      variant: { include: { options: { include: { attribute: true, value: true } }, image: true } },
    },
  },
} as const;

/** Resolve the shopper's cart (account cart if signed in, else guest cookie). Read-only. */
export async function findCart() {
  const user = await getCurrentUser();
  if (user) return db.cart.findUnique({ where: { userId: user.id }, include: cartInclude });
  const token = (await cookies()).get(COOKIE.CART)?.value;
  if (!token) return null;
  return db.cart.findUnique({ where: { guestTokenHash: hmac(token, "cart") }, include: cartInclude });
}

/** Get or create the cart. Only callable from server actions/route handlers (sets cookies). */
async function ensureCart() {
  const user = await getCurrentUser();
  if (user) {
    return db.cart.upsert({ where: { userId: user.id }, create: { userId: user.id }, update: {}, include: cartInclude });
  }
  const jar = await cookies();
  let token = jar.get(COOKIE.CART)?.value;
  if (token) {
    const existing = await db.cart.findUnique({ where: { guestTokenHash: hmac(token, "cart") }, include: cartInclude });
    if (existing) return existing;
  }
  token = randomToken(24);
  jar.set(COOKIE.CART, token, cookieOptions(CART_COOKIE_DAYS * 86_400));
  return db.cart.create({ data: { guestTokenHash: hmac(token, "cart") }, include: cartInclude });
}

/** On sign-in: fold the guest cart into the account cart, then drop it. */
export async function mergeGuestCart(userId: string) {
  const jar = await cookies();
  const token = jar.get(COOKIE.CART)?.value;
  if (!token) return;
  const guest = await db.cart.findUnique({ where: { guestTokenHash: hmac(token, "cart") }, include: { items: true } });
  jar.delete(COOKIE.CART);
  if (!guest?.items.length) {
    if (guest) await db.cart.delete({ where: { id: guest.id } });
    return;
  }
  const userCart = await db.cart.upsert({ where: { userId }, create: { userId, couponCode: guest.couponCode }, update: {}, include: { items: true } });
  await db.$transaction(async (tx) => {
    for (const item of guest.items) {
      const same = userCart.items.find((i) => i.productId === item.productId && i.variantId === item.variantId);
      if (same) await tx.cartItem.update({ where: { id: same.id }, data: { quantity: Math.min(MAX_LINE_QTY, same.quantity + item.quantity) } });
      else await tx.cartItem.create({ data: { cartId: userCart.id, productId: item.productId, variantId: item.variantId, quantity: item.quantity } });
    }
    await tx.cart.delete({ where: { id: guest.id } });
  });
}

type ProductForCart = { id: string; type: string; status: string; visibility: string; publishedAt: Date | null; trackInventory: boolean; allowBackorder: boolean; stock: number; minQty: number; maxQty: number | null };

async function assertPurchasable(productId: string, variantId: string | null, quantity: number, tx: Tx = db) {
  const product = (await tx.product.findUnique({ where: { id: productId } })) as ProductForCart | null;
  if (!product || product.status !== "ACTIVE" || product.visibility === "HIDDEN" || (product.publishedAt && product.publishedAt > new Date()))
    throw new AppError("product_unavailable", 404);
  let available = product.stock;
  if (product.type === "VARIABLE") {
    if (!variantId) throw new AppError("variant_required", 422);
    const variant = await tx.productVariant.findFirst({ where: { id: variantId, productId, isActive: true } });
    if (!variant) throw new AppError("variant_unavailable", 404);
    available = variant.stock;
  } else if (variantId) {
    throw new AppError("variant_unavailable", 404);
  }
  if (quantity < product.minQty) throw new AppError("below_min_qty", 422, { min: product.minQty });
  if (product.maxQty && quantity > product.maxQty) throw new AppError("above_max_qty", 422, { max: product.maxQty });
  if (product.trackInventory && !product.allowBackorder && quantity > available) throw new AppError("insufficient_stock", 409, { available: Math.max(0, available) });
}

export async function addToCart(productId: string, variantId: string | null, quantity: number) {
  const qty = Math.max(1, Math.min(MAX_LINE_QTY, Math.floor(quantity)));
  const cart = await ensureCart();
  const existing = cart.items.find((i) => i.productId === productId && i.variantId === variantId);
  const nextQty = Math.min(MAX_LINE_QTY, (existing?.quantity ?? 0) + qty);
  await assertPurchasable(productId, variantId, nextQty);
  if (existing) await db.cartItem.update({ where: { id: existing.id }, data: { quantity: nextQty } });
  else await db.cartItem.create({ data: { cartId: cart.id, productId, variantId, quantity: nextQty } });
  await db.cart.update({ where: { id: cart.id }, data: { updatedAt: new Date() } });
}

export async function updateCartItem(itemId: string, quantity: number) {
  const cart = await ensureCart();
  const item = cart.items.find((i) => i.id === itemId);
  if (!item) throw new AppError("not_found", 404);
  if (quantity <= 0) {
    await db.cartItem.delete({ where: { id: item.id } });
    return;
  }
  const qty = Math.min(MAX_LINE_QTY, Math.floor(quantity));
  await assertPurchasable(item.productId, item.variantId, qty);
  await db.cartItem.update({ where: { id: item.id }, data: { quantity: qty } });
}

export async function removeCartItem(itemId: string) {
  const cart = await ensureCart();
  if (!cart.items.some((i) => i.id === itemId)) throw new AppError("not_found", 404);
  await db.cartItem.delete({ where: { id: itemId } });
}

export async function setCartCoupon(code: string | null) {
  const cart = await ensureCart();
  await db.cart.update({ where: { id: cart.id }, data: { couponCode: code ? code.trim().toUpperCase() : null } });
}

export async function setCartPoints(points: number) {
  const cart = await ensureCart();
  await db.cart.update({ where: { id: cart.id }, data: { usePoints: Math.max(0, Math.floor(points)) } });
}

export async function clearCart(cartId: string, tx: Tx = db) {
  await tx.cartItem.deleteMany({ where: { cartId } });
  await tx.cart.update({ where: { id: cartId }, data: { couponCode: null, usePoints: 0 } });
}

// ───────────────────────────────── Totals ───────────────────────────────────

export type CartLineDTO = {
  id: string;
  productId: string;
  variantId: string | null;
  slug: string;
  name: string;
  brand: string | null;
  variantLabel: string | null;
  options: { label: string; value: string }[];
  image: ImageDTO | null;
  sku: string | null;
  quantity: number;
  unitPrice: number;
  regularUnitPrice: number;
  onSale: boolean;
  lineTotal: number;
  discount: number;
  maxQty: number;
  available: boolean;
  stockStatus: string;
  weightGrams: number;
  requiresShipping: boolean;
  issue: "out_of_stock" | "insufficient_stock" | "unavailable" | null;
};

export type CartTotals = {
  id: string | null;
  lines: CartLineDTO[];
  itemCount: number;
  subtotal: number;
  compareAtSubtotal: number;
  discounts: { code: string | null; label: string; amount: number; couponId: string }[];
  discountTotal: number;
  coupon: { code: string; valid: boolean; reason?: CouponRejection; freeShipping: boolean } | null;
  freeShipping: boolean;
  points: { enabled: boolean; balance: number; using: number; value: number; maxUsable: number; pointValue: number; earnable: number };
  tax: { enabled: boolean; included: boolean; amount: number; label: string };
  total: number;
  weightGrams: number;
  requiresShipping: boolean;
  freeShippingThreshold: number | null;
  hasIssues: boolean;
};

type CartWithItems = NonNullable<Awaited<ReturnType<typeof findCart>>>;

/**
 * Authoritative cart pricing. Prices, sales, stock, coupons, automatic
 * promotions, points and tax are all resolved here on the server — the client
 * never supplies amounts.
 */
export async function computeCart(cart: CartWithItems | null, locale: string, ctx: { email?: string | null; userId?: string | null; country?: string } = {}): Promise<CartTotals> {
  const [store, loyalty, tax] = await Promise.all([getSettings("store"), getSettings("loyalty"), getSettings("tax")]);
  const now = new Date();
  const lines: CartLineDTO[] = (cart?.items ?? []).map((item) => {
    const p = item.product;
    const v = item.variant;
    const price = resolvePrice(v ? variantPriceSource(p, v) : p, now);
    const stock = v ? v.stock : p.stock;
    const threshold = p.lowStockThreshold ?? store.lowStockThreshold;
    const status = stockState({ track: p.trackInventory, stock, lowThreshold: threshold, allowBackorder: p.allowBackorder });
    const unavailable = p.status !== "ACTIVE" || p.visibility === "HIDDEN" || (v ? !v.isActive : p.type === "VARIABLE");
    const capped = p.trackInventory && !p.allowBackorder ? Math.max(0, stock) : MAX_LINE_QTY;
    const maxQty = Math.min(MAX_LINE_QTY, p.maxQty ?? MAX_LINE_QTY, capped);
    const issue = unavailable ? "unavailable" : status === "OUT_OF_STOCK" ? "out_of_stock" : item.quantity > maxQty ? "insufficient_stock" : null;
    const options = v?.options.map((o) => ({ label: t(o.attribute.name, locale), value: t(o.value.label, locale) })) ?? [];
    return {
      id: item.id,
      productId: p.id,
      variantId: v?.id ?? null,
      slug: p.slug,
      name: t(p.name, locale),
      brand: p.brand ? t(p.brand.name, locale) : null,
      variantLabel: options.length ? options.map((o) => o.value).join(" · ") : null,
      options,
      image: imageDTO(v?.image ?? p.images[0]?.media, locale, t(p.name, locale)),
      sku: v?.sku ?? p.sku,
      quantity: item.quantity,
      unitPrice: price.current,
      regularUnitPrice: price.regular,
      onSale: price.onSale,
      lineTotal: price.current * item.quantity,
      discount: 0,
      maxQty,
      available: !issue,
      stockStatus: status,
      weightGrams: (v?.weightGrams ?? p.weightGrams ?? 0) * item.quantity,
      requiresShipping: p.requiresShipping,
      issue,
    };
  });

  const billable = lines.filter((l) => l.available);
  const subtotal = billable.reduce((s, l) => s + l.lineTotal, 0);
  const compareAtSubtotal = billable.reduce((s, l) => s + l.regularUnitPrice * l.quantity, 0);

  const discountLines: DiscountLine[] = billable.map((l) => {
    const item = cart!.items.find((i) => i.id === l.id)!;
    return {
      key: l.id,
      productId: l.productId,
      categoryIds: item.product.categories.flatMap((c) => c.category.path.split("/").filter(Boolean)),
      brandId: item.product.brand?.id ?? null,
      unitPrice: l.unitPrice,
      quantity: l.quantity,
      onSale: l.onSale,
    };
  });

  const email = ctx.email?.toLowerCase() ?? null;
  const [orderCount, coupons] = await Promise.all([
    email ? db.order.count({ where: { email, statusKey: { notIn: ["cancelled", "failed"] } } }) : Promise.resolve(0),
    db.coupon.findMany({
      where: {
        isActive: true,
        OR: [{ isAutomatic: true }, ...(cart?.couponCode ? [{ code: cart.couponCode }] : [])],
      },
    }),
  ]);

  const discounts: CartTotals["discounts"] = [];
  let freeShipping = false;
  let couponState: CartTotals["coupon"] = null;
  let remaining = subtotal;

  // Automatic promotions first, then the entered code; each discounts what remains,
  // so the combined discount can never exceed the subtotal.
  const ordered = [...coupons.filter((c) => c.isAutomatic), ...coupons.filter((c) => !c.isAutomatic)];
  for (const c of ordered) {
    const usage = email ? await db.couponRedemption.count({ where: { couponId: c.id, email } }) : 0;
    const result = evaluateCoupon({ ...c, type: c.type, scope: c.scope }, discountLines, { email, customerOrderCount: orderCount, customerUsageCount: usage, now });
    if (!c.isAutomatic) couponState = { code: c.code!, valid: result.ok, reason: result.ok ? undefined : result.reason, freeShipping: result.ok && result.freeShipping };
    if (!result.ok) continue;
    if (result.freeShipping) freeShipping = true;
    const amount = Math.min(result.amount, remaining);
    if (amount > 0) {
      remaining -= amount;
      discounts.push({ code: c.code, label: t(c.name, locale) || c.code || "", amount, couponId: c.id });
      for (const [key, value] of Object.entries(result.perLine)) {
        const line = lines.find((l) => l.id === key);
        if (line) line.discount += value;
      }
    }
  }
  if (cart?.couponCode && !couponState) couponState = { code: cart.couponCode, valid: false, reason: "inactive", freeShipping: false };

  const discountTotal = discounts.reduce((s, d) => s + d.amount, 0);
  const afterDiscounts = subtotal - discountTotal;

  // Loyalty points
  const user = ctx.userId ? await db.user.findUnique({ where: { id: ctx.userId }, select: { pointsBalance: true } }) : null;
  const balance = loyalty.enabled ? (user?.pointsBalance ?? 0) : 0;
  const maxByPercent = Math.floor((afterDiscounts * loyalty.maxRedeemPercent) / 100);
  const maxUsable = loyalty.pointValue > 0 ? Math.min(balance, Math.floor(maxByPercent / loyalty.pointValue)) : 0;
  let using = Math.min(cart?.usePoints ?? 0, maxUsable);
  if (using < loyalty.minRedeemPoints) using = 0;
  const pointsValue = using * loyalty.pointValue;

  const preTax = afterDiscounts - pointsValue;
  let taxAmount = 0;
  if (tax.enabled && tax.rateBp > 0) {
    taxAmount = tax.pricesIncludeTax ? Math.round(preTax - preTax / (1 + tax.rateBp / 10_000)) : Math.round((preTax * tax.rateBp) / 10_000);
  }
  const total = preTax + (tax.enabled && !tax.pricesIncludeTax ? taxAmount : 0);
  const majorFactor = 10 ** (await baseCurrency()).decimals;

  return {
    id: cart?.id ?? null,
    lines,
    itemCount: lines.reduce((s, l) => s + l.quantity, 0),
    subtotal,
    compareAtSubtotal,
    discounts,
    discountTotal,
    coupon: couponState,
    freeShipping,
    points: {
      enabled: loyalty.enabled,
      balance,
      using,
      value: pointsValue,
      maxUsable,
      pointValue: loyalty.pointValue,
      earnable: loyalty.enabled ? Math.floor((total / majorFactor) * loyalty.pointsPerUnit) : 0,
    },
    tax: { enabled: tax.enabled, included: tax.pricesIncludeTax, amount: taxAmount, label: t(tax.label, locale) },
    total,
    weightGrams: billable.reduce((s, l) => s + l.weightGrams, 0),
    requiresShipping: billable.some((l) => l.requiresShipping),
    freeShippingThreshold: await freeShippingThreshold(ctx.country ?? store.defaultCountry),
    hasIssues: lines.some((l) => l.issue),
  };
}

export async function getCartTotals(locale: string) {
  const [cart, user] = await Promise.all([findCart(), getCurrentUser()]);
  return computeCart(cart, locale, { email: user?.email, userId: user?.id });
}

export type { CartWithItems };

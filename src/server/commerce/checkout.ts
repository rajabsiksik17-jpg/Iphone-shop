import "server-only";
import { resolveDestination } from "./regions";
import { z } from "zod";
import { isValidPhoneNumber, parsePhoneNumber } from "libphonenumber-js";
import { db } from "../db";
import { env } from "../env";
import { emit } from "../events";
import { AppError, Errors } from "../errors";
import { hashIp, hmac, randomToken } from "../crypto";
import { logger, errorMessage } from "../logger";
import { limitBy } from "../rate-limit";
import { requestMeta } from "../request";
import { getSettings } from "../settings/service";
import { getCurrentUser } from "../auth/session";
import { applyStockChange, afterStockChange } from "../catalog/inventory";
import { activeIntegration } from "../integrations/service";
import { paymentMethodTitle, getPaymentProvider } from "../integrations/registry";
import { recordPaymentLog } from "../payments/service";
import { baseCurrency, converter } from "./currency";
import { clearCart, computeCart, findCart } from "./cart";
import { quoteShipping } from "./shipping";
import { t } from "@/lib/i18n-text";

export const phoneSchema = z
  .string()
  .trim()
  .min(4)
  .max(20)
  .refine((v) => isValidPhoneNumber(v), { message: "invalid_phone" })
  .transform((v) => parsePhoneNumber(v).number); // normalised E.164, e.g. +9627XXXXXXXX

export const addressSchema = z.object({
  fullName: z.string().trim().min(2).max(120),
  phone: phoneSchema,
  country: z.string().trim().length(2).transform((s) => s.toUpperCase()),
  city: z.string().trim().min(2).max(80),
  area: z.string().trim().max(80).optional().or(z.literal("")),
  line1: z.string().trim().min(3).max(200),
  line2: z.string().trim().max(200).optional().or(z.literal("")),
  postalCode: z.string().trim().max(20).optional().or(z.literal("")),
  /** The chosen city/governorate when the country has a city list. */
  regionId: z.string().max(64).nullable().optional(),
});

export const checkoutSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(200),
  address: addressSchema,
  shippingMethodId: z.string().min(1),
  paymentMethod: z.string().min(1).max(40),
  customerNote: z.string().trim().max(1000).optional().or(z.literal("")),
  acceptTerms: z.boolean().optional(),
  saveAddress: z.boolean().optional(),
  marketingOptIn: z.boolean().optional(),
  displayCurrency: z.string().length(3).optional(),
});

export type CheckoutInput = z.infer<typeof checkoutSchema>;

/** Enabled payment methods for the checkout page (public data only). */
export async function availablePaymentMethods(locale: string, total: number) {
  const rows = await db.integration.findMany({ where: { category: "payments", isEnabled: true }, orderBy: { position: "asc" } });
  const base = await baseCurrency();
  return rows
    .filter((r) => getPaymentProvider(r.key)?.availability === "available")
    .filter((r) => {
      const max = Number((r.config as Record<string, unknown>).maxOrderTotal);
      return !max || total <= max * 10 ** base.decimals;
    })
    .map((r) => {
      const def = getPaymentProvider(r.key)!;
      const cfg = r.config as Record<string, string>;
      return {
        key: r.key,
        title: paymentMethodTitle(r.key, cfg, locale),
        instructions: cfg[`instructions_${locale}`] || cfg.instructions_en || "",
        icon: def.icon,
        online: r.key !== "cod" && r.key !== "bank_transfer",
        testMode: r.mode !== "live" && Boolean(def.supportsModes),
      };
    });
}

async function nextOrderNumber(prefix: string) {
  const [{ nextval }] = await db.$queryRaw<{ nextval: bigint }[]>`SELECT nextval('order_number_seq')`;
  return `${prefix}-${nextval.toString()}`;
}

export type PlaceOrderResult = { orderNumber: string; redirectUrl: string };

/**
 * Place an order. Everything monetary is recomputed server-side; stock is
 * decremented with guarded updates inside one transaction so two shoppers
 * can't buy the last unit; coupons are redeemed with a conditional increment
 * so usage limits hold under concurrency.
 */
export async function placeOrder(raw: unknown, locale: string): Promise<PlaceOrderResult> {
  const meta = await requestMeta();
  const lim = limitBy("checkout", meta.ip ?? "unknown");
  if (!lim.ok) throw Errors.rateLimited(lim.retryAfterSec);

  const input = checkoutSchema.parse(raw);
  const [user, checkoutCfg, store, cart] = await Promise.all([getCurrentUser(), getSettings("checkout"), getSettings("store"), findCart()]);
  if (!user && !checkoutCfg.guestCheckout) throw new AppError("login_required", 401);
  if (checkoutCfg.requireTerms && !input.acceptTerms) throw Errors.invalid({ acceptTerms: ["required"] });
  if (checkoutCfg.allowedCountries.length && !checkoutCfg.allowedCountries.includes(input.address.country)) throw Errors.invalid({ "address.country": ["not_shipped"] });
  if (checkoutCfg.postalCode === "required" && !input.address.postalCode) throw Errors.invalid({ "address.postalCode": ["required"] });
  if (!cart || !cart.items.length) throw new AppError("cart_empty", 422);
  // Countries with a city list require a valid city; its name becomes the order's city.
  const dest = await resolveDestination(input.address.country, input.address.regionId);
  if (dest.region) input.address.city = t(dest.region.name, locale) || input.address.city;
  input.address.regionId = dest.region?.id ?? null;

  const email = user?.email ?? input.email;
  const totals = await computeCart(cart, locale, { email, userId: user?.id, country: input.address.country, regionId: input.address.regionId });
  if (totals.hasIssues) throw new AppError("cart_has_issues", 409);
  if (totals.coupon && !totals.coupon.valid) throw new AppError("coupon_invalid", 409, { reason: totals.coupon.reason });
  if (totals.subtotal < checkoutCfg.minOrderAmount) throw new AppError("below_minimum", 422);

  const quotes = await quoteShipping({ country: input.address.country, regionId: input.address.regionId, subtotal: totals.subtotal - totals.discountTotal, weightGrams: totals.weightGrams, freeShipping: totals.freeShipping, requiresShipping: totals.requiresShipping, locale });
  const shipping = quotes.find((q) => q.id === input.shippingMethodId);
  if (!shipping) throw Errors.invalid({ shippingMethodId: ["unavailable"] });

  const methods = await availablePaymentMethods(locale, totals.total + shipping.cost);
  if (!methods.some((m) => m.key === input.paymentMethod)) throw Errors.invalid({ paymentMethod: ["unavailable"] });

  const base = await baseCurrency();
  const shippingTotal = shipping.cost;
  const total = totals.total + shippingTotal;
  const orderNumber = await nextOrderNumber(store.orderNumberPrefix);
  const accessToken = randomToken(24);
  const method = await db.shippingMethod.findUnique({ where: { id: shipping.id } });

  const stockResults: { productId: string; variantId: string | null; balance: number; previous: number }[] = [];

  const order = await db.$transaction(
    async (tx) => {
      for (const line of totals.lines) {
        const r = await applyStockChange(
          { productId: line.productId, variantId: line.variantId, delta: -line.quantity, reason: "ORDER", note: orderNumber, enforce: true },
          tx,
        );
        if (r) stockResults.push({ productId: line.productId, variantId: line.variantId, balance: r.balance, previous: r.balance + line.quantity });
      }

      for (const d of totals.discounts) {
        const coupon = await tx.coupon.findUniqueOrThrow({ where: { id: d.couponId } });
        if (coupon.usageLimit != null) {
          const ok = await tx.coupon.updateMany({ where: { id: coupon.id, usedCount: { lt: coupon.usageLimit } }, data: { usedCount: { increment: 1 } } });
          if (ok.count !== 1) throw new AppError("coupon_invalid", 409, { reason: "usage_limit" });
        } else {
          await tx.coupon.update({ where: { id: coupon.id }, data: { usedCount: { increment: 1 } } });
        }
      }

      if (user && totals.points.using > 0) {
        const ok = await tx.user.updateMany({ where: { id: user.id, pointsBalance: { gte: totals.points.using } }, data: { pointsBalance: { decrement: totals.points.using } } });
        if (ok.count !== 1) throw new AppError("points_unavailable", 409);
      }

      const created = await tx.order.create({
        data: {
          number: orderNumber,
          userId: user?.id,
          email,
          phone: input.address.phone,
          customerName: input.address.fullName,
          statusKey: "pending",
          paymentStatus: "UNPAID",
          paymentMethod: input.paymentMethod,
          currency: base.code,
          displayCurrency: input.displayCurrency,
          locale,
          subtotal: totals.subtotal,
          discountTotal: totals.discountTotal + totals.points.value,
          shippingTotal,
          taxTotal: totals.tax.amount,
          total,
          pointsRedeemed: totals.points.using,
          couponCode: totals.coupon?.valid ? totals.coupon.code : null,
          shippingAddress: input.address,
          shippingMethodId: shipping.id,
          shippingMethodName: method?.name ?? { en: shipping.name },
          customerNote: checkoutCfg.allowOrderNotes ? input.customerNote || null : null,
          accessTokenHash: hmac(accessToken, "order-access"),
          ipHash: hashIp(meta.ip),
          userAgent: meta.userAgent,
          items: {
            create: totals.lines.map((l) => ({
              productId: l.productId,
              variantId: l.variantId,
              sku: l.sku,
              name: cart.items.find((i) => i.id === l.id)!.product.name as object,
              variantLabel: l.variantLabel ? { [locale]: l.variantLabel } : undefined,
              imageUrl: l.image?.url,
              unitPrice: l.unitPrice,
              regularUnitPrice: l.regularUnitPrice,
              quantity: l.quantity,
              discountTotal: l.discount,
              total: l.lineTotal - l.discount,
            })),
          },
          discounts: {
            create: [
              ...totals.discounts.map((d) => ({ couponId: d.couponId, code: d.code, label: { [locale]: d.label }, amount: d.amount })),
              ...(totals.points.value > 0 ? [{ label: { en: `${totals.points.using} points`, ar: `${totals.points.using} نقطة` }, amount: totals.points.value }] : []),
            ],
          },
          history: { create: { toStatus: "pending", note: "Order placed" } },
        },
      });

      for (const d of totals.discounts) {
        await tx.couponRedemption.create({ data: { couponId: d.couponId, orderId: created.id, email, amount: d.amount } });
      }
      if (user && totals.points.using > 0) {
        const after = await tx.user.findUniqueOrThrow({ where: { id: user.id }, select: { pointsBalance: true } });
        await tx.pointsTransaction.create({ data: { userId: user.id, delta: -totals.points.using, balanceAfter: after.pointsBalance, reason: "ORDER_REDEEMED", orderId: created.id } });
      }
      // Increment sales counters used for "best selling" sort.
      for (const l of totals.lines) await tx.product.update({ where: { id: l.productId }, data: { salesCount: { increment: l.quantity } } });

      await clearCart(cart.id, tx);
      return created;
    },
    { timeout: 20_000, isolationLevel: "ReadCommitted" },
  );

  // Post-commit side effects.
  for (const s of stockResults) afterStockChange(s.productId, s.variantId, s.balance, s.previous).catch(() => {});
  if (user && input.saveAddress) {
    const exists = await db.address.findFirst({ where: { userId: user.id, line1: input.address.line1, city: input.address.city } });
    if (!exists) {
      const count = await db.address.count({ where: { userId: user.id } });
      await db.address.create({ data: { userId: user.id, ...input.address, area: input.address.area || null, line2: input.address.line2 || null, postalCode: input.address.postalCode || null, isDefault: count === 0 } });
    }
  }
  if (input.marketingOptIn) {
    await db.newsletterSubscriber.upsert({ where: { email }, create: { email, locale, source: "checkout" }, update: { status: "subscribed", unsubscribedAt: null } }).catch(() => {});
  }
  emit("ORDER_CREATED", { orderId: order.id });

  const confirmation = `/${locale}/order/${order.number}?token=${accessToken}`;
  const provider = getPaymentProvider(input.paymentMethod);
  const ctx = await activeIntegration(input.paymentMethod);
  if (!provider?.payment || !ctx) return { orderNumber: order.number, redirectUrl: confirmation };

  try {
    const result = await provider.payment.init(
      {
        id: order.id,
        number: order.number,
        total: order.total,
        currency: base.code,
        baseDecimals: base.decimals,
        email,
        customerName: order.customerName,
        locale,
        items: totals.lines.map((l) => ({ name: l.name, quantity: l.quantity, unitPrice: l.unitPrice })),
      },
      ctx,
      {
        success: `${env().APP_URL}/api/payments/${provider.key}/return?order=${order.number}&token=${accessToken}&locale=${locale}`,
        cancel: `${env().APP_URL}/${locale}/checkout?cancelled=${order.number}`,
        webhook: `${env().APP_URL}/api/payments/${provider.key}/webhook`,
      },
      await converter(),
    );
    if (result.type === "offline") return { orderNumber: order.number, redirectUrl: confirmation };
    await db.payment.create({ data: { orderId: order.id, provider: provider.key, mode: ctx.mode, providerRef: result.providerRef, amount: order.total, currency: base.code, status: "PENDING" } });
    await db.order.update({ where: { id: order.id }, data: { paymentStatus: "PENDING" } });
    await recordPaymentLog(provider.key, "info", "init", `Redirecting to hosted payment page`, { orderId: order.id, providerRef: result.providerRef });
    return { orderNumber: order.number, redirectUrl: result.url };
  } catch (e) {
    await recordPaymentLog(provider.key, "error", "init_failed", errorMessage(e), { orderId: order.id });
    logger.error("payments", `Payment init failed for ${order.number}`, { provider: provider.key, error: errorMessage(e) });
    await db.order.update({ where: { id: order.id }, data: { paymentStatus: "FAILED" } });
    emit("PAYMENT_FAILED", { orderId: order.id, provider: provider.key, message: errorMessage(e) });
    // The order exists; send the shopper to its page where they can retry or contact us.
    return { orderNumber: order.number, redirectUrl: `${confirmation}&payment=failed` };
  }
}

/** Public confirmation lookup — requires the unguessable access token or ownership. */
export async function findOrderForShopper(number: string, token: string | null) {
  const order = await db.order.findUnique({ where: { number }, include: { items: true, status: true, discounts: true, payments: { orderBy: { createdAt: "desc" }, take: 1 } } });
  if (!order) return null;
  const user = await getCurrentUser();
  const owns = user && order.userId === user.id;
  const tokenOk = token && order.accessTokenHash && hmac(token, "order-access") === order.accessTokenHash;
  return owns || tokenOk ? order : null;
}

export function shippingName(order: { shippingMethodName: unknown }, locale: string) {
  return t(order.shippingMethodName, locale);
}

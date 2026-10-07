/**
 * Pure coupon/promotion evaluation. The server loads the coupon, cart lines
 * and customer history, then calls this — making the rules unit-testable.
 */
export type DiscountLine = {
  key: string;
  productId: string;
  categoryIds: string[];
  brandId: string | null;
  unitPrice: number;
  quantity: number;
  onSale: boolean;
};

export type CouponRule = {
  id: string;
  code: string | null;
  type: "PERCENT" | "FIXED" | "FREE_SHIPPING";
  value: number; // PERCENT: basis points; FIXED: minor units
  maxDiscount: number | null;
  minSubtotal: number | null;
  scope: "ALL" | "PRODUCTS" | "CATEGORIES" | "BRANDS";
  targetIds: string[];
  excludeSaleItems: boolean;
  firstOrderOnly: boolean;
  allowedEmails: string[];
  usageLimit: number | null;
  usageLimitPerCustomer: number | null;
  usedCount: number;
  startsAt: Date | null;
  endsAt: Date | null;
  isActive: boolean;
  /** Targeting (empty = everywhere): ISO countries and/or city (region) ids. */
  countries?: string[];
  regionIds?: string[];
};

export type CouponContext = {
  email: string | null;
  customerOrderCount: number;
  customerUsageCount: number;
  now?: Date;
  /** Delivery destination, when known (cart: visitor's country; checkout: chosen address). */
  country?: string | null;
  regionId?: string | null;
};

export type CouponEvaluation =
  | { ok: true; amount: number; freeShipping: boolean; eligibleSubtotal: number; perLine: Record<string, number> }
  | { ok: false; reason: CouponRejection };

export type CouponRejection =
  | "inactive"
  | "not_started"
  | "expired"
  | "usage_limit"
  | "customer_limit"
  | "first_order_only"
  | "email_not_allowed"
  | "min_subtotal"
  | "no_eligible_items"
  | "login_required"
  | "not_available_here";

export function lineEligible(rule: CouponRule, line: DiscountLine) {
  if (rule.excludeSaleItems && line.onSale) return false;
  switch (rule.scope) {
    case "ALL":
      return true;
    case "PRODUCTS":
      return rule.targetIds.includes(line.productId);
    case "CATEGORIES":
      return line.categoryIds.some((c) => rule.targetIds.includes(c));
    case "BRANDS":
      return line.brandId != null && rule.targetIds.includes(line.brandId);
  }
}

export function evaluateCoupon(rule: CouponRule, lines: DiscountLine[], ctx: CouponContext): CouponEvaluation {
  const now = ctx.now ?? new Date();
  if (!rule.isActive) return { ok: false, reason: "inactive" };
  if (rule.startsAt && now < rule.startsAt) return { ok: false, reason: "not_started" };
  if (rule.endsAt && now >= rule.endsAt) return { ok: false, reason: "expired" };
  if (rule.usageLimit != null && rule.usedCount >= rule.usageLimit) return { ok: false, reason: "usage_limit" };
  // Country / city targeting: offers limited to certain places apply only there
  // (either list matching is enough — e.g. "all of the UAE, or Riyadh").
  if (rule.countries?.length || rule.regionIds?.length) {
    const inCountry = Boolean(ctx.country && rule.countries?.includes(ctx.country.toUpperCase()));
    const inCity = Boolean(ctx.regionId && rule.regionIds?.includes(ctx.regionId));
    if (!inCountry && !inCity) return { ok: false, reason: "not_available_here" };
  }
  if ((rule.usageLimitPerCustomer != null || rule.firstOrderOnly || rule.allowedEmails.length) && !ctx.email)
    return { ok: false, reason: "login_required" };
  if (rule.usageLimitPerCustomer != null && ctx.customerUsageCount >= rule.usageLimitPerCustomer) return { ok: false, reason: "customer_limit" };
  if (rule.firstOrderOnly && ctx.customerOrderCount > 0) return { ok: false, reason: "first_order_only" };
  if (rule.allowedEmails.length && !rule.allowedEmails.map((e) => e.toLowerCase()).includes((ctx.email ?? "").toLowerCase()))
    return { ok: false, reason: "email_not_allowed" };

  const subtotal = lines.reduce((s, l) => s + l.unitPrice * l.quantity, 0);
  if (rule.minSubtotal != null && subtotal < rule.minSubtotal) return { ok: false, reason: "min_subtotal" };

  const eligible = lines.filter((l) => lineEligible(rule, l));
  const eligibleSubtotal = eligible.reduce((s, l) => s + l.unitPrice * l.quantity, 0);
  if (!eligible.length || eligibleSubtotal <= 0) return { ok: false, reason: "no_eligible_items" };

  if (rule.type === "FREE_SHIPPING") return { ok: true, amount: 0, freeShipping: true, eligibleSubtotal, perLine: {} };

  let amount = rule.type === "PERCENT" ? Math.floor((eligibleSubtotal * rule.value) / 10_000) : rule.value;
  if (rule.maxDiscount != null) amount = Math.min(amount, rule.maxDiscount);
  amount = Math.min(amount, eligibleSubtotal);

  // Allocate proportionally across eligible lines (largest-remainder) so
  // per-item discounts sum exactly to the total — needed for partial refunds.
  const perLine: Record<string, number> = {};
  let allocated = 0;
  const shares = eligible.map((l) => {
    const exact = (amount * l.unitPrice * l.quantity) / eligibleSubtotal;
    const floor = Math.floor(exact);
    allocated += floor;
    perLine[l.key] = floor;
    return { key: l.key, rem: exact - floor };
  });
  shares.sort((a, b) => b.rem - a.rem);
  for (let i = 0; i < amount - allocated; i++) perLine[shares[i % shares.length].key] += 1;

  return { ok: true, amount, freeShipping: false, eligibleSubtotal, perLine };
}

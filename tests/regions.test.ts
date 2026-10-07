import { describe, expect, it } from "vitest";
import { evaluateCoupon, type CouponRule, type DiscountLine } from "@/lib/discounts";
import { REGION_PRESETS, regionPresetCount } from "@/config/regions-data";

const rule = (over: Partial<CouponRule> = {}): CouponRule => ({
  id: "c1",
  code: "SAVE10",
  type: "PERCENT",
  value: 1000,
  maxDiscount: null,
  minSubtotal: null,
  scope: "ALL",
  targetIds: [],
  excludeSaleItems: false,
  firstOrderOnly: false,
  allowedEmails: [],
  usageLimit: null,
  usageLimitPerCustomer: null,
  usedCount: 0,
  startsAt: null,
  endsAt: null,
  isActive: true,
  ...over,
});
const lines: DiscountLine[] = [{ key: "a", productId: "p", categoryIds: [], brandId: null, unitPrice: 10_000, quantity: 1, onSale: false }];
const ctx = (country: string | null, regionId: string | null = null) => ({ email: null, customerOrderCount: 0, customerUsageCount: 0, now: new Date(), country, regionId });

describe("coupon targeting by country and city", () => {
  it("applies everywhere when no targeting is set", () => {
    expect(evaluateCoupon(rule(), lines, ctx("AE")).ok).toBe(true);
  });

  it("limits to the listed countries", () => {
    const r = rule({ countries: ["SA"] });
    expect(evaluateCoupon(r, lines, ctx("sa")).ok).toBe(true);
    expect(evaluateCoupon(r, lines, ctx("AE"))).toMatchObject({ ok: false, reason: "not_available_here" });
    expect(evaluateCoupon(r, lines, ctx(null)).ok).toBe(false);
  });

  it("limits to the listed cities", () => {
    const r = rule({ regionIds: ["riyadh"] });
    expect(evaluateCoupon(r, lines, ctx("SA", "riyadh")).ok).toBe(true);
    expect(evaluateCoupon(r, lines, ctx("SA", "jeddah")).ok).toBe(false);
    expect(evaluateCoupon(r, lines, ctx("SA")).ok).toBe(false);
  });

  it("matches either a listed country or a listed city", () => {
    const r = rule({ countries: ["AE"], regionIds: ["riyadh"] });
    expect(evaluateCoupon(r, lines, ctx("AE")).ok).toBe(true);
    expect(evaluateCoupon(r, lines, ctx("SA", "riyadh")).ok).toBe(true);
    expect(evaluateCoupon(r, lines, ctx("SA", "jeddah")).ok).toBe(false);
  });
});

describe("region presets", () => {
  it("covers every Saudi region and governorate with both languages", () => {
    expect(REGION_PRESETS.SA).toHaveLength(13);
    expect(regionPresetCount("SA")).toBeGreaterThanOrEqual(140);
    const all = REGION_PRESETS.SA.flatMap((g) => g.cities);
    for (const c of all) expect(c.en && c.ar).toBeTruthy();
    expect(new Set(all.map((c) => c.en)).size).toBe(all.length);
  });
});

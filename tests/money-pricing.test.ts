import { describe, expect, it } from "vitest";
import { formatMoney, parseMajor, discountPercent, toMinor, type MoneyContext } from "@/lib/money";
import { resolvePrice, variantPriceSource, stockState } from "@/lib/pricing";

const jod: MoneyContext = {
  base: { code: "JOD", decimals: 3 },
  display: { code: "JOD", symbol: "JOD", decimals: 3, symbolPosition: "AFTER", thousandsSep: ",", decimalSep: ".", rate: 1 },
};

describe("money", () => {
  it("formats JOD minor units with 3 decimals and grouping", () => {
    expect(formatMoney(1_234_500, jod)).toBe("1,234.500 JOD");
  });

  it("trims all-zero decimals only when asked", () => {
    expect(formatMoney(349_000, jod, { trimZeros: true })).toBe("349 JOD");
    expect(formatMoney(349_500, jod, { trimZeros: true })).toBe("349.500 JOD");
  });

  it("converts to the display currency using its rate and decimals", () => {
    const usd: MoneyContext = { ...jod, display: { code: "USD", symbol: "$", decimals: 2, symbolPosition: "BEFORE", thousandsSep: ",", decimalSep: ".", rate: 1.41 } };
    expect(formatMoney(100_000, usd)).toBe("$141.00");
  });

  it("renders Arabic-Indic digits when enabled", () => {
    const ar: MoneyContext = { ...jod, display: { ...jod.display, symbol: "د.أ", arabicDigits: true } };
    expect(formatMoney(12_500, ar)).toBe("١٢.٥٠٠ د.أ");
  });

  it("keeps the sign for negative amounts (refunds)", () => {
    expect(formatMoney(-5_000, jod, { trimZeros: true })).toBe("-5 JOD");
  });

  it("parses user input to minor units and rejects junk", () => {
    expect(parseMajor("349.5", 3)).toBe(349_500);
    expect(parseMajor("1,200", 3)).toBe(1_200_000);
    expect(parseMajor("12abc", 3)).toBeNull();
    expect(toMinor(0.1 + 0.2, 2)).toBe(30); // no float drift
  });

  it("never over-promises a discount", () => {
    expect(discountPercent(1000, 667)).toBe(33);
    expect(discountPercent(1000, 1000)).toBe(0);
  });
});

describe("pricing", () => {
  const now = new Date("2026-10-06T12:00:00Z");

  it("applies a sale only inside its window", () => {
    const src = { price: 1000, salePrice: 800, saleStartsAt: "2026-10-01T00:00:00Z", saleEndsAt: "2026-10-10T00:00:00Z" };
    expect(resolvePrice(src, now)).toMatchObject({ current: 800, onSale: true, percent: 20, savings: 200 });
    expect(resolvePrice(src, new Date("2026-10-11T00:00:00Z"))).toMatchObject({ current: 1000, onSale: false });
  });

  it("ignores a sale price that isn't lower than the price", () => {
    expect(resolvePrice({ price: 1000, salePrice: 1200, saleStartsAt: null, saleEndsAt: null }, now).onSale).toBe(false);
  });

  it("variant with its own price does not inherit the product sale", () => {
    const product = { price: 1000, salePrice: 700, saleStartsAt: null, saleEndsAt: null };
    expect(resolvePrice(variantPriceSource(product, { price: 1500, salePrice: null }), now).current).toBe(1500);
    expect(resolvePrice(variantPriceSource(product, { price: null, salePrice: null }), now).current).toBe(700);
  });

  it("derives stock state from inventory settings", () => {
    expect(stockState({ track: true, stock: 0, lowThreshold: 5, allowBackorder: false })).toBe("OUT_OF_STOCK");
    expect(stockState({ track: true, stock: 3, lowThreshold: 5, allowBackorder: false })).toBe("LOW_STOCK");
    expect(stockState({ track: true, stock: 0, lowThreshold: 5, allowBackorder: true })).toBe("BACKORDER");
    expect(stockState({ track: false, stock: 0, lowThreshold: 5, allowBackorder: false })).toBe("IN_STOCK");
  });
});

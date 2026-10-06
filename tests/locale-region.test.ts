import { describe, expect, it } from "vitest";
import { regionFromAcceptLanguage } from "@/server/request";
import { currencyForCountry } from "@/config/currencies";

describe("regionFromAcceptLanguage", () => {
  it("reads the first region subtag", () => {
    expect(regionFromAcceptLanguage("ar-AE")).toBe("AE");
    expect(regionFromAcceptLanguage("ar-SA,ar;q=0.9,en;q=0.8")).toBe("SA");
    expect(regionFromAcceptLanguage("en;q=0.9, en-GB;q=0.8")).toBe("GB");
    expect(regionFromAcceptLanguage("zh_tw")).toBe("TW");
  });
  it("ignores script subtags and language-only values", () => {
    expect(regionFromAcceptLanguage("ar")).toBeNull();
    expect(regionFromAcceptLanguage("zh-Hant")).toBeNull();
    expect(regionFromAcceptLanguage("")).toBeNull();
    expect(regionFromAcceptLanguage(null)).toBeNull();
  });
});

describe("currencyForCountry", () => {
  it("maps countries to their shopping currency", () => {
    expect(currencyForCountry("AE")).toBe("AED");
    expect(currencyForCountry("SA")).toBe("SAR");
    expect(currencyForCountry(null)).toBeNull();
  });
});

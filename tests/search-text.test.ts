import { describe, expect, it } from "vitest";
import { normalizeText, phoneticKey, labelScore, editDistance } from "@/lib/search-text";

describe("normalizeText", () => {
  it("folds Arabic spelling variants", () => {
    expect(normalizeText("أبل")).toBe(normalizeText("ابل"));
    expect(normalizeText("إيفون")).toBe("ايفون");
    expect(normalizeText("آيفون")).toBe("ايفون");
    expect(normalizeText("شاشة")).toBe("شاشه");
    expect(normalizeText("مستشفى")).toBe("مستشفي");
    expect(normalizeText("سَامْسُونْج")).toBe("سامسونج"); // diacritics
    expect(normalizeText("ســامســونج")).toBe("سامسونج"); // tatweel
    expect(normalizeText("آيفون ١٧ برو")).toBe("ايفون 17 برو");
  });
  it("lowercases Latin, strips accents and punctuation but keeps +", () => {
    expect(normalizeText("Galaxy S25+  (Ultra)!")).toBe("galaxy s25+ ultra");
    expect(normalizeText("Café")).toBe("cafe");
  });
});

describe("phoneticKey — Arabic and English meet", () => {
  const same = (a: string, b: string) => expect(phoneticKey(a)).toBe(phoneticKey(b));
  it("matches common transliterations", () => {
    same("iphone", "ايفون");
    same("samsung", "سامسونج");
    same("galaxy", "جالكسي");
    same("pixel", "بكسل");
    same("xiaomi", "شاومي");
    same("airpods", "ايربودز");
    same("google", "جوجل");
    same("apple", "ابل");
    same("lenovo", "لينوفو");
  });
  it("tolerates English typos", () => {
    same("iphon", "iphone");
    same("samsng", "samsung");
    same("galxy", "galaxy");
    same("airpds", "airpods");
  });
  it("joins multi-word phrases", () => {
    expect(phoneticKey("ماك بوك").split(" ")).toContain(phoneticKey("macbook"));
  });
  it("keeps model numbers", () => {
    expect(phoneticKey("iPhone 17 Pro")).toBe(phoneticKey("ايفون 17 برو"));
  });
});

describe("labelScore", () => {
  it("ranks exact > prefix > phonetic > typo", () => {
    const exact = labelScore("Samsung", "Samsung");
    const prefix = labelScore("sams", "Samsung");
    const phonetic = labelScore("سامسونج", "Samsung");
    const typo = labelScore("samsnug", "Samsung");
    expect(exact).toBeGreaterThan(prefix);
    expect(prefix).toBeGreaterThan(phonetic);
    expect(phonetic).toBeGreaterThan(0);
    expect(typo).toBeGreaterThan(0);
    expect(labelScore("zzzz", "Samsung")).toBe(0);
  });
  it("edit distance exits early", () => {
    expect(editDistance("kitten", "sitting", 3)).toBe(3);
    expect(editDistance("a", "abcdefgh", 2)).toBe(3);
  });
});

import { stemWord } from "@/lib/search-text";
describe("stemWord", () => {
  it("reduces Arabic plural/definite forms to a shared stem", () => {
    const n = (s: string) => stemWord(normalizeText(s));
    expect(n("الساعات")).toBe(n("ساعة"));
    expect(n("سماعات")).toBe(n("السماعة"));
    expect(n("iphone")).toBe("iphone");
  });
});

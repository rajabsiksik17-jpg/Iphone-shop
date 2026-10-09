import { describe, expect, it } from "vitest";
import { STORE_TYPES, storeTypeByKey, type PresetCategory } from "@/config/store-types";
import { STORE_TEMPLATES } from "@/config/store-templates";
import { ART_KINDS } from "@/server/templates/art";
import { COUNTRY_PROFILES, countryProfile } from "@/config/countries";
import { CURRENCY_CATALOG } from "@/config/currencies";
import { regionPresetCount } from "@/config/regions-data";

const categoryAt = (cats: PresetCategory[], path: string) => {
  const [a, b] = path.split(".").map(Number);
  const root = cats[a];
  return b === undefined ? root : root?.children?.[b];
};

describe("store-type templates", () => {
  it("cover every store type with categories, brands and products", () => {
    expect(STORE_TYPES.length).toBeGreaterThanOrEqual(26);
    for (const type of STORE_TYPES) {
      const t = STORE_TEMPLATES[type.key];
      expect(t, type.key).toBeDefined();
      expect(t.brands.length, type.key).toBeGreaterThanOrEqual(2);
      expect(t.products.length, type.key).toBeGreaterThanOrEqual(5);
      expect(type.categories.length, type.key).toBeGreaterThanOrEqual(3);
      expect(t.categoryArt.length, type.key).toBe(type.categories.length);
    }
  });

  it("only reference categories, brands, attributes and values that exist", () => {
    for (const [key, t] of Object.entries(STORE_TEMPLATES)) {
      const preset = storeTypeByKey(key)!;
      expect(preset, key).toBeDefined();
      const refs = new Set<string>();
      for (const p of t.products) {
        const where = `${key}/${p.ref}`;
        expect(refs.has(p.ref), `duplicate ${where}`).toBe(false);
        refs.add(p.ref);
        expect(categoryAt(preset.categories, p.cat), `${where} category ${p.cat}`).toBeDefined();
        expect(t.brands[p.brand], `${where} brand`).toBeDefined();
        expect(ART_KINDS, `${where} art`).toContain(p.art);
        if (p.sale) expect(p.sale, where).toBeLessThan(p.price);
        for (const [attrKey, value] of Object.entries(p.specs ?? {})) {
          const attr = preset.attributes.find((a) => a.key === attrKey);
          expect(attr, `${where} attribute ${attrKey}`).toBeDefined();
          if (attr!.values) {
            const labels = attr!.values.map((v) => v.en);
            for (const v of Array.isArray(value) ? value : [value]) expect(labels, `${where} ${attrKey}=${String(v)}`).toContain(v);
          }
        }
        if (p.variants) {
          const attr = preset.attributes.find((a) => a.key === p.variants!.attr);
          expect(attr?.variant, `${where} variant axis ${p.variants.attr}`).toBe(true);
          const labels = attr!.values!.map((v) => v.en);
          for (const v of p.variants.values) expect(labels, `${where} variant ${v}`).toContain(v);
          expect(p.specs?.[p.variants.attr], `${where} axis also in specs`).toBeUndefined();
        }
      }
    }
  });

  it("keep every type's demo catalogue isolated (no product shared between types)", () => {
    const seen = new Map<string, string>();
    for (const [key, t] of Object.entries(STORE_TEMPLATES)) for (const p of t.products) {
      const ref = `${key}/product/${p.ref}`;
      expect(seen.has(ref)).toBe(false);
      seen.set(ref, key);
    }
  });
});

describe("country profiles", () => {
  it("cover the supported primary countries with currency, dial code and timezone", () => {
    const codes = COUNTRY_PROFILES.map((c) => c.code);
    for (const cc of ["SA", "JO", "AE", "KW", "QA", "BH", "OM", "EG", "IQ", "LB", "PS", "MA", "TN", "DZ"]) expect(codes).toContain(cc);
    for (const c of COUNTRY_PROFILES) {
      expect(c.dialCode, c.code).toMatch(/^\+\d+$/);
      expect(CURRENCY_CATALOG.some((x) => x.code === c.currency), `${c.code} currency`).toBe(true);
      expect(c.timezone, c.code).not.toBe("UTC");
      expect(regionPresetCount(c.code), `${c.code} governorates`).toBeGreaterThan(0);
    }
  });

  it("derive Saudi and Jordanian defaults from the same data", () => {
    expect(countryProfile("SA")).toMatchObject({ currency: "SAR", dialCode: "+966", timezone: "Asia/Riyadh" });
    expect(countryProfile("jo")).toMatchObject({ currency: "JOD", dialCode: "+962", timezone: "Asia/Amman" });
    expect(countryProfile("SA").tax.rateBp).toBe(1500);
  });

  it("fall back safely for countries without a profile", () => {
    const p = countryProfile("FR");
    expect(p.code).toBe("FR");
    expect(p.dialCode).toBe("+33");
    expect(p.address.postalCode).toBe("optional");
  });
});

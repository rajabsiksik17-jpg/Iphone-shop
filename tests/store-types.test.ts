import { describe, expect, it } from "vitest";
import { icons } from "lucide-react";
import { STORE_TYPES } from "@/config/store-types";
import { SECTION_DEFINITIONS } from "@/cms/sections";

const lucideName = (v: string) => (v.startsWith("lucide:") ? v.slice(7) : v);

describe("store type presets", () => {
  it("has at least 20 presets with unique keys", () => {
    expect(STORE_TYPES.length).toBeGreaterThanOrEqual(20);
    expect(new Set(STORE_TYPES.map((p) => p.key)).size).toBe(STORE_TYPES.length);
  });

  it("only shows attributes on cards that the preset defines", () => {
    for (const p of STORE_TYPES) for (const k of p.cardAttributes) expect(p.attributes.some((a) => a.key === k), `${p.key}: ${k}`).toBe(true);
  });

  it("uses icons that exist in the icon library", () => {
    for (const p of STORE_TYPES) {
      const names = [p.icon, ...Object.values(p.icons), ...p.attributes.flatMap((a) => (a.icon ? [a.icon] : [])), ...p.categories.flatMap((c) => (c.icon ? [c.icon] : []))].map(lucideName);
      for (const n of names) expect(icons[n as keyof typeof icons], `${p.key}: ${n}`).toBeTruthy();
    }
  });

  it("recommends only known homepage section types", () => {
    const known = new Set(SECTION_DEFINITIONS.map((d) => d.type));
    for (const p of STORE_TYPES) for (const s of p.homeSections) expect(known.has(s), `${p.key}: ${s}`).toBe(true);
  });

  it("gives shared attribute keys one consistent type", () => {
    const types = new Map<string, string>();
    for (const p of STORE_TYPES)
      for (const a of p.attributes) {
        const seen = types.get(a.key);
        if (seen) expect(a.type, `${p.key}: ${a.key}`).toBe(seen);
        else types.set(a.key, a.type);
      }
  });
});

import { describe, expect, it } from "vitest";
import { hasPermission, hasAnyPermission } from "@/config/permissions";
import { encrypt, decrypt, hmac, safeEqual } from "@/server/crypto";
import { assertSafeKey } from "@/server/media/storage";
import { sanitizeSvgIcon } from "@/server/icons";
import { sanitizeRich } from "@/server/sanitize";
import { schemaFor } from "@/cms/fields";
import { parseSectionData } from "@/cms/sections";

describe("permissions", () => {
  it("requires every listed permission unless wildcard", () => {
    expect(hasPermission(["orders.view"], ["orders.view", "orders.refund"])).toBe(false);
    expect(hasPermission(["*"], ["orders.refund", "staff.manage"])).toBe(true);
    expect(hasAnyPermission(["settings.payments"], ["settings.integrations", "settings.payments"])).toBe(true);
    expect(hasPermission(null, "dashboard.view")).toBe(false);
  });
});

describe("crypto", () => {
  it("round-trips encrypted secrets and detects tampering", () => {
    const sealed = encrypt("smtp-password");
    expect(sealed).not.toContain("smtp-password");
    expect(decrypt(sealed)).toBe("smtp-password");
    const tampered = sealed.slice(0, -4) + (sealed.endsWith("AAAA") ? "BBBB" : "AAAA");
    expect(() => decrypt(tampered)).toThrow();
  });

  it("scopes HMACs by purpose and compares in constant time", () => {
    expect(hmac("x", "session")).not.toBe(hmac("x", "otp"));
    expect(safeEqual("abc", "abc")).toBe(true);
    expect(safeEqual("abc", "abd")).toBe(false);
  });
});

describe("storage keys", () => {
  it("rejects path traversal and odd keys", () => {
    expect(() => assertSafeKey("products/2026/a.webp")).not.toThrow();
    for (const bad of ["../etc/passwd", "a//b", "/abs/path", "a/../../b", "a\\b"]) expect(() => assertSafeKey(bad)).toThrow();
  });
});

describe("sanitisation", () => {
  it("strips scripts and handlers from uploaded SVG icons", () => {
    const out = sanitizeSvgIcon('<svg viewBox="0 0 24 24" onload="alert(1)"><script>alert(1)</script><path d="M0 0h24" fill="#f00" onclick="x()"/></svg>');
    expect(out).not.toMatch(/script|onload|onclick|alert/i);
    expect(out).toContain('fill="currentColor"');
  });

  it("rejects files that aren't SVG drawings", () => {
    expect(() => sanitizeSvgIcon("<html><body>hi</body></html>")).toThrow();
  });

  it("removes dangerous markup from rich text", () => {
    const html = sanitizeRich('<p onclick="x()">Hi <a href="javascript:alert(1)">x</a><img src=x onerror=alert(1)></p><script>bad()</script>');
    expect(html).not.toMatch(/onclick|onerror|javascript:|<script/i);
    expect(html).toContain("Hi");
  });
});

describe("CMS validation", () => {
  it("only accepts safe link schemes", () => {
    const schema = schemaFor([{ key: "href", type: "link", label: { en: "Link" } }]);
    expect(schema.safeParse({ href: "/shop" }).success).toBe(true);
    expect(schema.safeParse({ href: "https://example.com" }).success).toBe(true);
    expect(schema.safeParse({ href: "javascript:alert(1)" }).success).toBe(false);
    expect(schema.safeParse({ href: "//evil.example" }).success).toBe(false);
  });

  it("fills defaults so a new section always renders", () => {
    const data = parseSectionData("cta", {});
    expect(data).toBeTypeOf("object");
    expect(() => parseSectionData("not-a-section", {})).toThrow();
  });
});

import { describe, expect, it } from "vitest";
import { ALL_PERMISSIONS, MANAGER_PERMISSIONS, PLATFORM_PERMISSIONS, SYSTEM_ROLES, WILDCARD, hasAnyPermission, hasPermission, isSuperAdmin } from "@/config/permissions";
import { SETTINGS_PERMISSIONS } from "@/server/settings/schemas";
import { SETTINGS_INDEX } from "@/admin/settings-index";

const platform = Object.keys(PLATFORM_PERMISSIONS) as (keyof typeof PLATFORM_PERMISSIONS)[];

describe("platform permissions", () => {
  it("can't be granted to any role — they aren't in the grantable list", () => {
    for (const p of platform) expect(ALL_PERMISSIONS as string[]).not.toContain(p);
  });

  it("are held only by the wildcard super-admin", () => {
    for (const p of platform) {
      expect(hasPermission([WILDCARD], p)).toBe(true);
      expect(hasPermission(ALL_PERMISSIONS, p)).toBe(false);
      expect(hasAnyPermission(ALL_PERMISSIONS, [p])).toBe(false);
    }
  });

  it("ignore a forged role that lists them explicitly", () => {
    expect(hasPermission(["platform.storeType", "platform.country", "settings.general"], "platform.storeType")).toBe(false);
    expect(hasAnyPermission(["platform.admins"], ["platform.admins"])).toBe(false);
  });

  it("gate the store type and primary country settings", () => {
    expect(SETTINGS_PERMISSIONS.storeType).toBe("platform.storeType");
    expect(SETTINGS_PERMISSIONS.geo).toBe("platform.country");
    expect(SETTINGS_INDEX.find((e) => e.href === "/admin/settings/store-type")?.permission).toBe("platform.storeType");
    expect(SETTINGS_INDEX.find((e) => e.href === "/admin/settings/country")?.permission).toBe("platform.country");
  });
});

describe("store manager role", () => {
  const manager = SYSTEM_ROLES.find((r) => r.key === "manager")!;

  it("has broad store-level control", () => {
    for (const p of ["catalog.edit", "catalog.delete", "orders.manage", "orders.refund", "customers.manage", "marketing.manage", "content.manage", "settings.general", "settings.shipping", "settings.payments", "staff.manage"] as const) expect(hasPermission(manager.permissions, p), p).toBe(true);
    expect(manager.permissions).toEqual(MANAGER_PERMISSIONS);
  });

  it("has no platform authority and isn't a super-admin", () => {
    expect(isSuperAdmin(manager.permissions)).toBe(false);
    for (const p of platform) expect(hasPermission(manager.permissions, p)).toBe(false);
  });

  it("only the super_admin system role carries the wildcard", () => {
    expect(SYSTEM_ROLES.filter((r) => r.permissions.includes(WILDCARD)).map((r) => r.key)).toEqual(["super_admin"]);
  });
});

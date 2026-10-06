import "server-only";
import { getLocale } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { hasAnyPermission, hasPermission, type Permission } from "@/config/permissions";
import { getCurrentStaff } from "../auth/session";
import type { Locale } from "@/i18n/config";

/**
 * Server-page guard for admin routes: signed-out → login; signed-in but
 * lacking permission → returns { allowed: false } so the page renders a
 * friendly "no access" state instead of leaking data.
 */
export async function adminPage(permission?: Permission | Permission[], mode: "all" | "any" = "all") {
  const staff = await getCurrentStaff();
  const locale = (await getLocale()) as Locale;
  if (!staff) return redirect({ href: "/admin/login", locale });
  const list = permission ? (Array.isArray(permission) ? permission : [permission]) : [];
  const allowed = !list.length || (mode === "all" ? hasPermission(staff.permissions, list) : hasAnyPermission(staff.permissions, list));
  return { staff, locale, allowed };
}

export const can = (permissions: readonly string[], p: Permission | Permission[]) => hasPermission(permissions, p);

import "server-only";
import { hasAnyPermission, hasPermission, type Permission } from "@/config/permissions";
import { Errors } from "../errors";
import { getCurrentStaff, getCurrentUser } from "./session";

/** Use in server actions & route handlers. Throws `unauthorized`/`forbidden`. */
export async function requireStaff(permission?: Permission | Permission[]) {
  const staff = await getCurrentStaff();
  if (!staff) throw Errors.unauthorized();
  if (permission && !hasPermission(staff.permissions, permission)) throw Errors.forbidden();
  return staff;
}

export async function requireStaffAny(permissions: Permission[]) {
  const staff = await getCurrentStaff();
  if (!staff) throw Errors.unauthorized();
  if (!hasAnyPermission(staff.permissions, permissions)) throw Errors.forbidden();
  return staff;
}

export async function requireCustomer() {
  const user = await getCurrentUser();
  if (!user) throw Errors.unauthorized();
  return user;
}

/** Same-origin check for state-changing route handlers (defence-in-depth vs CSRF). */
export function assertSameOrigin(req: Request) {
  const origin = req.headers.get("origin");
  if (!origin) return; // non-browser clients; cookies are SameSite=Lax anyway
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  try {
    if (new URL(origin).host !== host) throw Errors.forbidden();
  } catch {
    throw Errors.forbidden();
  }
}

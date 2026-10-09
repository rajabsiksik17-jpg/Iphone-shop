import "server-only";
import { db, Prisma } from "../db";
import { isSuperAdmin, WILDCARD } from "@/config/permissions";

/**
 * Super-admin protection. Super-admins hold the platform; store-level staff
 * (including store managers with every store permission) must not see them in
 * staff lists, pickers, sessions or logs, and can never act on their accounts.
 * Enforced here on the server — the UI only mirrors it.
 */

/** Matches users whose role carries the wildcard (super-admins). */
export const superAdminUserWhere: Prisma.UserWhereInput = { role: { is: { permissions: { has: WILDCARD } } } };

/** Users a given staff member may see: everyone for a super-admin, everyone else but super-admins otherwise. */
export function visibleStaffWhere(viewerPermissions: readonly string[]): Prisma.UserWhereInput {
  return isSuperAdmin(viewerPermissions) ? {} : { NOT: superAdminUserWhere };
}

/** Ids of super-admin accounts (small set; used to filter logs and sessions). */
export async function superAdminIds(): Promise<string[]> {
  return (await db.user.findMany({ where: superAdminUserWhere, select: { id: true } })).map((u) => u.id);
}

export async function isSuperAdminUser(userId: string): Promise<boolean> {
  return Boolean(await db.user.findFirst({ where: { id: userId, ...superAdminUserWhere }, select: { id: true } }));
}

/** Shown instead of a super-admin's name/email to store-level staff. */
export const MASKED_ADMIN = { en: "System administrator", ar: "مدير النظام" } as const;

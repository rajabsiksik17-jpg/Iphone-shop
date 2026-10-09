import "server-only";
import { z } from "zod";
import { db, Prisma } from "../db";
import { AppError, Errors } from "../errors";
import { audit } from "../audit";
import { randomInt } from "node:crypto";
import { randomToken } from "../crypto";
import { getSettings } from "../settings/service";
import { hashPassword, passwordIssues, verifyPassword } from "../auth/password";
import { revokeAllSessions } from "../auth/session";
import { ALL_PERMISSIONS, WILDCARD, isSuperAdmin } from "@/config/permissions";
import { MASKED_ADMIN, isSuperAdminUser, superAdminIds, superAdminUserWhere, visibleStaffWhere } from "../auth/protect";
import { localized, t } from "@/lib/i18n-text";
import type { CurrentStaff } from "../auth/session";

const PAGE = 40;
const pageOf = (n?: number) => Math.max(1, n ?? 1);

// ─────────────────────────────── Staff & roles ──────────────────────────────

export async function staffData(locale: string, viewer: CurrentStaff) {
  // Store-level staff never see super-admins or the super-admin role.
  const superView = isSuperAdmin(viewer.permissions);
  const [users, roles] = await Promise.all([
    db.user.findMany({ where: { type: "STAFF", ...visibleStaffWhere(viewer.permissions) }, orderBy: [{ status: "asc" }, { name: "asc" }], include: { role: { select: { id: true, name: true, key: true } }, avatar: { select: { url: true } } } }),
    db.role.findMany({ where: superView ? {} : { NOT: { permissions: { has: WILDCARD } } }, orderBy: [{ isSystem: "desc" }, { createdAt: "asc" }], include: { _count: { select: { users: true } } } }),
  ]);
  return {
    users: users.map((u) => ({ id: u.id, name: u.name, email: u.email, phone: u.phone, status: u.status, locale: u.locale, roleId: u.roleId, role: u.role ? t(u.role.name, locale) : null, avatar: u.avatar?.url ?? null, lastLoginAt: u.lastLoginAt?.toISOString() ?? null, agentStatus: u.agentStatus })),
    roles: roles.map((r) => ({ id: r.id, key: r.key, name: r.name as Record<string, string>, label: t(r.name, locale), description: r.description, permissions: r.permissions, isSystem: r.isSystem, users: r._count.users })),
  };
}
export type StaffData = Awaited<ReturnType<typeof staffData>>;

const staffSchema = z.object({
  name: z.string().trim().min(2).max(80),
  email: z.string().trim().toLowerCase().email().max(200),
  phone: z.string().trim().max(30).nullable(),
  roleId: z.string().max(64),
  status: z.enum(["ACTIVE", "SUSPENDED"]),
  locale: z.enum(["ar", "en"]),
});

/** Strong one-time password shown once to the admin who created/reset it. */
const makeTempPassword = () => `${randomToken(9)}!${randomInt(10, 100)}`;

async function superAdminRoleId() {
  return (await db.role.findUnique({ where: { key: "super_admin" }, select: { id: true } }))?.id ?? null;
}

/** Guard against locking the store out: at least one active super-admin must remain. */
async function assertSuperAdminRemains(exceptUserId: string) {
  const roleId = await superAdminRoleId();
  if (!roleId) return;
  const others = await db.user.count({ where: { type: "STAFF", status: "ACTIVE", roleId, id: { not: exceptUserId } } });
  if (!others) throw new AppError("last_super_admin", 409);
}

/**
 * Create or update a team member. New members get a one-time temporary
 * password that is returned once to the creator and never stored in clear.
 */
export async function saveStaff(id: string | null, raw: unknown, actor: CurrentStaff) {
  const p = staffSchema.parse(raw);
  const role = await db.role.findUnique({ where: { id: p.roleId } });
  if (!role) throw Errors.invalid({ roleId: ["required"] });
  // Only super-admins can grant the super-admin role.
  if (role.permissions.includes(WILDCARD) && !actor.permissions.includes(WILDCARD)) throw Errors.forbidden();
  const clash = await db.user.findFirst({ where: { email: p.email, ...(id ? { id: { not: id } } : {}) } });
  if (clash) throw Errors.invalid({ email: ["taken"] });

  if (id) {
    // Invisible accounts behave as if they don't exist for store-level staff.
    const existing = await db.user.findFirst({ where: { id, type: "STAFF", ...visibleStaffWhere(actor.permissions) }, include: { role: true } });
    if (!existing) throw Errors.notFound("staff");
    if (id === actor.id && (p.roleId !== existing.roleId || p.status !== existing.status)) throw new AppError("cant_edit_self", 409);
    if (existing.role?.permissions.includes(WILDCARD) && !actor.permissions.includes(WILDCARD)) throw Errors.forbidden();
    const losesSuper = existing.role?.key === "super_admin" && (p.roleId !== existing.roleId || p.status !== "ACTIVE");
    if (losesSuper) await assertSuperAdminRemains(id);
    await db.user.update({ where: { id }, data: p });
    if (p.status === "SUSPENDED" || p.roleId !== existing.roleId) await revokeAllSessions(id, { scope: "ADMIN" });
    await audit({ actor, action: "staff.updated", entityType: "user", entityId: id, summary: `${p.email} → ${t(role.name, "en")} (${p.status})`, changes: { before: { roleId: existing.roleId, status: existing.status }, after: { roleId: p.roleId, status: p.status } } });
    return { id, tempPassword: null };
  }
  const tempPassword = makeTempPassword();
  const user = await db.user.create({ data: { ...p, type: "STAFF", passwordHash: await hashPassword(tempPassword), emailVerifiedAt: new Date(), preferences: { mustChangePassword: true } } });
  await audit({ actor, action: "staff.created", entityType: "user", entityId: user.id, summary: `${p.email} as ${t(role.name, "en")}` });
  return { id: user.id, tempPassword };
}

export async function resetStaffPassword(id: string, actor: CurrentStaff) {
  const u = await db.user.findFirst({ where: { id, type: "STAFF", ...visibleStaffWhere(actor.permissions) }, include: { role: true } });
  if (!u) throw Errors.notFound("staff");
  if (u.role?.permissions.includes(WILDCARD) && !actor.permissions.includes(WILDCARD)) throw Errors.forbidden();
  const tempPassword = makeTempPassword();
  await db.user.update({ where: { id }, data: { passwordHash: await hashPassword(tempPassword), preferences: { ...((u.preferences as object) ?? {}), mustChangePassword: true } } });
  await revokeAllSessions(id);
  await audit({ actor, action: "staff.password_reset", entityType: "user", entityId: id, summary: u.email });
  return { tempPassword };
}

const roleSchema = z.object({
  key: z.string().trim().toLowerCase().regex(/^[a-z][a-z0-9_]{1,40}$/),
  name: localized({ required: true, max: 60 }),
  description: z.string().max(300).nullable(),
  permissions: z.array(z.enum(ALL_PERMISSIONS as [string, ...string[]])).max(ALL_PERMISSIONS.length),
});

export async function saveRole(id: string | null, raw: unknown, actor: CurrentStaff) {
  const p = roleSchema.parse(raw);
  if (await db.role.findFirst({ where: { key: p.key, ...(id ? { id: { not: id } } : {}) } })) throw Errors.invalid({ key: ["taken"] });
  if (id) {
    const existing = await db.role.findUnique({ where: { id } });
    if (!existing) throw Errors.notFound("role");
    if (existing.permissions.includes(WILDCARD)) throw new AppError("super_admin_locked", 409);
    // You can't strip your own access to staff management through your own role.
    if (actor.roleId === id && !p.permissions.includes("staff.manage") && !actor.permissions.includes(WILDCARD)) throw new AppError("cant_edit_self", 409);
    await db.role.update({ where: { id }, data: { name: p.name, description: p.description, permissions: p.permissions, ...(existing.isSystem ? {} : { key: p.key }) } });
    await audit({ actor, action: "role.updated", entityType: "role", entityId: id, summary: `${p.key}: ${p.permissions.length} permissions`, changes: { before: existing.permissions, after: p.permissions } });
    return { id };
  }
  const role = await db.role.create({ data: { ...p, isSystem: false } });
  await audit({ actor, action: "role.created", entityType: "role", entityId: role.id, summary: p.key });
  return { id: role.id };
}

export async function deleteRole(id: string, actor: CurrentStaff) {
  const role = await db.role.findUnique({ where: { id }, include: { _count: { select: { users: true } } } });
  if (!role) throw Errors.notFound("role");
  if (role.isSystem) throw new AppError("system_role", 409);
  if (role._count.users) throw new AppError("role_in_use", 409);
  await db.role.delete({ where: { id } });
  await audit({ actor, action: "role.deleted", entityType: "role", entityId: id, summary: role.key });
}

// ───────────────────────────── Security & logs ──────────────────────────────

export type LogTab = "audit" | "logins" | "sessions" | "system" | "deliveries" | "payments";

export async function securityData(tab: LogTab, q: { q?: string; page?: number; filter?: string }, staff: CurrentStaff) {
  const page = pageOf(q.page);
  const like = q.q ? { contains: q.q, mode: "insensitive" as const } : undefined;
  const result = <T>(rows: T[], total: number) => ({ tab, rows, total, page, pageCount: Math.max(1, Math.ceil(total / PAGE)) });

  switch (tab) {
    case "audit": {
      // Store-level staff don't see what happened to super-admin accounts, and their actions show masked.
      const protectedIds = isSuperAdmin(staff.permissions) ? [] : await superAdminIds();
      const where: Prisma.AuditLogWhereInput = { ...(like ? { OR: [{ action: like }, { summary: like }, { actorEmail: like }, { entityId: like }] } : {}), ...(q.filter ? { entityType: q.filter } : {}), ...(protectedIds.length ? { NOT: { entityType: "user", entityId: { in: protectedIds } } } : {}) };
      const [rows, total] = await Promise.all([db.auditLog.findMany({ where, orderBy: { createdAt: "desc" }, skip: (page - 1) * PAGE, take: PAGE, include: { actor: { select: { name: true } } } }), db.auditLog.count({ where })]);
      const hidden = new Set(protectedIds);
      return result(rows.map((r) => ({ id: r.id, at: r.createdAt.toISOString(), actor: r.actorId && hidden.has(r.actorId) ? MASKED_ADMIN.en : (r.actor?.name ?? r.actorEmail ?? "system"), action: r.action, entity: r.entityType ? `${r.entityType}${r.entityId ? `:${r.entityId.slice(-8)}` : ""}` : null, summary: r.summary, changes: r.changes, ip: r.ip })), total);
    }
    case "logins": {
      const hiddenEmails = isSuperAdmin(staff.permissions) ? [] : (await db.user.findMany({ where: superAdminUserWhere, select: { email: true } })).map((u) => u.email);
      const where: Prisma.LoginAttemptWhereInput = { ...(like ? { OR: [{ email: like }, { ip: like }] } : {}), ...(q.filter === "failed" ? { success: false } : q.filter === "admin" ? { scope: "ADMIN" } : {}), ...(hiddenEmails.length ? { email: { notIn: hiddenEmails } } : {}) };
      const [rows, total] = await Promise.all([db.loginAttempt.findMany({ where, orderBy: { createdAt: "desc" }, skip: (page - 1) * PAGE, take: PAGE }), db.loginAttempt.count({ where })]);
      return result(rows.map((r) => ({ id: r.id, at: r.createdAt.toISOString(), email: r.email, scope: r.scope, success: r.success, reason: r.reason, ip: r.ip, device: r.userAgent })), total);
    }
    case "sessions": {
      const { sessions } = await getSettings("security");
      const idleCutoff = new Date(Date.now() - sessions.adminIdleMinutes * 60_000);
      const where: Prisma.SessionWhereInput = { scope: "ADMIN", revokedAt: null, expiresAt: { gt: new Date() }, lastSeenAt: { gt: idleCutoff }, user: visibleStaffWhere(staff.permissions) };
      const rows = await db.session.findMany({ where, orderBy: { lastSeenAt: "desc" }, take: 200, include: { user: { select: { name: true, email: true } } } });
      return result(rows.map((s) => ({ id: s.id, user: s.user.name, email: s.user.email, ip: s.ip, device: s.userAgent, createdAt: s.createdAt.toISOString(), lastSeenAt: s.lastSeenAt.toISOString(), current: s.id === staff.sessionId })), rows.length);
    }
    case "system": {
      const where: Prisma.SystemLogWhereInput = { ...(q.filter ? { level: q.filter } : {}), ...(like ? { OR: [{ message: like }, { source: like }] } : {}) };
      const [rows, total] = await Promise.all([db.systemLog.findMany({ where, orderBy: { createdAt: "desc" }, skip: (page - 1) * PAGE, take: PAGE }), db.systemLog.count({ where })]);
      return result(rows.map((r) => ({ id: r.id, at: r.createdAt.toISOString(), level: r.level, source: r.source, message: r.message, context: r.context })), total);
    }
    case "deliveries": {
      const where: Prisma.DeliveryLogWhereInput = { ...(q.filter ? { status: q.filter as "SENT" | "FAILED" | "SKIPPED" } : {}), ...(like ? { OR: [{ recipient: like }, { subject: like }, { template: like }] } : {}) };
      const [rows, total] = await Promise.all([db.deliveryLog.findMany({ where, orderBy: { createdAt: "desc" }, skip: (page - 1) * PAGE, take: PAGE }), db.deliveryLog.count({ where })]);
      return result(rows.map((r) => ({ id: r.id, at: r.createdAt.toISOString(), channel: r.channel, recipient: r.recipient, subject: r.subject, template: r.template, status: r.status, error: r.error })), total);
    }
    case "payments": {
      const where: Prisma.PaymentWhereInput = { ...(q.filter ? { status: q.filter as Prisma.PaymentWhereInput["status"] } : {}), ...(like ? { OR: [{ providerRef: like }, { order: { number: like } }] } : {}) };
      const [rows, total] = await Promise.all([db.payment.findMany({ where, orderBy: { createdAt: "desc" }, skip: (page - 1) * PAGE, take: PAGE, include: { order: { select: { id: true, number: true } } } }), db.payment.count({ where })]);
      return result(rows.map((r) => ({ id: r.id, at: r.createdAt.toISOString(), provider: r.provider, mode: r.mode, amount: r.amount, currency: r.currency, status: r.status, error: r.errorMessage, providerRef: r.providerRef, order: r.order })), total);
    }
  }
}

export async function revokeSessionById(id: string, actor: CurrentStaff) {
  const s = await db.session.findUnique({ where: { id }, include: { user: { select: { email: true } } } });
  if (!s || (!isSuperAdmin(actor.permissions) && (await isSuperAdminUser(s.userId)))) throw Errors.notFound("session");
  await db.session.update({ where: { id }, data: { revokedAt: new Date() } });
  await audit({ actor, action: "session.revoked", entityType: "session", entityId: id, summary: s.user.email });
}

// ────────────────────────────────── Profile ─────────────────────────────────

export async function profileData(staff: CurrentStaff) {
  const [user, sessions] = await Promise.all([
    db.user.findUniqueOrThrow({ where: { id: staff.id }, include: { avatar: { select: { id: true, url: true } }, role: { select: { name: true } } } }),
    db.session.findMany({ where: { userId: staff.id, revokedAt: null, expiresAt: { gt: new Date() } }, orderBy: { lastSeenAt: "desc" }, take: 20 }),
  ]);
  const { passwordMinLength } = await getSettings("security");
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    phone: user.phone,
    locale: user.locale,
    avatar: user.avatar,
    role: user.role?.name as Record<string, string> | undefined,
    mustChangePassword: Boolean((user.preferences as { mustChangePassword?: boolean })?.mustChangePassword),
    passwordMinLength,
    sessions: sessions.map((s) => ({ id: s.id, scope: s.scope, ip: s.ip, device: s.userAgent, lastSeenAt: s.lastSeenAt.toISOString(), current: s.id === staff.sessionId })),
  };
}

const profileSchema = z.object({ name: z.string().trim().min(2).max(80), phone: z.string().trim().max(30).nullable(), locale: z.enum(["ar", "en"]), avatarId: z.string().max(64).nullable() });

export async function updateProfile(raw: unknown, staff: CurrentStaff) {
  const p = profileSchema.parse(raw);
  await db.user.update({ where: { id: staff.id }, data: p });
  await audit({ actor: staff, action: "profile.updated", entityType: "user", entityId: staff.id, summary: p.name });
}

export async function changeOwnPassword(current: string, next: string, staff: CurrentStaff) {
  const user = await db.user.findUniqueOrThrow({ where: { id: staff.id } });
  if (!(await verifyPassword(user.passwordHash, current))) throw Errors.invalid({ current: ["wrong_password"] });
  const { passwordMinLength } = await getSettings("security");
  const issues = passwordIssues(next, passwordMinLength);
  if (issues.length) throw Errors.invalid({ next: issues });
  await db.user.update({ where: { id: staff.id }, data: { passwordHash: await hashPassword(next), preferences: { ...((user.preferences as object) ?? {}), mustChangePassword: false } } });
  // Keep this browser signed in, end every other session.
  await revokeAllSessions(staff.id, { exceptSessionId: staff.sessionId });
  await audit({ actor: staff, action: "profile.password_changed", entityType: "user", entityId: staff.id, summary: "Password changed; other sessions revoked" });
}

export async function revokeOwnSession(id: string, staff: CurrentStaff) {
  const s = await db.session.findFirst({ where: { id, userId: staff.id } });
  if (!s) throw Errors.notFound("session");
  await db.session.update({ where: { id }, data: { revokedAt: new Date() } });
}

import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { db } from "../db";
import { hmac, randomToken } from "../crypto";
import { isProd } from "../env";
import { getSettings } from "../settings/service";
import type { SessionScope } from "@/generated/prisma/client";

export const COOKIE = {
  STOREFRONT: "nq_session",
  ADMIN: "nq_admin",
  OTP: "nq_otp",
  CART: "nq_cart",
  CHAT: "nq_chat",
} as const;

const TOUCH_INTERVAL_MS = 60_000;

export function cookieOptions(maxAgeSec?: number) {
  return {
    httpOnly: true,
    secure: isProd(),
    sameSite: "lax" as const,
    path: "/",
    ...(maxAgeSec ? { maxAge: maxAgeSec } : {}),
  };
}

async function lifetimes(scope: SessionScope) {
  const s = (await getSettings("security")).sessions;
  return scope === "ADMIN"
    ? { absoluteMs: s.adminMaxHours * 3_600_000, idleMs: s.adminIdleMinutes * 60_000 }
    : { absoluteMs: s.customerDays * 86_400_000, idleMs: s.customerDays * 86_400_000 };
}

export async function createSession(userId: string, scope: SessionScope, meta: { ip?: string | null; userAgent?: string | null }) {
  const token = randomToken();
  const { absoluteMs } = await lifetimes(scope);
  const expiresAt = new Date(Date.now() + absoluteMs);
  await db.session.create({
    data: { userId, scope, tokenHash: hmac(token, "session"), expiresAt, ip: meta.ip, userAgent: meta.userAgent },
  });
  const jar = await cookies();
  jar.set(scope === "ADMIN" ? COOKIE.ADMIN : COOKIE.STOREFRONT, token, cookieOptions(Math.floor(absoluteMs / 1000)));
  await db.user.update({ where: { id: userId }, data: { lastLoginAt: new Date() } });
}

/** Resolve a session token to a live session, enforcing absolute + idle expiry. */
export async function resolveSessionToken(token: string | undefined, scope: SessionScope) {
  if (!token) return null;
  const session = await db.session.findUnique({
    where: { tokenHash: hmac(token, "session") },
    include: { user: { include: { role: true } } },
  });
  if (!session || session.scope !== scope || session.revokedAt) return null;
  const now = Date.now();
  const { idleMs } = await lifetimes(scope);
  if (session.expiresAt.getTime() < now || now - session.lastSeenAt.getTime() > idleMs) return null;
  if (session.user.status !== "ACTIVE") return null;
  if (scope === "ADMIN" && session.user.type !== "STAFF") return null;
  if (now - session.lastSeenAt.getTime() > TOUCH_INTERVAL_MS) {
    db.session.update({ where: { id: session.id }, data: { lastSeenAt: new Date() } }).catch(() => {});
  }
  return session;
}

/** Current storefront customer (memoised per request). */
export const getCurrentUser = cache(async () => {
  const jar = await cookies();
  const session = await resolveSessionToken(jar.get(COOKIE.STOREFRONT)?.value, "STOREFRONT");
  if (!session) return null;
  const { passwordHash: _ph, ...user } = session.user;
  return user;
});

/** Current admin staff member with resolved permissions (memoised per request). */
export const getCurrentStaff = cache(async () => {
  const jar = await cookies();
  const session = await resolveSessionToken(jar.get(COOKIE.ADMIN)?.value, "ADMIN");
  if (!session) return null;
  const { passwordHash: _ph, role, ...user } = session.user;
  return { ...user, sessionId: session.id, role, permissions: role?.permissions ?? [] };
});

export type CurrentUser = NonNullable<Awaited<ReturnType<typeof getCurrentUser>>>;
export type CurrentStaff = NonNullable<Awaited<ReturnType<typeof getCurrentStaff>>>;

export async function destroySession(scope: SessionScope) {
  const jar = await cookies();
  const name = scope === "ADMIN" ? COOKIE.ADMIN : COOKIE.STOREFRONT;
  const token = jar.get(name)?.value;
  if (token) {
    await db.session.updateMany({ where: { tokenHash: hmac(token, "session") }, data: { revokedAt: new Date() } });
  }
  jar.delete(name);
}

export async function revokeAllSessions(userId: string, opts: { exceptSessionId?: string; scope?: SessionScope } = {}) {
  await db.session.updateMany({
    where: { userId, revokedAt: null, ...(opts.scope ? { scope: opts.scope } : {}), ...(opts.exceptSessionId ? { id: { not: opts.exceptSessionId } } : {}) },
    data: { revokedAt: new Date() },
  });
}

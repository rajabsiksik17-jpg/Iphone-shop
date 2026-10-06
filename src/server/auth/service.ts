import "server-only";
import { cookies } from "next/headers";
import { db } from "../db";
import { hmac, randomToken } from "../crypto";
import { env } from "../env";
import { emit } from "../events";
import { AppError, Errors } from "../errors";
import { limitBy } from "../rate-limit";
import { requestMeta } from "../request";
import { getSettings } from "../settings/service";
import { sendMail, sendTemplate } from "../email/mailer";
import { emailLayout, escapeHtml } from "../email/render";
import { t } from "@/lib/i18n-text";
import { audit } from "../audit";
import { logger } from "../logger";
import { hashPassword, passwordIssues, verifyPassword } from "./password";
import { createOtpChallenge, findChallenge, verifyOtp } from "./otp";
import { COOKIE, cookieOptions, createSession, revokeAllSessions } from "./session";
import type { SessionScope } from "@/generated/prisma/client";

export const normalizeEmail = (email: string) => email.trim().toLowerCase();

async function isLockedOut(email: string, scope: SessionScope) {
  const { login } = await getSettings("security");
  const since = new Date(Date.now() - login.lockoutMinutes * 60_000);
  const lastSuccess = await db.loginAttempt.findFirst({
    where: { email, scope, success: true, createdAt: { gte: since } },
    orderBy: { createdAt: "desc" },
  });
  const failures = await db.loginAttempt.count({
    where: { email, scope, success: false, createdAt: { gte: lastSuccess?.createdAt ?? since } },
  });
  return failures >= login.maxFailedAttempts;
}

async function recordAttempt(email: string, scope: SessionScope, success: boolean, reason?: string) {
  const meta = await requestMeta();
  await db.loginAttempt.create({ data: { email, scope, success, reason, ip: meta.ip, userAgent: meta.userAgent } });
}

function checkLimit(name: Parameters<typeof limitBy>[0], id: string) {
  const r = limitBy(name, id);
  if (!r.ok) throw Errors.rateLimited(r.retryAfterSec);
}

// ─────────────────────────────── Admin login ────────────────────────────────

export type AdminLoginResult = { status: "ok" } | { status: "otp_required"; email: string; expiresAt: string };

export async function adminLogin(input: { email: string; password: string }): Promise<AdminLoginResult> {
  const meta = await requestMeta();
  const email = normalizeEmail(input.email);
  checkLimit("login", `ip:${meta.ip}`);
  checkLimit("login", `email:${email}`);

  if (await isLockedOut(email, "ADMIN")) {
    await recordAttempt(email, "ADMIN", false, "locked");
    throw new AppError("account_locked", 423);
  }
  const user = await db.user.findUnique({ where: { email } });
  const valid = await verifyPassword(user?.passwordHash, input.password);
  if (!user || !valid || user.type !== "STAFF" || user.status !== "ACTIVE") {
    const reason = !user ? "unknown_user" : !valid ? "bad_password" : user.type !== "STAFF" ? "not_staff" : "inactive";
    await recordAttempt(email, "ADMIN", false, reason);
    emit("ADMIN_LOGIN_FAILED", { email, ip: meta.ip, reason });
    // One generic error: never reveal which part was wrong.
    throw new AppError("invalid_credentials", 401);
  }

  const security = await getSettings("security");
  if (security.adminOtp.enabled) {
    const challenge = await createOtpChallenge(user.id, security.adminOtp, meta.ip);
    const sent = await sendTemplate({
      template: "admin_otp",
      to: user.email,
      locale: user.locale,
      force: true,
      userId: user.id,
      vars: { otp_code: challenge.code, expires_minutes: security.adminOtp.ttlMinutes, ip: meta.ip ?? "unknown", customer_name: user.name },
    });
    if (!sent.ok) {
      logger.error("auth", "Admin OTP email could not be sent", { userId: user.id, code: sent.code });
      // Fail closed: OTP is enabled, so no session without a delivered code.
      throw new AppError("otp_delivery_failed", 503);
    }
    const jar = await cookies();
    jar.set(COOKIE.OTP, challenge.challengeToken, cookieOptions(security.adminOtp.ttlMinutes * 60));
    await recordAttempt(email, "ADMIN", true, "password_ok_otp_pending");
    return { status: "otp_required", email: maskEmail(user.email), expiresAt: challenge.expiresAt.toISOString() };
  }

  await completeAdminLogin(user.id, user.email);
  return { status: "ok" };
}

async function completeAdminLogin(userId: string, email: string) {
  const meta = await requestMeta();
  await createSession(userId, "ADMIN", meta);
  await recordAttempt(email, "ADMIN", true);
  await audit({ actor: { id: userId, email }, action: "auth.admin_login", summary: `Signed in from ${meta.ip ?? "unknown IP"}` });
  emit("ADMIN_LOGIN", { userId, ip: meta.ip, userAgent: meta.userAgent });
  void alertNewAdminSignIn(userId, email, meta).catch((e) => logger.warn("auth", "Sign-in alert email failed", { userId, error: String(e) }));
}

/** Settings → Security → "Email admins on new sign-in": tell the account owner. */
async function alertNewAdminSignIn(userId: string, email: string, meta: { ip: string | null; userAgent: string | null }) {
  const [security, store, branding] = await Promise.all([getSettings("security"), getSettings("store"), getSettings("email")]);
  if (!security.alertOnNewAdminLogin) return;
  const user = await db.user.findUnique({ where: { id: userId }, select: { name: true, locale: true } });
  const ar = user?.locale !== "en";
  const name = t(store.name, ar ? "ar" : "en");
  const when = new Date().toLocaleString(ar ? "ar-JO" : "en-GB", { dateStyle: "medium", timeStyle: "short" });
  const rows = [
    [ar ? "الوقت" : "Time", when],
    [ar ? "عنوان IP" : "IP address", meta.ip ?? "—"],
    [ar ? "الجهاز" : "Device", (meta.userAgent ?? "—").slice(0, 160)],
  ]
    .map(([k, v]) => `<tr><td style="padding:4px 12px 4px 0;color:#6b7280">${escapeHtml(k)}</td><td style="padding:4px 0">${escapeHtml(v)}</td></tr>`)
    .join("");
  const html = emailLayout({
    dir: ar ? "rtl" : "ltr",
    storeName: name,
    accent: branding.branding.accentColor,
    body: `<h1 style="margin:0 0 12px;font-size:20px">${ar ? "تسجيل دخول جديد إلى حسابك" : "New sign-in to your admin account"}</h1><p>${escapeHtml(ar ? `مرحباً ${user?.name ?? ""}، تم تسجيل الدخول إلى لوحة تحكم ${name}.` : `Hi ${user?.name ?? ""}, your ${name} admin account was just signed in to.`)}</p><table role="presentation" style="margin:16px 0;font-size:14px">${rows}</table><p style="color:#6b7280">${escapeHtml(ar ? "إذا لم تكن أنت، غيّر كلمة المرور فوراً وأبلغ مدير النظام." : "If this wasn't you, change your password immediately and contact the store owner.")}</p>`,
    footer: escapeHtml(name),
  });
  await sendMail({ to: email, subject: ar ? `تسجيل دخول جديد — ${name}` : `New sign-in — ${name}`, html, template: "admin_login_alert", userId });
}

export async function verifyAdminOtp(code: string) {
  const meta = await requestMeta();
  checkLimit("otpVerify", `ip:${meta.ip}`);
  const jar = await cookies();
  const token = jar.get(COOKIE.OTP)?.value;
  const result = await verifyOtp(token, code);
  if (!result.ok) {
    if (result.reason === "too_many_attempts" || result.reason === "expired" || result.reason === "invalid_challenge") jar.delete(COOKIE.OTP);
    const challenge = await findChallenge(token);
    if (challenge) {
      const user = await db.user.findUnique({ where: { id: challenge.userId } });
      if (user) {
        await recordAttempt(user.email, "ADMIN", false, `otp_${result.reason}`);
        if (result.reason === "too_many_attempts") emit("ADMIN_LOGIN_FAILED", { email: user.email, ip: meta.ip, reason: "otp_attempts_exceeded" });
      }
    }
    throw new AppError(`otp_${result.reason}`, 401, { attemptsLeft: result.attemptsLeft });
  }
  jar.delete(COOKIE.OTP);
  const user = await db.user.findUniqueOrThrow({ where: { id: result.userId } });
  if (user.status !== "ACTIVE" || user.type !== "STAFF") throw new AppError("invalid_credentials", 401);
  await completeAdminLogin(user.id, user.email);
}

export async function resendAdminOtp() {
  const meta = await requestMeta();
  const jar = await cookies();
  const challenge = await findChallenge(jar.get(COOKIE.OTP)?.value);
  if (!challenge || challenge.consumedAt) throw new AppError("otp_invalid_challenge", 401);
  const security = await getSettings("security");
  const age = (Date.now() - challenge.createdAt.getTime()) / 1000;
  if (age < security.adminOtp.resendCooldownSeconds) {
    throw Errors.rateLimited(Math.ceil(security.adminOtp.resendCooldownSeconds - age));
  }
  checkLimit("otpResend", `user:${challenge.userId}`);
  const user = await db.user.findUniqueOrThrow({ where: { id: challenge.userId } });
  const next = await createOtpChallenge(user.id, security.adminOtp, meta.ip);
  const sent = await sendTemplate({
    template: "admin_otp",
    to: user.email,
    locale: user.locale,
    force: true,
    userId: user.id,
    vars: { otp_code: next.code, expires_minutes: security.adminOtp.ttlMinutes, ip: meta.ip ?? "unknown", customer_name: user.name },
  });
  if (!sent.ok) throw new AppError("otp_delivery_failed", 503);
  jar.set(COOKIE.OTP, next.challengeToken, cookieOptions(security.adminOtp.ttlMinutes * 60));
  return { expiresAt: next.expiresAt.toISOString() };
}

export function maskEmail(email: string) {
  const [user, domain] = email.split("@");
  if (!domain) return email;
  const visible = user.slice(0, Math.min(2, user.length));
  return `${visible}${"•".repeat(Math.max(1, user.length - visible.length))}@${domain}`;
}

// ───────────────────────────── Customer auth ────────────────────────────────

export async function customerLogin(input: { email: string; password: string }) {
  const meta = await requestMeta();
  const email = normalizeEmail(input.email);
  checkLimit("login", `ip:${meta.ip}`);
  checkLimit("login", `email:${email}`);
  if (await isLockedOut(email, "STOREFRONT")) throw new AppError("account_locked", 423);

  const user = await db.user.findUnique({ where: { email } });
  const valid = await verifyPassword(user?.passwordHash, input.password);
  if (!user || !valid || user.status !== "ACTIVE") {
    await recordAttempt(email, "STOREFRONT", false, !user ? "unknown_user" : !valid ? "bad_password" : "inactive");
    throw new AppError("invalid_credentials", 401);
  }
  await createSession(user.id, "STOREFRONT", meta);
  await recordAttempt(email, "STOREFRONT", true);
  return user;
}

export async function registerCustomer(input: { name: string; email: string; password: string; phone?: string | null; locale: string; marketingOptIn?: boolean }) {
  const meta = await requestMeta();
  checkLimit("register", `ip:${meta.ip}`);
  const email = normalizeEmail(input.email);
  const { passwordMinLength } = await getSettings("security");
  const issues = passwordIssues(input.password, passwordMinLength);
  if (issues.length) throw Errors.invalid({ password: issues });

  const existing = await db.user.findUnique({ where: { email } });
  if (existing) throw Errors.invalid({ email: ["email_taken"] });

  const loyalty = await getSettings("loyalty");
  const user = await db.user.create({
    data: {
      email,
      name: input.name.trim(),
      phone: input.phone || null,
      passwordHash: await hashPassword(input.password),
      locale: input.locale,
      marketingOptIn: Boolean(input.marketingOptIn),
      pointsBalance: loyalty.enabled ? loyalty.signupBonus : 0,
      ...(loyalty.enabled && loyalty.signupBonus > 0
        ? { pointsTransactions: { create: { delta: loyalty.signupBonus, balanceAfter: loyalty.signupBonus, reason: "SIGNUP_BONUS" } } }
        : {}),
    },
  });
  await createSession(user.id, "STOREFRONT", meta);
  emit("USER_REGISTERED", { userId: user.id });
  return user;
}

// ───────────────────────────── Password reset ───────────────────────────────

const RESET_TTL_MIN = 30;

/**
 * Always resolves the same way whether or not the email exists, so the
 * endpoint can't be used to enumerate accounts.
 */
export async function requestPasswordReset(rawEmail: string, scope: SessionScope, locale: string) {
  const meta = await requestMeta();
  checkLimit("passwordReset", `ip:${meta.ip}`);
  const email = normalizeEmail(rawEmail);
  const emailLimit = limitBy("passwordReset", `email:${email}`);
  if (!emailLimit.ok) return;

  const user = await db.user.findUnique({ where: { email } });
  if (!user || user.status !== "ACTIVE" || (scope === "ADMIN" && user.type !== "STAFF")) return;

  const token = randomToken();
  await db.passwordResetToken.updateMany({ where: { userId: user.id, usedAt: null }, data: { usedAt: new Date() } });
  await db.passwordResetToken.create({
    data: { userId: user.id, tokenHash: hmac(token, "reset"), expiresAt: new Date(Date.now() + RESET_TTL_MIN * 60_000), ip: meta.ip },
  });
  const lang = user.locale || locale;
  const path = scope === "ADMIN" ? `/${lang}/admin/reset-password` : `/${lang}/account/reset-password`;
  const url = `${env().APP_URL}${path}?token=${encodeURIComponent(token)}`;
  await sendTemplate({
    template: "password_reset",
    to: user.email,
    locale: lang,
    force: true,
    userId: user.id,
    vars: { customer_name: user.name, expires_minutes: RESET_TTL_MIN },
    action: { label: lang === "ar" ? "إعادة تعيين كلمة المرور" : "Reset password", url },
  });
}

export async function resetPassword(token: string, newPassword: string) {
  const { passwordMinLength } = await getSettings("security");
  const issues = passwordIssues(newPassword, passwordMinLength);
  if (issues.length) throw Errors.invalid({ password: issues });

  const row = await db.passwordResetToken.findUnique({ where: { tokenHash: hmac(token, "reset") } });
  if (!row || row.usedAt || row.expiresAt < new Date()) throw new AppError("reset_token_invalid", 400);
  const consumed = await db.passwordResetToken.updateMany({ where: { id: row.id, usedAt: null }, data: { usedAt: new Date() } });
  if (consumed.count !== 1) throw new AppError("reset_token_invalid", 400);

  const user = await db.user.update({ where: { id: row.userId }, data: { passwordHash: await hashPassword(newPassword) } });
  // A reset implies possible compromise: end every existing session.
  await revokeAllSessions(user.id);
  if (user.type === "STAFF") await audit({ actor: { id: user.id, email: user.email }, action: "auth.password_reset" });
  return user;
}

export async function changePassword(userId: string, current: string, next: string, keepSessionId?: string) {
  const user = await db.user.findUniqueOrThrow({ where: { id: userId } });
  if (!(await verifyPassword(user.passwordHash, current))) throw Errors.invalid({ currentPassword: ["incorrect"] });
  const { passwordMinLength } = await getSettings("security");
  const issues = passwordIssues(next, passwordMinLength);
  if (issues.length) throw Errors.invalid({ newPassword: issues });
  await db.user.update({ where: { id: userId }, data: { passwordHash: await hashPassword(next) } });
  await revokeAllSessions(userId, { exceptSessionId: keepSessionId });
}

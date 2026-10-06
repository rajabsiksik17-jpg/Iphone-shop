import "server-only";
import { db } from "../db";
import { hmac, randomDigits, randomToken, safeEqual } from "../crypto";

export type OtpConfig = { length: number; ttlMinutes: number; maxAttempts: number; resendCooldownSeconds: number };

/**
 * Create a login challenge. Returns the plain code (to be emailed, never
 * stored) and an opaque challenge token bound to the browser via cookie.
 * Any earlier open challenges for the user are invalidated.
 */
export async function createOtpChallenge(userId: string, cfg: OtpConfig, ip: string | null) {
  const code = randomDigits(cfg.length);
  const challengeToken = randomToken();
  await db.otpChallenge.updateMany({ where: { userId, consumedAt: null }, data: { consumedAt: new Date() } });
  const challenge = await db.otpChallenge.create({
    data: {
      userId,
      purpose: "ADMIN_LOGIN",
      codeHash: hmac(code, `otp:${userId}`),
      challengeHash: hmac(challengeToken, "otp-challenge"),
      maxAttempts: cfg.maxAttempts,
      expiresAt: new Date(Date.now() + cfg.ttlMinutes * 60_000),
      ip,
    },
  });
  return { code, challengeToken, challengeId: challenge.id, expiresAt: challenge.expiresAt };
}

export type OtpVerifyResult =
  | { ok: true; userId: string }
  | { ok: false; reason: "invalid_challenge" | "expired" | "too_many_attempts" | "wrong_code"; attemptsLeft?: number };

export async function findChallenge(challengeToken: string | undefined) {
  if (!challengeToken) return null;
  return db.otpChallenge.findUnique({ where: { challengeHash: hmac(challengeToken, "otp-challenge") } });
}

export async function verifyOtp(challengeToken: string | undefined, code: string): Promise<OtpVerifyResult> {
  const challenge = await findChallenge(challengeToken);
  if (!challenge || challenge.consumedAt) return { ok: false, reason: "invalid_challenge" };
  if (challenge.expiresAt < new Date()) return { ok: false, reason: "expired" };
  if (challenge.attempts >= challenge.maxAttempts) return { ok: false, reason: "too_many_attempts" };

  const normalized = code.replace(/\D/g, "");
  const matches = safeEqual(hmac(normalized, `otp:${challenge.userId}`), challenge.codeHash);
  if (!matches) {
    const updated = await db.otpChallenge.update({
      where: { id: challenge.id },
      data: { attempts: { increment: 1 } },
    });
    const left = updated.maxAttempts - updated.attempts;
    if (left <= 0) {
      await db.otpChallenge.update({ where: { id: challenge.id }, data: { consumedAt: new Date() } });
      return { ok: false, reason: "too_many_attempts" };
    }
    return { ok: false, reason: "wrong_code", attemptsLeft: left };
  }
  // Single use: consume atomically so a replay in parallel can't also succeed.
  const consumed = await db.otpChallenge.updateMany({
    where: { id: challenge.id, consumedAt: null },
    data: { consumedAt: new Date() },
  });
  if (consumed.count !== 1) return { ok: false, reason: "invalid_challenge" };
  return { ok: true, userId: challenge.userId };
}

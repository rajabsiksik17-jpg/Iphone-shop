import { safeEqual } from "@/server/crypto";
import { createHmac } from "node:crypto";
import { env } from "@/server/env";
import { logger, errorMessage } from "@/server/logger";
import { refreshScheduledPrices } from "@/server/catalog/derived";
import { expireUnpaidOrders } from "@/server/commerce/orders";
import { autoCloseInactive } from "@/server/chat/service";
import { db } from "@/server/db";

export const dynamic = "force-dynamic";

/**
 * Background jobs, invoked every minute by server.ts (or by an external cron
 * with the same secret header in serverless deployments).
 */
export async function POST(req: Request) {
  const expected = createHmac("sha256", env().APP_SECRET).update("cron").digest("base64url");
  const got = req.headers.get("x-cron-secret") ?? "";
  if (!safeEqual(got, expected)) return new Response("Forbidden", { status: 403 });

  const results: Record<string, unknown> = {};
  const job = async (name: string, fn: () => Promise<unknown>) => {
    try {
      results[name] = await fn();
    } catch (e) {
      results[name] = "error";
      logger.error("cron", `${name} failed`, { error: errorMessage(e) });
    }
  };
  await job("salePrices", refreshScheduledPrices);
  await job("unpaidOrders", expireUnpaidOrders);
  await job("chatAutoClose", autoCloseInactive);
  await job("cleanup", async () => {
    const now = new Date();
    const [sessions, otps, resets] = await Promise.all([
      db.session.deleteMany({ where: { OR: [{ expiresAt: { lt: now } }, { revokedAt: { lt: new Date(Date.now() - 7 * 86_400_000) } }] } }),
      db.otpChallenge.deleteMany({ where: { expiresAt: { lt: new Date(Date.now() - 86_400_000) } } }),
      db.passwordResetToken.deleteMany({ where: { expiresAt: { lt: new Date(Date.now() - 86_400_000) } } }),
    ]);
    // Abandoned guest carts older than 60 days.
    const carts = await db.cart.deleteMany({ where: { userId: null, updatedAt: { lt: new Date(Date.now() - 60 * 86_400_000) } } });
    return { sessions: sessions.count, otps: otps.count, resets: resets.count, carts: carts.count };
  });
  return Response.json({ ok: true, results });
}

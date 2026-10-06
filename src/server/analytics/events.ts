import "server-only";
import { cookies, headers } from "next/headers";
import { createHash } from "node:crypto";
import { db } from "../db";
import { env } from "../env";
import { getSettings } from "../settings/service";
import { requestMeta } from "../request";
import type { AnalyticsEventType } from "@/generated/prisma/client";

/**
 * Privacy-friendly visitor id: a salted hash of IP + UA + date. It rotates
 * daily, isn't stored on the device and can't be reversed to a person —
 * enough to count sessions/conversion without tracking individuals.
 */
async function visitorId() {
  const meta = await requestMeta();
  const day = new Date().toISOString().slice(0, 10);
  return createHash("sha256").update(`${env().APP_SECRET}:${day}:${meta.ip}:${meta.userAgent}`).digest("base64url").slice(0, 22);
}

function deviceOf(ua: string | null) {
  if (!ua) return "unknown";
  if (/bot|crawl|spider|slurp|lighthouse/i.test(ua)) return "bot";
  if (/ipad|tablet/i.test(ua)) return "tablet";
  if (/mobi|android|iphone/i.test(ua)) return "mobile";
  return "desktop";
}

export async function recordEvent(type: AnalyticsEventType, data: { productId?: string; orderId?: string; value?: number; path?: string } = {}) {
  const privacy = await getSettings("privacy");
  if (!privacy.firstPartyAnalytics) return;
  const meta = await requestMeta();
  const device = deviceOf(meta.userAgent);
  if (device === "bot") return;
  const h = await headers();
  const jar = await cookies();
  // Honour Do-Not-Track / Global Privacy Control.
  if (h.get("dnt") === "1" || h.get("sec-gpc") === "1" || jar.get("nq_optout")) return;
  let referrer: string | null = null;
  try {
    const ref = h.get("referer");
    if (ref) {
      const host = new URL(ref).host;
      if (host !== meta.host) referrer = host;
    }
  } catch {
    /* ignore malformed referrer */
  }
  await db.analyticsEvent.create({
    data: { type, visitorId: await visitorId(), productId: data.productId, orderId: data.orderId, value: data.value, path: data.path?.slice(0, 300), referrer, country: meta.country, device },
  });
}

import "server-only";
import { headers } from "next/headers";

/**
 * The custom server (server.ts) stamps every request with `x-nq-ip`, derived
 * from the socket (or X-Forwarded-For only when TRUST_PROXY is set), and
 * strips any client-supplied copy — so this value can't be spoofed.
 */
export async function requestMeta() {
  const h = await headers();
  return {
    ip: h.get("x-nq-ip") ?? null,
    userAgent: h.get("user-agent")?.slice(0, 300) ?? null,
    country: h.get("x-nq-country") ?? null,
    // Region of the browser's preferred language ("ar-SA" → "SA"): a weak but
    // free location hint when no CDN country header is available.
    languageRegion: regionFromAcceptLanguage(h.get("accept-language")),
    origin: h.get("origin"),
    host: h.get("host"),
  };
}

export type RequestMeta = Awaited<ReturnType<typeof requestMeta>>;

/** First region subtag in Accept-Language, e.g. "ar-SA,ar;q=0.9,en;q=0.8" → "SA". */
export function regionFromAcceptLanguage(header: string | null | undefined): string | null {
  if (!header) return null;
  for (const part of header.split(",")) {
    const m = part.trim().match(/^[a-z]{2,3}[-_]([a-z]{2})\b/i);
    if (m) return m[1].toUpperCase();
  }
  return null;
}

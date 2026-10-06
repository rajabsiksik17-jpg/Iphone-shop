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
    origin: h.get("origin"),
    host: h.get("host"),
  };
}

export type RequestMeta = Awaited<ReturnType<typeof requestMeta>>;

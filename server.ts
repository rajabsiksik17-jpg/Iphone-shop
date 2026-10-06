/**
 * Production/dev entry point: Next.js + Socket.IO on one Node HTTP server.
 *
 * - Stamps every request with a trustworthy client IP (`x-nq-ip`) and, when
 *   behind a trusted CDN/proxy, a country code (`x-nq-country`). Client-sent
 *   copies of these headers are always discarded.
 * - Runs the background scheduler by calling an internal, secret-protected
 *   route so jobs execute inside Next's module graph (same code as the app).
 */
import "dotenv/config";
import { createServer } from "node:http";
import { createHmac } from "node:crypto";
import next from "next";
import { createSocketServer } from "./src/realtime/socket-server";

const dev = process.env.NODE_ENV !== "production";
const port = Number(process.env.PORT ?? 3000);
const trustProxy = process.env.TRUST_PROXY === "true" || process.env.TRUST_PROXY === "1";
const appUrl = process.env.APP_URL ?? `http://localhost:${port}`;

for (const key of ["DATABASE_URL", "APP_SECRET", "ENCRYPTION_KEY"]) {
  if (!process.env[key]) {
    console.error(`Missing required environment variable ${key}. See .env.example.`);
    process.exit(1);
  }
}

const app = next({ dev, port, hostname: "0.0.0.0", turbopack: dev });
const handle = app.getRequestHandler();

const COUNTRY_HEADERS = ["cf-ipcountry", "x-vercel-ip-country", "cloudfront-viewer-country", "x-country-code", "fastly-geo-country"];

await app.prepare();

const server = createServer((req, res) => {
  delete req.headers["x-nq-ip"];
  delete req.headers["x-nq-country"];
  let ip = req.socket.remoteAddress ?? "";
  if (trustProxy) {
    const fwd = req.headers["x-forwarded-for"];
    const first = (Array.isArray(fwd) ? fwd[0] : fwd)?.split(",")[0]?.trim();
    if (first) ip = first;
    for (const h of COUNTRY_HEADERS) {
      const v = req.headers[h];
      if (typeof v === "string" && /^[A-Z]{2}$/i.test(v) && v.toUpperCase() !== "XX") {
        req.headers["x-nq-country"] = v.toUpperCase();
        break;
      }
    }
  }
  req.headers["x-nq-ip"] = ip.replace(/^::ffff:/, "");

  // Baseline security headers for every response (pages, API, media).
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("X-Frame-Options", "SAMEORIGIN");
  res.setHeader("Permissions-Policy", "camera=(self), microphone=(), geolocation=(), payment=(self)");
  if (!dev) res.setHeader("Strict-Transport-Security", "max-age=63072000; includeSubDomains");

  handle(req, res);
});

createSocketServer(server, {
  appUrl,
  allowedOrigins: (process.env.REALTIME_ALLOWED_ORIGINS ?? "").split(",").map((s) => s.trim()).filter(Boolean),
});

server.listen(port, () => {
  console.log(`▲ Nuqta ready on ${appUrl} (${dev ? "development" : "production"})`);
});

// ─── Scheduler ────────────────────────────────────────────────────────────────
const cronSecret = createHmac("sha256", process.env.APP_SECRET!).update("cron").digest("base64url");
const runJobs = async () => {
  try {
    await fetch(`http://127.0.0.1:${port}/api/internal/cron`, { method: "POST", headers: { "x-cron-secret": cronSecret } });
  } catch {
    /* server still warming up */
  }
};
setTimeout(runJobs, 15_000);
setInterval(runJobs, 60_000).unref();

const shutdown = () => {
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 5_000).unref();
};
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

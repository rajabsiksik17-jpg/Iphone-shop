import type { NextConfig } from "next";
import path from "node:path";
const dev = process.env.NODE_ENV !== "production";

/**
 * Content-Security-Policy. Third-party origins are limited to the analytics,
 * pixel, payment and embed providers the platform integrates with.
 */
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${dev ? " 'unsafe-eval'" : ""} https://www.googletagmanager.com https://connect.facebook.net https://analytics.tiktok.com`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  `connect-src 'self' ${dev ? "ws: " : ""}wss: https://www.google-analytics.com https://*.google-analytics.com https://*.analytics.google.com https://www.googletagmanager.com https://connect.facebook.net https://analytics.tiktok.com`,
  "frame-src https://www.youtube-nocookie.com https://player.vimeo.com https://www.openstreetmap.org https://www.google.com",
  "frame-ancestors 'self'",
  "form-action 'self' https://checkout.stripe.com https://www.paypal.com https://www.sandbox.paypal.com",
  "base-uri 'self'",
  "object-src 'none'",
].join("; ");

// next-intl reads its request config through this alias (what its build plugin
// would set up; configured directly to avoid the plugin's native SWC dependency).
const I18N_CONFIG = "./src/i18n/request.ts";

const config: NextConfig = {
  turbopack: { resolveAlias: { "next-intl/config": I18N_CONFIG } },
  webpack(cfg) {
    cfg.resolve.alias["next-intl/config"] = path.resolve(I18N_CONFIG);
    return cfg;
  },
  poweredByHeader: false,
  reactStrictMode: true,
  serverExternalPackages: ["@node-rs/argon2", "sharp", "imapflow", "nodemailer", "pg"],
  experimental: {
    serverActions: { bodySizeLimit: "12mb" },
    // Keeps production builds within the memory/process limits of shared
    // Node hosting (e.g. Hostinger): webpack with fewer parallel workers.
    webpackMemoryOptimizations: true,
    cpus: Number(process.env.BUILD_CPUS) || 2,
  },
  images: {
    // Media renditions are generated at upload time (see server/media), so the
    // runtime optimiser is only used for remote images if ever configured.
    unoptimized: true,
  },
  async headers() {
    return [{ source: "/:path*", headers: [{ key: "Content-Security-Policy", value: csp }] }];
  },
};

export default config;

import type { MetadataRoute } from "next";
import { env } from "@/server/env";
import { getSettings } from "@/server/settings/service";

export const revalidate = 3600;

export default async function robots(): Promise<MetadataRoute.Robots> {
  const seo = await getSettings("seo");
  const base = env().APP_URL.replace(/\/$/, "");
  if (!seo.allowIndexing) return { rules: [{ userAgent: "*", disallow: "/" }] };
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        // Private, transactional and infinite-facet URLs stay out of the index.
        disallow: ["/api/", "/*/admin", "/*/account", "/*/cart", "/*/checkout", "/*/order/", "/*/wishlist", "/*?*sort=", "/*?*q=", ...seo.robotsDisallow],
      },
    ],
    sitemap: `${base}/sitemap.xml`,
    host: base,
  };
}

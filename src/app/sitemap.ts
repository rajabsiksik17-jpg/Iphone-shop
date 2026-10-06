import type { MetadataRoute } from "next";
import { db } from "@/server/db";
import { env } from "@/server/env";
import { getSettings } from "@/server/settings/service";
import { visibleWhere } from "@/server/catalog/listing";
import { locales, localeMeta } from "@/i18n/config";

export const revalidate = 3600;

/**
 * XML sitemap covering every locale with hreflang alternates: home, shop,
 * categories, brands, products (with images) and published CMS pages.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const seo = await getSettings("seo");
  if (!seo.allowIndexing) return [];
  const base = env().APP_URL.replace(/\/$/, "");
  const [products, categories, brands, pages] = await Promise.all([
    db.product.findMany({ where: { ...visibleWhere(), NOT: { seo: { path: ["noindex"], equals: true } } }, select: { slug: true, updatedAt: true, images: { take: 3, orderBy: { position: "asc" }, select: { media: { select: { url: true } } } } } }),
    db.category.findMany({ where: { isActive: true }, select: { fullSlug: true, updatedAt: true } }),
    db.brand.findMany({ where: { isActive: true }, select: { slug: true, updatedAt: true } }),
    db.page.findMany({ where: { status: "PUBLISHED", NOT: { seo: { path: ["noindex"], equals: true } } }, select: { slug: true, updatedAt: true } }),
  ]);

  const entry = (path: string, lastModified?: Date, priority = 0.6, images?: string[]): MetadataRoute.Sitemap =>
    locales.map((l) => ({
      url: `${base}/${l}${path}`,
      lastModified,
      priority,
      changeFrequency: "weekly" as const,
      alternates: { languages: Object.fromEntries(locales.map((x) => [localeMeta[x].intl, `${base}/${x}${path}`])) },
      ...(images?.length ? { images: images.map((i) => `${base}${i}`) } : {}),
    }));

  return [
    ...entry("", new Date(), 1),
    ...entry("/shop", new Date(), 0.9),
    ...entry("/brands", undefined, 0.5),
    ...categories.flatMap((c) => entry(`/category/${c.fullSlug}`, c.updatedAt, 0.8)),
    ...brands.flatMap((b) => entry(`/brand/${b.slug}`, b.updatedAt, 0.6)),
    ...products.flatMap((p) => entry(`/product/${p.slug}`, p.updatedAt, 0.8, p.images.map((i) => i.media.url))),
    ...pages.filter((p) => p.slug !== "home").flatMap((p) => entry(`/${p.slug}`, p.updatedAt, 0.4)),
  ];
}

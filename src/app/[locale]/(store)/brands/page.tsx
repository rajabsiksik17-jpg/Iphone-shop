import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { listBrands } from "@/server/catalog/taxonomy";
import { Breadcrumbs } from "@/components/store/breadcrumbs";
import { Picture } from "@/components/ui/picture";
import { Link } from "@/i18n/navigation";
import { pageMetadata } from "@/server/seo";
import type { Locale } from "@/i18n/config";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const locale = (await params).locale as Locale;
  const t = await getTranslations({ locale, namespace: "common" });
  return pageMetadata({ locale, path: "/brands", title: t("allBrands") });
}

export default async function BrandsPage({ params }: { params: Promise<{ locale: string }> }) {
  const locale = (await params).locale as Locale;
  setRequestLocale(locale);
  const t = await getTranslations();
  const brands = await listBrands(locale);
  return (
    <div className="container-store pb-10 pt-6">
      <Breadcrumbs items={[{ label: t("common.brands"), href: "/brands" }]} />
      <h1 className="mb-8 mt-6 text-3xl font-semibold tracking-tight md:text-4xl">{t("common.allBrands")}</h1>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {brands.map((b) => (
          <Link key={b.id} href={`/brand/${b.slug}`} className="group flex flex-col items-center gap-4 rounded-card border border-border p-6 transition hover:border-fg/20 hover:shadow-card">
            <Picture image={b.logo} sizes="200px" fit="contain" className="h-14 w-full transition group-hover:scale-105" />
            <div className="text-center">
              <p className="font-semibold">{b.name}</p>
              <p className="text-xs text-muted">{t("listing.productsCount", { count: b.productCount })}</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

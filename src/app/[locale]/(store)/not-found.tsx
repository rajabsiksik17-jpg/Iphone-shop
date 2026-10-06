import { getLocale, getTranslations } from "next-intl/server";
import { Home, Search } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { ProductGrid } from "@/components/store/product-card";
import { productCollection } from "@/server/catalog/product";
import { categoryTree } from "@/server/catalog/taxonomy";
import { SearchLauncher } from "@/components/store/search-launcher";
import type { Locale } from "@/i18n/config";

export default async function NotFound() {
  const locale = (await getLocale()) as Locale;
  const t = await getTranslations();
  const [popular, cats] = await Promise.all([productCollection("best_sellers", locale, { limit: 4 }), categoryTree(locale)]);
  return (
    <div className="container-store py-16 md:py-24">
      <div className="mx-auto max-w-xl text-center">
        <div className="relative mx-auto mb-8 h-36 w-64" aria-hidden>
          <span className="absolute inset-0 grid place-items-center text-[120px] font-bold leading-none tracking-tighter text-fg/[0.06]">404</span>
          <svg viewBox="0 0 200 120" className="relative mx-auto h-full">
            <rect x="72" y="14" width="56" height="96" rx="12" fill="none" stroke="currentColor" strokeWidth="3" className="text-fg/70" />
            <rect x="88" y="20" width="24" height="5" rx="2.5" className="fill-fg/40" />
            <circle cx="100" cy="64" r="16" className="fill-accent/15" />
            <path d="M93 60c0-4 3-7 7-7s7 3 7 7c0 5-7 5-7 10" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" className="text-accent" />
            <circle cx="100" cy="77" r="2" className="fill-accent" />
          </svg>
        </div>
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-accent">{t("notFound.code")}</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-balance md:text-4xl">{t("notFound.title")}</h1>
        <p className="mt-3 text-muted">{t("notFound.text")}</p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Button asChild size="lg" leftIcon={<Home />}>
            <Link href="/">{t("notFound.home")}</Link>
          </Button>
          <SearchLauncher label={t("common.search")} icon={<Search />} />
        </div>
        <div className="mt-10 flex flex-wrap justify-center gap-2">
          {cats.slice(0, 6).map((c) => (
            <Link key={c.id} href={`/category/${c.fullSlug}`} className="rounded-full border border-border px-4 py-2 text-sm hover:bg-surface">
              {c.name}
            </Link>
          ))}
        </div>
      </div>
      {popular.length > 0 && (
        <section className="mt-20">
          <h2 className="mb-6 text-xl font-semibold">{t("notFound.popular")}</h2>
          <ProductGrid products={popular} />
        </section>
      )}
    </div>
  );
}

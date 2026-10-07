import { getTranslations } from "next-intl/server";
import { ArrowLeft } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { Picture } from "@/components/ui/picture";
import { ServerIcon } from "@/components/icons/server-icon";
import { customSvgsFor } from "@/server/icons";
import { exploreCategories } from "@/server/catalog/taxonomy";

/**
 * "Keep exploring" — shown under listings with few or no products so a small
 * category still leads somewhere useful. Suggests sibling categories that
 * have products, then top-level ones.
 */
export async function ExploreCategories({ locale, currentId }: { locale: string; currentId?: string }) {
  const items = await exploreCategories(locale, currentId);
  if (!items.length) return null;
  const t = await getTranslations("listing");
  const svgs = await customSvgsFor(items.map((i) => i.icon));
  return (
    <section className="mt-14 border-t border-border pt-10" aria-labelledby="explore-heading">
      <div className="mb-5 flex items-end justify-between gap-4">
        <h2 id="explore-heading" className="text-xl font-semibold tracking-tight">
          {t("keepExploring")}
        </h2>
        <Link href="/shop" className="flex shrink-0 items-center gap-1.5 text-sm font-medium text-accent hover:underline">
          {t("browseAll")} <ArrowLeft className="size-4 ltr:rotate-180" />
        </Link>
      </div>
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {items.map((c) => (
          <li key={c.id}>
            <Link href={`/category/${c.fullSlug}`} className="group flex items-center gap-3 rounded-2xl border border-border p-3 transition hover:border-fg/20 hover:shadow-card">
              <span className="grid size-12 shrink-0 place-items-center overflow-hidden rounded-xl bg-surface">
                {c.image ? <Picture image={c.image} sizes="48px" className="size-full object-cover transition duration-500 group-hover:scale-105" /> : <ServerIcon value={c.icon} customSvgs={svgs} className="size-6 text-fg/70" fallback="lucide:LayoutGrid" />}
              </span>
              <span className="min-w-0">
                <span className="block truncate text-sm font-semibold">{c.name}</span>
                <span className="text-xs text-muted">{t("productsCount", { count: c.count })}</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

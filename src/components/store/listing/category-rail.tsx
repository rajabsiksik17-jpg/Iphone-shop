import { getTranslations } from "next-intl/server";
import { LayoutGrid } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { Picture } from "@/components/ui/picture";
import { ServerIcon } from "@/components/icons/server-icon";
import { customSvgsFor } from "@/server/icons";
import { cn } from "@/lib/utils";
import type { RailItem } from "@/server/catalog/taxonomy";

/**
 * Story-style rail of categories: round thumbnails with a gradient ring that
 * scroll sideways on phones (snap) and wrap into a tidy row on desktop.
 */
export async function CategoryRail({ items, parent }: { items: RailItem[]; parent: { name: string; fullSlug: string } | null }) {
  if (items.length < 2 && !parent) return null;
  const t = await getTranslations("listing");
  const svgs = await customSvgsFor(items.map((i) => i.icon));
  const tile = (inner: React.ReactNode, active: boolean) => (
    <span
      className={cn(
        "grid size-[4.5rem] place-items-center rounded-full p-[2.5px] transition duration-300 group-hover:scale-[1.04] md:size-20",
        active ? "bg-fg" : "bg-[conic-gradient(from_210deg,var(--color-accent),#f472b6,#f59e0b,var(--color-accent))] opacity-90 group-hover:opacity-100",
      )}
    >
      <span className="grid size-full place-items-center overflow-hidden rounded-full bg-surface ring-[3px] ring-bg">{inner}</span>
    </span>
  );

  return (
    <nav aria-label={t("subcategories")} className="relative -mx-4 mt-6 md:mx-0">
      <ul className="no-scrollbar flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-1 [mask-image:linear-gradient(to_right,transparent,#000_16px,#000_calc(100%-24px),transparent)] md:gap-5 md:px-0 md:[mask-image:none]">
        {parent && (
          <li className="snap-start">
            <Link href={`/category/${parent.fullSlug}`} className="group flex w-[4.5rem] flex-col items-center gap-2 text-center md:w-20">
              {tile(<LayoutGrid className="size-6 text-muted" />, false)}
              <span className="line-clamp-2 text-xs font-medium leading-tight">{t("allIn", { name: parent.name })}</span>
            </Link>
          </li>
        )}
        {items.map((c) => (
          <li key={c.id} className="snap-start">
            <Link href={`/category/${c.fullSlug}`} aria-current={c.current ? "page" : undefined} className="group flex w-[4.5rem] flex-col items-center gap-2 text-center md:w-20">
              {tile(
                c.image ? (
                  <Picture image={c.image} sizes="80px" className="size-full object-cover" />
                ) : (
                  <ServerIcon value={c.icon} customSvgs={svgs} className="size-7 text-fg/80" fallback="lucide:LayoutGrid" />
                ),
                c.current,
              )}
              <span className={cn("line-clamp-2 text-xs leading-tight", c.current ? "font-semibold" : "font-medium")}>{c.name}</span>
              <span className="tabular -mt-1.5 text-[10.5px] text-muted">{c.count}</span>
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

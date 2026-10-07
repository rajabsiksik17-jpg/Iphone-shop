import { getLocale, getTranslations } from "next-intl/server";
import { ChevronRight } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { JsonLd, breadcrumbJsonLd } from "@/components/seo/json-ld";
import { cn } from "@/lib/utils";
import type { Locale } from "@/i18n/config";

/**
 * Breadcrumbs with BreadcrumbList structured data; horizontally scrollable on
 * phones. `inShop` adds the Shop level (Home / Shop / Category / Product).
 */
export async function Breadcrumbs({ items, className, inShop }: { items: { label: string; href: string }[]; className?: string; inShop?: boolean }) {
  const t = await getTranslations("common");
  const locale = (await getLocale()) as Locale;
  const all = [{ label: t("home"), href: "/" }, ...(inShop ? [{ label: t("shop"), href: "/shop" }] : []), ...items];
  return (
    <>
      <JsonLd data={breadcrumbJsonLd(all, locale)} />
      <nav aria-label={t("breadcrumb")} className={cn("no-scrollbar -mx-4 overflow-x-auto px-4", className)}>
        <ol className="flex items-center gap-1.5 whitespace-nowrap text-[13px] text-muted">
          {all.map((it, i) => (
            <li key={it.href + i} className="flex items-center gap-1.5">
              {i > 0 && <ChevronRight className="flip-rtl size-3.5 opacity-60" aria-hidden />}
              {i === all.length - 1 ? (
                <span aria-current="page" className="font-medium text-fg">
                  {it.label}
                </span>
              ) : (
                <Link href={it.href} className="transition hover:text-fg">
                  {it.label}
                </Link>
              )}
            </li>
          ))}
        </ol>
      </nav>
    </>
  );
}

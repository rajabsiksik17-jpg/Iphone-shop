"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Search, X } from "lucide-react";
import { useRouter } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

/** Large search box for the results page; keeps the query in the URL (?q=). */
export function SearchField({ defaultValue = "", className }: { defaultValue?: string; className?: string }) {
  const t = useTranslations("common");
  const router = useRouter();
  const [q, setQ] = useState(defaultValue);
  return (
    <form
      role="search"
      className={cn("relative", className)}
      onSubmit={(e) => {
        e.preventDefault();
        const s = q.trim();
        if (s) router.push(`/search?q=${encodeURIComponent(s)}`);
      }}
    >
      <Search className="pointer-events-none absolute start-5 top-1/2 size-5 -translate-y-1/2 text-muted" />
      <input
        type="search"
        name="q"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder={t("searchPlaceholder")}
        aria-label={t("searchPlaceholder")}
        autoComplete="off"
        enterKeyHint="search"
        className="h-14 w-full rounded-full border border-border bg-bg pe-28 ps-13 text-base shadow-card outline-none transition focus:border-accent focus:shadow-pop [&::-webkit-search-cancel-button]:hidden"
      />
      {q && (
        <button type="button" onClick={() => setQ("")} aria-label={t("clear")} className="absolute end-24 top-1/2 grid size-8 -translate-y-1/2 place-items-center rounded-full text-muted hover:bg-surface hover:text-fg">
          <X className="size-4" />
        </button>
      )}
      <button type="submit" className="absolute end-2 top-1/2 h-10 -translate-y-1/2 rounded-full bg-primary px-5 text-sm font-medium text-primary-fg transition hover:bg-primary/90">
        {t("search")}
      </button>
    </form>
  );
}

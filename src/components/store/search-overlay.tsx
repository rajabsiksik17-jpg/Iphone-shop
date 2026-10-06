"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import * as D from "@radix-ui/react-dialog";
import { useLocale, useTranslations } from "next-intl";
import { ArrowUpRight, Clock, Search, TrendingUp, X, CornerDownLeft, Sparkles } from "lucide-react";
import { Link, useRouter } from "@/i18n/navigation";
import { suggestAction, logSearchAction } from "@/actions/store";
import { Picture } from "@/components/ui/picture";
import { Price } from "@/components/ui/price";
import { Spinner } from "@/components/ui/spinner";
import { recentSearches } from "@/lib/local-store";
import { track } from "@/lib/analytics-client";
import { cn } from "@/lib/utils";
import type { SearchSuggestions as Suggestions } from "@/server/catalog/taxonomy";

/**
 * Instant search: debounced server suggestions (fuzzy, typo tolerant),
 * product previews, category/brand shortcuts, recent and popular searches,
 * and full keyboard support (↑ ↓ Enter Esc). Opens with "/" or Ctrl/⌘+K.
 */
export function SearchOverlay({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const t = useTranslations();
  const locale = useLocale();
  const router = useRouter();
  const [q, setQ] = useState("");
  const [data, setData] = useState<Suggestions | null>(null);
  const [recent, setRecent] = useState<string[]>([]);
  const [active, setActive] = useState(-1);
  const [pending, start] = useTransition();
  const reqId = useRef(0);
  // Per-query cache: backspacing or retyping never refetches.
  const cache = useRef(new Map<string, Suggestions>());

  useEffect(() => {
    if (open) setRecent(recentSearches.get());
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const id = ++reqId.current;
    const key = q.trim().toLowerCase();
    const cached = cache.current.get(key);
    if (cached) {
      setData(cached);
      setActive(-1);
      return;
    }
    const handle = setTimeout(() => {
      start(async () => {
        const res = await suggestAction(q, locale);
        if (res.ok) cache.current.set(key, res.data);
        if (res.ok && id === reqId.current) {
          setData(res.data);
          setActive(-1);
        }
      });
    }, q ? 220 : 0);
    return () => clearTimeout(handle);
  }, [q, open, locale]);

  const submit = (term: string) => {
    const s = term.trim();
    if (!s) return;
    recentSearches.push(s);
    track.search(s);
    logSearchAction(s, data?.products.length ?? 0).catch(() => {});
    onOpenChange(false);
    router.push(`/search?q=${encodeURIComponent(s)}`);
  };

  // Flat list of navigable targets for arrow-key navigation.
  const targets = useMemo(() => {
    if (!data) return [] as { href: string }[];
    return [...data.products.map((p) => ({ href: `/product/${p.slug}` })), ...data.categories, ...data.brands];
  }, [data]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => Math.min(targets.length - 1, a + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(-1, a - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (active >= 0 && targets[active]) {
        recentSearches.push(q);
        onOpenChange(false);
        router.push(targets[active].href);
      } else submit(q);
    }
  };

  const showEmpty = q.trim().length > 1 && data && !pending && !data.products.length && !data.categories.length && !data.brands.length;
  let idx = -1;

  return (
    <D.Root open={open} onOpenChange={onOpenChange}>
      <D.Portal>
        <D.Overlay className="sheet-overlay fixed inset-0 z-[80] bg-black/40 backdrop-blur-sm" />
        <D.Content aria-describedby={undefined} className="dialog-content fixed inset-x-0 top-0 z-[81] mx-auto flex max-h-[100dvh] w-full max-w-3xl flex-col overflow-hidden bg-bg shadow-pop outline-none sm:top-6 sm:max-h-[85dvh] sm:rounded-3xl">
          <D.Title className="sr-only">{t("search.title")}</D.Title>
          <div className="flex items-center gap-3 border-b border-border px-4 sm:px-5">
            {pending ? <Spinner className="size-5 text-muted" /> : <Search className="size-5 text-muted" />}
            <input
              autoFocus
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={onKeyDown}
              placeholder={t("common.searchPlaceholder")}
              className="h-16 min-w-0 flex-1 bg-transparent text-[17px] outline-none placeholder:text-muted/70"
              role="combobox"
              aria-expanded={targets.length > 0}
              aria-controls="search-results"
              aria-activedescendant={active >= 0 ? `sr-${active}` : undefined}
              enterKeyHint="search"
              type="search"
            />
            {q && (
              <button type="button" onClick={() => setQ("")} className="grid size-8 place-items-center rounded-full text-muted hover:bg-surface" aria-label={t("common.clear")}>
                <X className="size-4" />
              </button>
            )}
            <D.Close className="rounded-lg px-2 py-1 text-sm font-medium text-muted hover:text-fg">{t("common.close")}</D.Close>
          </div>

          <div id="search-results" role="listbox" className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-5">
            {!q.trim() && (
              <div className="animate-fade-in space-y-7">
                {(recent.length > 0 || (data?.popular.length ?? 0) > 0) && (
                  <div className="grid gap-6 sm:grid-cols-2">
                    {recent.length > 0 && (
                      <div>
                        <div className="mb-2 flex items-center justify-between">
                          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted">{t("search.recent")}</h3>
                          <button type="button" onClick={() => (recentSearches.clear(), setRecent([]))} className="text-xs text-muted hover:text-fg">
                            {t("search.clearRecent")}
                          </button>
                        </div>
                        <ul>
                          {recent.map((r) => (
                            <li key={r}>
                              <button type="button" onClick={() => submit(r)} className="flex w-full items-center gap-3 rounded-xl px-2 py-2 text-sm hover:bg-surface">
                                <Clock className="size-4 text-muted" />
                                {r}
                              </button>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {data?.popular.length ? (
                      <div>
                        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted">{t("search.popular")}</h3>
                        <div className="flex flex-wrap gap-2">
                          {data.popular.map((p) => (
                            <button key={p} type="button" onClick={() => submit(p)} className="flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-sm transition hover:border-fg/30 hover:bg-surface">
                              <TrendingUp className="size-3.5 text-accent" />
                              {p}
                            </button>
                          ))}
                        </div>
                      </div>
                    ) : null}
                  </div>
                )}
                {data?.categories.length ? (
                  <section>
                    <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted">{t("search.categories")}</h3>
                    <div className="no-scrollbar -mx-1 flex gap-3 overflow-x-auto px-1 pb-1 sm:grid sm:grid-cols-6 sm:overflow-visible">
                      {data.categories.map((c) => (
                        <Link key={c.href} href={c.href} onClick={() => onOpenChange(false)} className="group flex w-[4.5rem] shrink-0 flex-col items-center gap-2 text-center sm:w-auto">
                          <span className="grid size-16 place-items-center overflow-hidden rounded-full bg-surface ring-1 ring-border transition group-hover:ring-accent">
                            {c.image && <Picture image={c.image} sizes="64px" className="size-full object-cover transition duration-500 group-hover:scale-105" />}
                          </span>
                          <span className="line-clamp-2 text-xs font-medium leading-tight">{c.label}</span>
                        </Link>
                      ))}
                    </div>
                  </section>
                ) : null}
                {data?.brands.length ? (
                  <section>
                    <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted">{t("search.brands")}</h3>
                    <div className="grid grid-cols-4 gap-2 sm:grid-cols-8">
                      {data.brands.map((b) => (
                        <Link key={b.href} href={b.href} onClick={() => onOpenChange(false)} title={b.label} className="grid h-14 place-items-center rounded-2xl border border-border px-2 transition hover:border-fg/25 hover:shadow-card">
                          {b.image ? <Picture image={b.image} sizes="96px" className="h-6 w-full object-contain" /> : <span className="truncate text-xs font-semibold">{b.label}</span>}
                        </Link>
                      ))}
                    </div>
                  </section>
                ) : null}
              </div>
            )}

            {showEmpty && (
              <div className="py-10 text-center">
                <p className="font-medium">{t("search.noResults", { q })}</p>
                <p className="mt-1 text-sm text-muted">{t("search.noResultsHint")}</p>
              </div>
            )}

            {q.trim() && data?.didYouMean && (
              <button type="button" onClick={() => setQ(data.didYouMean!)} className="animate-fade-in mb-4 flex items-center gap-2 rounded-xl bg-accent/8 px-3 py-2 text-sm">
                <Sparkles className="size-4 text-accent" />
                <span className="text-muted">{t("search.didYouMean")}</span>
                <span className="font-semibold text-accent">{data.didYouMean}</span>
              </button>
            )}

            {q.trim() && data && (data.products.length > 0 || data.categories.length > 0 || data.brands.length > 0) && (
              <div className="animate-fade-in space-y-6">
                {data.products.length > 0 && (
                  <section>
                    <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted">{t("search.products")}</h3>
                    <ul className="grid gap-1 sm:grid-cols-2">
                      {data.products.map((p) => {
                        idx++;
                        const i = idx;
                        return (
                          <li key={p.id} id={`sr-${i}`} role="option" aria-selected={active === i}>
                            <Link href={`/product/${p.slug}`} onClick={() => (recentSearches.push(q), onOpenChange(false))} className={cn("flex items-center gap-3 rounded-2xl p-2 transition hover:bg-surface", active === i && "bg-surface")}>
                              <Picture image={p.image} sizes="56px" className="size-14 shrink-0 rounded-xl bg-surface" />
                              <div className="min-w-0">
                                {p.brand && <p className="text-[10.5px] font-semibold uppercase tracking-wider text-muted">{p.brand.name}</p>}
                                <p className="truncate text-sm font-medium">{p.name}</p>
                                <Price price={p.price} size="sm" />
                              </div>
                            </Link>
                          </li>
                        );
                      })}
                    </ul>
                  </section>
                )}
                {(data.categories.length > 0 || data.brands.length > 0) && (
                  <div className="grid gap-6 sm:grid-cols-2">
                    {[
                      { key: "categories", list: data.categories },
                      { key: "brands", list: data.brands },
                    ].map(
                      (g) =>
                        g.list.length > 0 && (
                          <section key={g.key}>
                            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted">{t(`search.${g.key}` as "search.categories")}</h3>
                            <ul>
                              {g.list.map((c) => {
                                idx++;
                                const i = idx;
                                return (
                                  <li key={c.href} id={`sr-${i}`} role="option" aria-selected={active === i}>
                                    <Link href={c.href} onClick={() => onOpenChange(false)} className={cn("flex items-center justify-between rounded-xl px-2 py-2 text-sm hover:bg-surface", active === i && "bg-surface")}>
                                      {c.label}
                                      <ArrowUpRight className="flip-rtl size-4 text-muted" />
                                    </Link>
                                  </li>
                                );
                              })}
                            </ul>
                          </section>
                        ),
                    )}
                  </div>
                )}
                <button type="button" onClick={() => submit(q)} className="flex w-full items-center justify-between rounded-2xl bg-surface px-4 py-3 text-sm font-medium transition hover:bg-border/60">
                  {t("search.viewAllResults", { q })}
                  <CornerDownLeft className="size-4 text-muted" />
                </button>
              </div>
            )}
          </div>
        </D.Content>
      </D.Portal>
    </D.Root>
  );
}

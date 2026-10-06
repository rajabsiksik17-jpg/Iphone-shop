"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { ChevronDown, SlidersHorizontal, X, Check, Star, Search } from "lucide-react";
import { Link, usePathname, useRouter } from "@/i18n/navigation";
import { Sheet } from "@/components/ui/overlay";
import { Button } from "@/components/ui/button";
import { useStore } from "@/components/providers/store-context";
import { cn } from "@/lib/utils";
import type { ListingFacets, SortKey } from "@/types/catalog";

/** URL is the single source of truth for filters (shareable, back-button friendly, crawlable). */
function useListingParams() {
  const sp = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const [pending, start] = useTransition();
  // Results dim (see globals.css) from the moment a filter changes until the new URL renders.
  useEffect(() => {
    delete document.body.dataset.listingLoading;
  }, [sp]);
  const update = (mutate: (p: URLSearchParams) => void, opts: { keepPage?: boolean } = {}) => {
    const p = new URLSearchParams(sp.toString());
    mutate(p);
    if (!opts.keepPage) p.delete("page");
    const qs = p.toString();
    if (qs === sp.toString()) return;
    document.body.dataset.listingLoading = "";
    start(() => router.push(`${pathname}${qs ? `?${qs}` : ""}`, { scroll: false }));
  };
  const list = (k: string) => (sp.get(k) ?? "").split(",").filter(Boolean);
  const toggle = (k: string, v: string) =>
    update((p) => {
      const set = new Set((p.get(k) ?? "").split(",").filter(Boolean));
      if (set.has(v)) set.delete(v);
      else set.add(v);
      if (set.size) p.set(k, [...set].join(","));
      else p.delete(k);
    });
  return { sp, update, list, toggle, pending };
}

function FacetGroup({ title, children, defaultOpen = true, count }: { title: string; children: React.ReactNode; defaultOpen?: boolean; count?: number }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border-b border-border py-4">
      <button type="button" onClick={() => setOpen((o) => !o)} className="flex w-full items-center justify-between text-sm font-semibold" aria-expanded={open}>
        <span className="flex items-center gap-2">
          {title}
          {count ? <span className="rounded-full bg-accent px-1.5 text-[10px] leading-4 text-accent-fg">{count}</span> : null}
        </span>
        <ChevronDown className={cn("size-4 text-muted transition-transform", open && "rotate-180")} />
      </button>
      <div className={cn("grid transition-all duration-300", open ? "mt-3 grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0")}>
        <div className="overflow-hidden">{children}</div>
      </div>
    </div>
  );
}

function CheckRow({ label, count, checked, onChange, swatch }: { label: string; count?: number; checked: boolean; onChange: () => void; swatch?: string | null }) {
  return (
    <label className="flex cursor-pointer items-center gap-3 rounded-lg py-1.5 text-sm text-fg/85 hover:text-fg">
      <input type="checkbox" checked={checked} onChange={onChange} className="sr-only" />
      <span aria-hidden className={cn("grid size-[18px] shrink-0 place-items-center rounded-md border transition", checked ? "border-accent bg-accent text-accent-fg" : "border-border bg-bg")}>
        {checked && <Check className="size-3" strokeWidth={3} />}
      </span>
      {swatch && <span className="size-4 rounded-full ring-1 ring-black/10" style={{ backgroundColor: swatch }} />}
      <span className="flex-1">{label}</span>
      {count !== undefined && <span className="tabular text-xs text-muted">{count}</span>}
    </label>
  );
}

/** Long facet lists get a search box and "show all" instead of a wall of checkboxes. */
function SearchableList<T extends { slug: string; label: string }>({ items, render, selected }: { items: T[]; render: (item: T) => React.ReactNode; selected: string[] }) {
  const t = useTranslations("listing");
  const [q, setQ] = useState("");
  const [all, setAll] = useState(false);
  const long = items.length > 8;
  const needle = q.trim().toLowerCase();
  const filtered = needle ? items.filter((i) => i.label.toLowerCase().includes(needle)) : items;
  // Selected values always stay visible, even when the list is collapsed.
  const shown = all || needle || !long ? filtered : [...filtered.slice(0, 6), ...filtered.slice(6).filter((i) => selected.includes(i.slug))];
  return (
    <div>
      {long && (
        <div className="relative mb-2">
          <Search className="pointer-events-none absolute start-3 top-1/2 size-3.5 -translate-y-1/2 text-muted" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("searchIn")} aria-label={t("searchIn")} className="h-9 w-full rounded-xl border border-border bg-bg pe-3 ps-8 text-[13px] outline-none transition focus:border-accent" />
        </div>
      )}
      {shown.map(render)}
      {needle && !filtered.length && <p className="py-2 text-xs text-muted">{t("noMatches")}</p>}
      {long && !needle && filtered.length > 6 && (
        <button type="button" onClick={() => setAll((v) => !v)} className="mt-1 text-[13px] font-medium text-accent hover:underline">
          {all ? t("showLess") : t("showAll", { count: filtered.length })}
        </button>
      )}
    </div>
  );
}

/** Dual-handle price slider with exact inputs; applies on release / blur / Enter. */
function PriceRange({ min, max }: { min: number; max: number }) {
  const t = useTranslations("listing");
  const { money, format } = useStore();
  const { sp, update } = useListingParams();
  const factor = 10 ** money.base.decimals;
  const floor = Math.floor(min / factor);
  const ceil = Math.max(floor + 1, Math.ceil(max / factor));
  const step = Math.max(1, Math.round((ceil - floor) / 100));
  const fromUrl = (k: string, d: number) => (sp.get(k) ? Math.min(ceil, Math.max(floor, Number(sp.get(k)))) : d);
  const [lo, setLo] = useState(() => fromUrl("min", floor));
  const [hi, setHi] = useState(() => fromUrl("max", ceil));
  useEffect(() => {
    setLo(fromUrl("min", floor));
    setHi(fromUrl("max", ceil));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sp, floor, ceil]);
  const commit = () =>
    update((p) => {
      if (lo > floor) p.set("min", String(lo));
      else p.delete("min");
      if (hi < ceil) p.set("max", String(hi));
      else p.delete("max");
    });
  // Arrow keys fire many key-ups; apply once the user pauses.
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const commitSoon = () => {
    clearTimeout(timer.current);
    timer.current = setTimeout(commit, 450);
  };
  const pct = (v: number) => ((v - floor) / (ceil - floor)) * 100;
  const thumb =
    "pointer-events-none absolute inset-x-0 top-1/2 h-0 w-full -translate-y-1/2 appearance-none bg-transparent outline-none [&::-moz-range-thumb]:pointer-events-auto [&::-moz-range-thumb]:size-5 [&::-moz-range-thumb]:cursor-grab [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-accent [&::-moz-range-thumb]:bg-bg [&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:size-5 [&::-webkit-slider-thumb]:cursor-grab [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-accent [&::-webkit-slider-thumb]:bg-bg [&::-webkit-slider-thumb]:shadow-md focus-visible:[&::-webkit-slider-thumb]:ring-4 focus-visible:[&::-webkit-slider-thumb]:ring-accent/25";
  return (
    <div>
      <div className="relative mx-2.5 h-6" dir="ltr">
        <div className="absolute inset-x-0 top-1/2 h-1 -translate-y-1/2 rounded-full bg-border" />
        <div className="absolute top-1/2 h-1 -translate-y-1/2 rounded-full bg-accent" style={{ left: `${pct(lo)}%`, right: `${100 - pct(hi)}%` }} />
        <input type="range" min={floor} max={ceil} step={step} value={lo} aria-label={t("min")} onChange={(e) => setLo(Math.min(Number(e.target.value), hi - step))} onPointerUp={commit} onKeyUp={commitSoon} className={thumb} />
        <input type="range" min={floor} max={ceil} step={step} value={hi} aria-label={t("max")} onChange={(e) => setHi(Math.max(Number(e.target.value), lo + step))} onPointerUp={commit} onKeyUp={commitSoon} className={thumb} />
      </div>
      <form
        className="mt-3 flex items-center gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          commit();
        }}
      >
        <label className="flex-1">
          <span className="sr-only">{t("min")}</span>
          <input inputMode="numeric" value={lo} onChange={(e) => setLo(Math.min(Number(e.target.value.replace(/\D/g, "")) || 0, hi))} onBlur={commit} className="tabular h-9 w-full rounded-xl border border-border bg-bg px-3 text-center text-sm outline-none focus:border-accent" />
        </label>
        <span className="text-muted" aria-hidden>
          –
        </span>
        <label className="flex-1">
          <span className="sr-only">{t("max")}</span>
          <input inputMode="numeric" value={hi} onChange={(e) => setHi(Math.max(Number(e.target.value.replace(/\D/g, "")) || 0, lo))} onBlur={commit} className="tabular h-9 w-full rounded-xl border border-border bg-bg px-3 text-center text-sm outline-none focus:border-accent" />
        </label>
        <button type="submit" className="sr-only">
          {t("filter")}
        </button>
      </form>
      <p className="mt-2 text-center text-xs text-muted">
        {format(lo * factor)} – {format(hi * factor)}
      </p>
    </div>
  );
}

export function FilterPanel({ facets, hideBrands }: { facets: ListingFacets; hideBrands?: boolean }) {
  const t = useTranslations("listing");
  const { sp, update, list, toggle } = useListingParams();
  const brands = list("brand");
  return (
    <div>
      {facets.categories.length > 0 && (
        <FacetGroup title={t("category")}>
          <ul className="space-y-0.5">
            {facets.categories.map((c) => (
              <li key={c.fullSlug}>
                <Link href={`/category/${c.fullSlug}`} className="flex items-center justify-between rounded-lg py-1.5 text-sm text-fg/85 hover:text-fg">
                  {c.label}
                  <span className="tabular text-xs text-muted">{c.count}</span>
                </Link>
              </li>
            ))}
          </ul>
        </FacetGroup>
      )}
      <FacetGroup title={t("availability")}>
        <CheckRow label={t("inStockOnly")} count={facets.availability.inStock} checked={sp.get("stock") === "1"} onChange={() => update((p) => (p.get("stock") ? p.delete("stock") : p.set("stock", "1")))} />
        <CheckRow label={t("onSaleOnly")} count={facets.availability.onSale} checked={sp.get("sale") === "1"} onChange={() => update((p) => (p.get("sale") ? p.delete("sale") : p.set("sale", "1")))} />
      </FacetGroup>
      {facets.price.max > 0 && (
        <FacetGroup title={t("price")} count={sp.get("min") || sp.get("max") ? 1 : 0}>
          <PriceRange min={facets.price.min} max={facets.price.max} />
        </FacetGroup>
      )}
      {!hideBrands && facets.brands.length > 0 && (
        <FacetGroup title={t("brand")} count={brands.length}>
          <SearchableList items={facets.brands} selected={brands} render={(b) => <CheckRow key={b.slug} label={b.label} count={b.count} checked={brands.includes(b.slug)} onChange={() => toggle("brand", b.slug)} />} />
        </FacetGroup>
      )}
      {facets.attributes.map((a, i) => {
        const selected = list(`a_${a.key}`);
        return (
          <FacetGroup key={a.key} title={a.label} count={selected.length} defaultOpen={i < 4 || selected.length > 0}>
            {a.type === "COLOR" ? (
              <div className="flex flex-wrap gap-2">
                {a.values.map((v) => (
                  <button
                    key={v.slug}
                    type="button"
                    onClick={() => toggle(`a_${a.key}`, v.slug)}
                    aria-pressed={selected.includes(v.slug)}
                    title={`${v.label} (${v.count})`}
                    className={cn("size-8 rounded-full ring-1 ring-black/10 ring-offset-2 ring-offset-bg transition", selected.includes(v.slug) && "ring-2 ring-accent")}
                    style={{ backgroundColor: v.hex ?? "#ccc" }}
                  >
                    <span className="sr-only">{v.label}</span>
                  </button>
                ))}
              </div>
            ) : (
              <SearchableList items={a.values} selected={selected} render={(v) => <CheckRow key={v.slug} label={v.label} count={v.count} checked={selected.includes(v.slug)} onChange={() => toggle(`a_${a.key}`, v.slug)} />} />
            )}
          </FacetGroup>
        );
      })}
      {facets.ratings.length > 0 && (
        <FacetGroup title={t("rating")} defaultOpen={false}>
          {facets.ratings.map((r) => (
            <label key={r.stars} className="flex cursor-pointer items-center gap-3 py-1.5 text-sm">
              <input type="radio" name="rating" checked={sp.get("rating") === String(r.stars)} onChange={() => update((p) => p.set("rating", String(r.stars)))} className="size-4 accent-[var(--color-accent)]" />
              <span className="flex items-center gap-0.5 text-amber-400">
                {Array.from({ length: r.stars }, (_, i) => (
                  <Star key={i} className="size-3.5 fill-current" />
                ))}
              </span>
              <span className="text-fg/80">{t("andUp")}</span>
              <span className="tabular ms-auto text-xs text-muted">{r.count}</span>
            </label>
          ))}
        </FacetGroup>
      )}
    </div>
  );
}

export function ActiveFilters({ facets }: { facets: ListingFacets }) {
  const t = useTranslations("listing");
  const { money } = useStore();
  const { sp, update } = useListingParams();
  const chips = useMemo(() => {
    const out: { label: string; remove: (p: URLSearchParams) => void }[] = [];
    for (const b of (sp.get("brand") ?? "").split(",").filter(Boolean)) {
      out.push({ label: facets.brands.find((x) => x.slug === b)?.label ?? b, remove: (p) => p.set("brand", (p.get("brand") ?? "").split(",").filter((x) => x !== b).join(",")) });
    }
    for (const [k, v] of sp.entries()) {
      if (!k.startsWith("a_")) continue;
      const facet = facets.attributes.find((a) => a.key === k.slice(2));
      for (const slug of v.split(",").filter(Boolean)) {
        out.push({ label: `${facet?.label ?? k.slice(2)}: ${facet?.values.find((x) => x.slug === slug)?.label ?? slug}`, remove: (p) => p.set(k, (p.get(k) ?? "").split(",").filter((x) => x !== slug).join(",")) });
      }
    }
    if (sp.get("min") || sp.get("max")) out.push({ label: `${t("price")}: ${sp.get("min") ?? "0"} – ${sp.get("max") ?? "∞"} ${money.base.code}`, remove: (p) => (p.delete("min"), p.delete("max")) });
    if (sp.get("stock")) out.push({ label: t("inStockOnly"), remove: (p) => p.delete("stock") });
    if (sp.get("sale")) out.push({ label: t("onSaleOnly"), remove: (p) => p.delete("sale") });
    if (sp.get("rating")) out.push({ label: `${sp.get("rating")}★ ${t("andUp")}`, remove: (p) => p.delete("rating") });
    return out;
  }, [sp, facets, t, money.base.code]);
  if (!chips.length) return null;
  return (
    <div className="flex flex-wrap items-center gap-2">
      {chips.map((c) => (
        <button
          key={c.label}
          type="button"
          onClick={() =>
            update((p) => {
              c.remove(p);
              for (const [k, v] of [...p.entries()]) if (!v) p.delete(k);
            })
          }
          className="animate-scale-in flex items-center gap-1.5 rounded-full bg-surface py-1.5 pe-2 ps-3 text-[13px] font-medium transition hover:bg-border/60"
        >
          {c.label}
          <X className="size-3.5 text-muted" />
        </button>
      ))}
      <button type="button" onClick={() => update((p) => [...p.keys()].filter((k) => k !== "q" && k !== "sort").forEach((k) => p.delete(k)))} className="text-[13px] font-medium text-muted underline-offset-4 hover:text-fg hover:underline">
        {t("resetFilters")}
      </button>
    </div>
  );
}

export function SortSelect({ options, current }: { options: SortKey[]; current: SortKey }) {
  const t = useTranslations("listing");
  const { update } = useListingParams();
  return (
    <label className="relative flex items-center gap-2 text-sm">
      <span className="text-muted max-sm:sr-only">{t("sortBy")}</span>
      <select
        value={current}
        onChange={(e) => update((p) => p.set("sort", e.target.value))}
        className="h-10 appearance-none rounded-full border border-border bg-bg pe-9 ps-4 text-sm font-medium outline-none transition hover:border-fg/30 focus:border-accent"
      >
        {options.map((o) => (
          <option key={o} value={o}>
            {t(`sorts.${o}`)}
          </option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute end-3 size-4 text-muted" />
    </label>
  );
}

export function MobileFilters({ facets, total, hideBrands }: { facets: ListingFacets; total: number; hideBrands?: boolean }) {
  const t = useTranslations("listing");
  const [open, setOpen] = useState(false);
  const { sp, pending } = useListingParams();
  const active = [...sp.keys()].filter((k) => !["q", "sort", "page"].includes(k)).length;
  return (
    <>
      <Button variant="outline" size="sm" className="h-10 lg:hidden" onClick={() => setOpen(true)} leftIcon={<SlidersHorizontal />}>
        {t("filters")}
        {active > 0 && <span className="rounded-full bg-accent px-1.5 text-[10px] leading-4 text-accent-fg">{active}</span>}
      </Button>
      <Sheet
        open={open}
        onOpenChange={setOpen}
        side="bottom"
        title={t("filters")}
        footer={
          <Button block size="lg" loading={pending} onClick={() => setOpen(false)}>
            {t("showResults", { count: total })}
          </Button>
        }
      >
        <div className="px-5 pb-4">
          <FilterPanel facets={facets} hideBrands={hideBrands} />
        </div>
      </Sheet>
    </>
  );
}

export function ListingPending({ children }: { children: React.ReactNode }) {
  return <div className="transition-opacity">{children}</div>;
}

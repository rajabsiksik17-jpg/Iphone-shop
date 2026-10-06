"use client";

import { useMemo, useState, useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Check, ChevronDown, Globe, Search } from "lucide-react";
import { Link, usePathname, useRouter } from "@/i18n/navigation";
import { useSearchParams } from "next/navigation";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/menu";
import { Flag } from "@/components/ui/flag";
import { Spinner } from "@/components/ui/spinner";
import { useStore } from "@/components/providers/store-context";
import { setDisplayCurrencyAction } from "@/actions/cart";
import { cn } from "@/lib/utils";

const LANGS = [
  { code: "ar", label: "العربية", flag: "SA" },
  { code: "en", label: "English", flag: "US" },
] as const;

/** Switch language keeping the current page and query (the choice is remembered in a cookie). */
export function useLanguageHref() {
  const pathname = usePathname();
  const sp = useSearchParams();
  const qs = sp.toString();
  return `${pathname}${qs ? `?${qs}` : ""}`;
}

export function LanguageSelect({ className }: { className?: string }) {
  const t = useTranslations("header");
  const locale = useLocale();
  const href = useLanguageHref();
  const current = LANGS.find((l) => l.code === locale)!;
  return (
    <Popover>
      <PopoverTrigger className={cn("flex items-center gap-1.5 rounded-full text-sm transition hover:text-fg", className)} aria-label={t("language")}>
        <Globe className="size-4" />
        {current.label}
        <ChevronDown className="size-3.5" />
      </PopoverTrigger>
      <PopoverContent align="end" className="w-44 p-1.5">
        {LANGS.map((l) => (
          <Link key={l.code} href={href} locale={l.code} hrefLang={l.code} lang={l.code} className={cn("flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm transition hover:bg-surface", l.code === locale && "font-semibold")}>
            {l.label}
            {l.code === locale && <Check className="ms-auto size-4 text-accent" />}
          </Link>
        ))}
      </PopoverContent>
    </Popover>
  );
}

/** Inline list for the mobile drawer. */
export function LanguageList() {
  const locale = useLocale();
  const href = useLanguageHref();
  return (
    <div className="grid grid-cols-2 gap-2">
      {LANGS.map((l) => (
        <Link key={l.code} href={href} locale={l.code} hrefLang={l.code} lang={l.code} className={cn("flex items-center justify-center gap-2 rounded-xl border py-2.5 text-sm transition", l.code === locale ? "border-fg bg-fg text-bg" : "border-border hover:border-fg/30")}>
          {l.label}
        </Link>
      ))}
    </div>
  );
}

function useCurrencySwitch() {
  const { currencies, money } = useStore();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [target, setTarget] = useState<string | null>(null);
  const choose = (code: string) => {
    if (code === money.display.code) return;
    setTarget(code);
    start(async () => {
      await setDisplayCurrencyAction(code);
      router.refresh();
    });
  };
  return { currencies, current: money.display.code, choose, pending, target };
}

function CurrencyRows({ onPick, dense }: { onPick?: () => void; dense?: boolean }) {
  const t = useTranslations("header");
  const { currencies, current, choose, pending, target } = useCurrencySwitch();
  const [q, setQ] = useState("");
  const list = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return needle ? currencies.filter((c) => `${c.code} ${c.name}`.toLowerCase().includes(needle)) : currencies;
  }, [currencies, q]);
  return (
    <div>
      {currencies.length > 8 && (
        <div className="relative mb-1.5">
          <Search className="pointer-events-none absolute start-3 top-1/2 size-3.5 -translate-y-1/2 text-muted" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("searchCurrency")} aria-label={t("searchCurrency")} className="h-9 w-full rounded-lg border border-border bg-bg pe-3 ps-8 text-sm outline-none focus:border-accent" />
        </div>
      )}
      <ul className={cn("overflow-y-auto", dense ? "max-h-72" : "")}>
        {list.map((c) => (
          <li key={c.code}>
            <button
              type="button"
              onClick={() => (choose(c.code), onPick?.())}
              className={cn("flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-start text-sm transition hover:bg-surface", c.code === current && "bg-surface")}
            >
              <Flag code={c.flag} />
              <span className="w-10 font-semibold tabular">{c.code}</span>
              <span className="min-w-0 flex-1 truncate text-muted">{c.name}</span>
              <span className="text-xs text-muted">{c.symbol}</span>
              {pending && target === c.code ? <Spinner className="size-4" /> : c.code === current ? <Check className="size-4 text-accent" /> : null}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Header dropdown: flag + code; searchable list of currencies. */
export function CurrencySelect({ className }: { className?: string }) {
  const t = useTranslations("header");
  const { currencies, money } = useStore();
  const [open, setOpen] = useState(false);
  if (currencies.length < 2) return null;
  const current = currencies.find((c) => c.code === money.display.code);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger className={cn("flex items-center gap-1.5 rounded-full text-sm transition hover:text-fg", className)} aria-label={t("currency", { code: money.display.code })}>
        <Flag code={current?.flag} />
        <span className="font-medium tabular">{money.display.code}</span>
        <ChevronDown className="size-3.5" />
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-2">
        <CurrencyRows dense onPick={() => setOpen(false)} />
      </PopoverContent>
    </Popover>
  );
}

/** Inline list for the mobile drawer. */
export function CurrencyList() {
  const { currencies } = useStore();
  if (currencies.length < 2) return null;
  return <CurrencyRows />;
}

"use client";

import { useMemo, useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { ChevronDown, Globe } from "lucide-react";
import { Link, usePathname, useRouter } from "@/i18n/navigation";
import { useSearchParams } from "next/navigation";
import { Flag } from "@/components/ui/flag";
import { Spinner } from "@/components/ui/spinner";
import { Combobox, type ComboOption } from "@/components/ui/combobox";
import { useStore } from "@/components/providers/store-context";
import { setDisplayCurrencyAction } from "@/actions/cart";
import { cn } from "@/lib/utils";

const LANGS = [
  { code: "ar", label: "العربية", keywords: "Arabic arabi عربي" },
  { code: "en", label: "English", keywords: "انجليزي إنجليزية انكليزي" },
] as const;

/** Switch language keeping the current page and query (the choice is remembered in a cookie). */
export function useLanguageHref() {
  const pathname = usePathname();
  const sp = useSearchParams();
  const qs = sp.toString();
  return `${pathname}${qs ? `?${qs}` : ""}`;
}

const pill = "flex items-center gap-1.5 rounded-full text-sm transition hover:text-fg";

export function LanguageSelect({ className }: { className?: string }) {
  const t = useTranslations("header");
  const locale = useLocale();
  const href = useLanguageHref();
  const router = useRouter();
  const options = useMemo<ComboOption[]>(() => LANGS.map((l) => ({ value: l.code, label: l.label, keywords: l.keywords })), []);
  return (
    <Combobox
      label={t("language")}
      options={options}
      value={locale}
      searchable={false}
      onChange={(code) => code !== locale && router.replace(href, { locale: code })}
      className={cn(pill, className)}
      trigger={(sel) => (
        <span className="flex items-center gap-1.5">
          <Globe className="size-4" />
          {sel?.label}
          <ChevronDown className="size-3.5" />
        </span>
      )}
    />
  );
}

/** Inline two-way switch for the mobile drawer. */
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

/** Currency options: flag, code, local name and symbol; searchable by any of them. */
function useCurrencyOptions(): { options: ComboOption[]; current: string; choose: (code: string) => void; pending: boolean } {
  const { currencies, money } = useStore();
  const router = useRouter();
  const [pending, start] = useTransition();
  const options = useMemo<ComboOption[]>(() => currencies.map((c) => ({ value: c.code, label: `${c.code} · ${c.name}`, hint: c.symbol, icon: <Flag code={c.flag} />, keywords: c.name })), [currencies]);
  const choose = (code: string) => {
    if (code === money.display.code) return;
    start(async () => {
      await setDisplayCurrencyAction(code);
      router.refresh();
    });
  };
  return { options, current: money.display.code, choose, pending };
}

/** Header currency dropdown (flag + code). */
export function CurrencySelect({ className }: { className?: string }) {
  const t = useTranslations("header");
  const { currencies } = useStore();
  const { options, current, choose, pending } = useCurrencyOptions();
  if (currencies.length < 2) return null;
  const flag = currencies.find((c) => c.code === current)?.flag;
  return (
    <Combobox
      label={t("currency", { code: current })}
      options={options}
      value={current}
      onChange={choose}
      searchable={currencies.length > 6}
      className={cn(pill, className)}
      trigger={() => (
        <span className="flex items-center gap-1.5">
          {pending ? <Spinner className="size-4" /> : <Flag code={flag} />}
          <span className="font-medium tabular">{current}</span>
          <ChevronDown className="size-3.5" />
        </span>
      )}
    />
  );
}

/** Mobile drawer: one field-style row that opens the searchable list as a sheet. */
export function CurrencyList() {
  const t = useTranslations("header");
  const { currencies } = useStore();
  const { options, current, choose } = useCurrencyOptions();
  if (currencies.length < 2) return null;
  return <Combobox label={t("currency", { code: current })} options={options} value={current} onChange={choose} searchable={currencies.length > 6} />;
}

"use client";

import { useMemo } from "react";
import { useLocale, useTranslations } from "next-intl";
import { ChevronDown } from "lucide-react";
import flags from "react-phone-number-input/flags";
import { getCountryCallingCode, type CountryCode } from "libphonenumber-js";
import { Combobox, type ComboOption } from "@/components/ui/combobox";

type FlagMap = Record<string, (p: { title: string }) => React.ReactElement>;

/** Flag for any ISO country (same set the phone field uses — no extra download). */
export function CountryFlag({ code, className = "h-3.5 w-5" }: { code: string; className?: string }) {
  const F = (flags as unknown as FlagMap)[code];
  return F ? (
    <span className={`inline-block overflow-hidden rounded-[3px] shadow-[0_0_0_1px_rgb(0_0_0/0.08)] [&>svg]:size-full ${className}`}>
      <F title="" />
    </span>
  ) : (
    <span className={`inline-block rounded-[3px] bg-surface ${className}`} />
  );
}

const callingCode = (code: string) => {
  try {
    return `+${getCountryCallingCode(code as CountryCode)}`;
  } catch {
    return "";
  }
};

/** Country options with flags; searchable in Arabic and English, by ISO code or calling code. */
export function useCountryOptions(codes: { code: string; name: string }[], withCallingCode = false): ComboOption[] {
  const locale = useLocale();
  return useMemo(() => {
    const other = new Intl.DisplayNames([locale === "ar" ? "en" : "ar"], { type: "region" });
    return codes.map((c) => {
      const dial = callingCode(c.code);
      return { value: c.code, label: c.name, hint: withCallingCode ? dial : undefined, icon: <CountryFlag code={c.code} />, keywords: `${other.of(c.code) ?? ""} ${dial} ${dial.slice(1)}` };
    });
  }, [codes, locale, withCallingCode]);
}

export function CountrySelect({ countries, value, onChange, invalid, id }: { countries: { code: string; name: string }[]; value: string; onChange: (code: string) => void; invalid?: boolean; id?: string }) {
  const t = useTranslations("checkout");
  const options = useCountryOptions(countries);
  return <Combobox id={id} label={t("country")} options={options} value={value} onChange={onChange} invalid={invalid} searchable />;
}

/** City / governorate picker, grouped by administrative region when available. */
export function CitySelect({ regions, value, onChange, invalid, id }: { regions: { id: string; name: string; group: string; alt?: string }[]; value: string | null; onChange: (id: string, name: string) => void; invalid?: boolean; id?: string }) {
  const t = useTranslations("checkout");
  const options = useMemo<ComboOption[]>(() => regions.map((r) => ({ value: r.id, label: r.name, group: r.group || undefined, keywords: r.alt })), [regions]);
  return <Combobox id={id} label={t("city")} placeholder={t("chooseCity")} options={options} value={value} onChange={(v) => onChange(v, regions.find((r) => r.id === v)?.name ?? "")} invalid={invalid} searchable />;
}

/**
 * Country picker inside the phone field (react-phone-number-input's
 * `countrySelectComponent`): a compact flag + chevron that opens the same
 * searchable dropdown, listing calling codes.
 */
export function PhoneCountrySelect({ value, onChange, options, disabled }: { value?: string; onChange: (v?: string) => void; options: { value?: string; label: string }[]; disabled?: boolean }) {
  const t = useTranslations("checkout");
  const list = useMemo(() => options.filter((o): o is { value: string; label: string } => Boolean(o.value)).map((o) => ({ code: o.value, name: o.label })), [options]);
  const opts = useCountryOptions(list, true);
  return (
    <Combobox
      label={t("phoneCountry")}
      options={opts}
      value={value ?? null}
      onChange={(v) => onChange(v)}
      disabled={disabled}
      searchable
      className="flex h-11 shrink-0 items-center gap-1.5 rounded-lg pe-1 ps-0.5"
      trigger={(sel) => (
        <span className="flex items-center gap-1.5">
          {sel ? <CountryFlag code={sel.value} /> : <span className="h-3.5 w-5 rounded-[3px] bg-surface" />}
          <ChevronDown className="size-3.5 text-muted" />
        </span>
      )}
    />
  );
}

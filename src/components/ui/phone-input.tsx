"use client";

import PhoneInputBase, { type Country } from "react-phone-number-input";
import flags from "react-phone-number-input/flags";
import arLabels from "react-phone-number-input/locale/ar.json";
import enLabels from "react-phone-number-input/locale/en.json";
import { useLocale } from "next-intl";
import { cn } from "@/lib/utils";
import { useOptionalStore } from "@/components/providers/store-context";
import { PhoneCountrySelect } from "@/components/store/geo-select";

/**
 * The one phone input used everywhere (checkout, register, profile, address,
 * contact, admin). Backed by libphonenumber metadata for every country:
 * flag, calling code, as-you-type formatting and validation. Emits E.164
 * (e.g. +9665XXXXXXXX). Country defaults to the visitor's detected country,
 * falling back to Saudi Arabia (+966); the shopper can always change it from
 * the searchable country dropdown (flags, names in both languages, codes).
 */
export function PhoneInput({
  value,
  onChange,
  id,
  name,
  invalid,
  defaultCountry,
  className,
  disabled,
  required,
  "aria-describedby": describedBy,
}: {
  value: string | undefined;
  onChange: (v: string) => void;
  id?: string;
  name?: string;
  invalid?: boolean;
  defaultCountry?: string;
  className?: string;
  disabled?: boolean;
  required?: boolean;
  "aria-describedby"?: string;
}) {
  const locale = useLocale();
  const store = useOptionalStore();
  const country = (defaultCountry ?? store?.detectedCountry ?? store?.defaultCountry ?? "SA").toUpperCase() as Country;
  return (
    <div
      dir="ltr"
      className={cn(
        "nq-phone flex h-12 items-center rounded-xl border border-border bg-bg ps-3 transition-[border-color,box-shadow] focus-within:border-accent focus-within:ring-4 focus-within:ring-accent/12",
        invalid && "border-red-500 focus-within:ring-red-500/12",
        disabled && "opacity-70",
        className,
      )}
    >
      <PhoneInputBase
        id={id}
        name={name}
        international
        countryCallingCodeEditable={false}
        defaultCountry={country}
        flags={flags}
        countrySelectComponent={PhoneCountrySelect}
        labels={locale === "ar" ? arLabels : enLabels}
        value={value || undefined}
        onChange={(v) => onChange(v ?? "")}
        disabled={disabled}
        required={required}
        aria-invalid={invalid || undefined}
        aria-describedby={describedBy}
        autoComplete="tel"
        className="w-full"
        numberInputProps={{ className: "h-11 w-full bg-transparent px-3 text-[15px] text-fg outline-none placeholder:text-muted/70", inputMode: "tel" }}
      />
    </div>
  );
}

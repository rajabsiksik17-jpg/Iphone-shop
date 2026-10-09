/**
 * Country profiles — the single source of country-specific behaviour.
 *
 * Components and services never branch on country codes (`if (country === "SA")`);
 * they read a profile from here. Adding a country = adding one entry (anything
 * left out falls back to sensible defaults through `countryProfile()`).
 *
 * Used for: the primary store country (business defaults: currency, phone
 * country, tax, payment badges, timezone, city list) and per-address behaviour
 * at checkout (postal code rule, address labels, phone validation via
 * libphonenumber).
 */
import { getCountryCallingCode, type CountryCode } from "libphonenumber-js";
import { regionPresetCount } from "./regions-data";

type T = { en: string; ar: string };
const L = (en: string, ar: string): T => ({ en, ar });

export type CountryProfile = {
  code: string;
  name: T;
  /** Natural shopping currency (ISO 4217). */
  currency: string;
  /** International dialing code, e.g. "+966" (derived from libphonenumber when omitted). */
  dialCode: string;
  defaultLocale: "ar" | "en";
  timezone: string;
  /** How the city field is labelled and what the first-level division is called. */
  address: {
    cityLabel: T;
    areaLabel: T;
    /** Postal code at checkout. */
    postalCode: "hidden" | "optional" | "required";
    /** Typical postal code pattern (validation hint only). */
    postalPattern?: string;
  };
  /** Consumer tax defaults when this is the primary country (basis points; 0 = none). */
  tax: { rateBp: number; label: T; pricesIncludeTax: boolean };
  /** Payment badges shown in the footer and suggested local methods. */
  payments: { badges: string[]; local: T[] };
  /** Checkout fields this market expects. */
  checkout: { requireArea: boolean; nationalAddressHint?: T };
};

const tz = {
  SA: "Asia/Riyadh", JO: "Asia/Amman", AE: "Asia/Dubai", KW: "Asia/Kuwait", QA: "Asia/Qatar", BH: "Asia/Bahrain", OM: "Asia/Muscat",
  EG: "Africa/Cairo", IQ: "Asia/Baghdad", LB: "Asia/Beirut", PS: "Asia/Hebron", MA: "Africa/Casablanca", TN: "Africa/Tunis", DZ: "Africa/Algiers",
} as const;

const city = { governorate: L("Governorate / city", "المحافظة / المدينة"), emirate: L("Emirate / city", "الإمارة / المدينة"), wilaya: L("Wilaya / city", "الولاية / المدينة"), region: L("Region / city", "الجهة / المدينة"), city: L("City", "المدينة") };
const area = { district: L("District", "الحي"), area: L("Area", "المنطقة"), block: L("Area / block", "المنطقة / القطعة") };
const VAT = (pct: number) => ({ rateBp: pct * 100, label: L("VAT", "ضريبة القيمة المضافة"), pricesIncludeTax: true });
const NO_TAX = { rateBp: 0, label: L("Tax", "الضريبة"), pricesIncludeTax: true };

type Partial = Omit<CountryProfile, "dialCode" | "timezone"> & { dialCode?: string };

/** Supported primary-store countries, in the order offered to the super-admin. */
const DEFS: Partial[] = [
  {
    code: "SA", name: L("Saudi Arabia", "المملكة العربية السعودية"), currency: "SAR", defaultLocale: "ar",
    address: { cityLabel: city.governorate, areaLabel: area.district, postalCode: "optional", postalPattern: "^\\d{5}$" },
    tax: VAT(15), payments: { badges: ["mada", "visa", "mastercard", "applepay", "stcpay", "tabby", "tamara", "cod"], local: [L("mada", "مدى"), L("STC Pay", "STC Pay"), L("Apple Pay", "Apple Pay")] },
    checkout: { requireArea: true, nationalAddressHint: L("Short national address (optional), e.g. RRRD2929", "العنوان الوطني المختصر (اختياري)، مثل RRRD2929") },
  },
  {
    code: "JO", name: L("Jordan", "الأردن"), currency: "JOD", defaultLocale: "ar",
    address: { cityLabel: city.governorate, areaLabel: area.area, postalCode: "optional", postalPattern: "^\\d{5}$" },
    tax: { rateBp: 1600, label: L("Sales tax", "ضريبة المبيعات"), pricesIncludeTax: true }, payments: { badges: ["visa", "mastercard", "cliq", "cod"], local: [L("CliQ", "كليك"), L("eFAWATEERcom", "إي فواتيركم")] },
    checkout: { requireArea: true },
  },
  {
    code: "AE", name: L("United Arab Emirates", "الإمارات العربية المتحدة"), currency: "AED", defaultLocale: "ar",
    address: { cityLabel: city.emirate, areaLabel: area.area, postalCode: "hidden" },
    tax: VAT(5), payments: { badges: ["visa", "mastercard", "applepay", "tabby", "tamara", "cod"], local: [L("Apple Pay", "Apple Pay"), L("Tabby", "تابي")] },
    checkout: { requireArea: true },
  },
  {
    code: "KW", name: L("Kuwait", "الكويت"), currency: "KWD", defaultLocale: "ar",
    address: { cityLabel: city.governorate, areaLabel: area.block, postalCode: "hidden" },
    tax: NO_TAX, payments: { badges: ["knet", "visa", "mastercard", "applepay", "cod"], local: [L("KNET", "كي نت")] },
    checkout: { requireArea: true },
  },
  {
    code: "QA", name: L("Qatar", "قطر"), currency: "QAR", defaultLocale: "ar",
    address: { cityLabel: city.city, areaLabel: area.area, postalCode: "hidden" },
    tax: NO_TAX, payments: { badges: ["visa", "mastercard", "applepay", "cod"], local: [L("NAPS", "نابس")] },
    checkout: { requireArea: true },
  },
  {
    code: "BH", name: L("Bahrain", "البحرين"), currency: "BHD", defaultLocale: "ar",
    address: { cityLabel: city.governorate, areaLabel: area.block, postalCode: "hidden" },
    tax: VAT(10), payments: { badges: ["benefit", "visa", "mastercard", "applepay", "cod"], local: [L("BenefitPay", "بنفت باي")] },
    checkout: { requireArea: true },
  },
  {
    code: "OM", name: L("Oman", "عُمان"), currency: "OMR", defaultLocale: "ar",
    address: { cityLabel: city.governorate, areaLabel: area.area, postalCode: "optional", postalPattern: "^\\d{3}$" },
    tax: VAT(5), payments: { badges: ["visa", "mastercard", "cod"], local: [L("OmanNet", "عمان نت")] },
    checkout: { requireArea: true },
  },
  {
    code: "EG", name: L("Egypt", "مصر"), currency: "EGP", defaultLocale: "ar",
    address: { cityLabel: city.governorate, areaLabel: area.district, postalCode: "optional", postalPattern: "^\\d{5}$" },
    tax: VAT(14), payments: { badges: ["visa", "mastercard", "fawry", "cod"], local: [L("Fawry", "فوري"), L("Meeza", "ميزة"), L("Vodafone Cash", "فودافون كاش")] },
    checkout: { requireArea: true },
  },
  {
    code: "IQ", name: L("Iraq", "العراق"), currency: "IQD", defaultLocale: "ar",
    address: { cityLabel: city.governorate, areaLabel: area.district, postalCode: "hidden" },
    tax: NO_TAX, payments: { badges: ["zaincash", "visa", "mastercard", "cod"], local: [L("ZainCash", "زين كاش"), L("Qi Card", "كي كارد")] },
    checkout: { requireArea: true },
  },
  {
    code: "LB", name: L("Lebanon", "لبنان"), currency: "USD", defaultLocale: "ar",
    address: { cityLabel: city.governorate, areaLabel: area.area, postalCode: "hidden" },
    tax: VAT(11), payments: { badges: ["visa", "mastercard", "cod"], local: [L("Cash on delivery", "الدفع عند الاستلام")] },
    checkout: { requireArea: true },
  },
  {
    code: "PS", name: L("Palestine", "فلسطين"), currency: "JOD", defaultLocale: "ar",
    address: { cityLabel: city.governorate, areaLabel: area.area, postalCode: "hidden" },
    tax: { rateBp: 1600, label: L("VAT", "ضريبة القيمة المضافة"), pricesIncludeTax: true }, payments: { badges: ["visa", "mastercard", "cod"], local: [L("Jawwal Pay", "جوال باي")] },
    checkout: { requireArea: true },
  },
  {
    code: "MA", name: L("Morocco", "المغرب"), currency: "MAD", defaultLocale: "ar",
    address: { cityLabel: city.region, areaLabel: area.district, postalCode: "optional", postalPattern: "^\\d{5}$" },
    tax: VAT(20), payments: { badges: ["cmi", "visa", "mastercard", "cod"], local: [L("CMI", "CMI")] },
    checkout: { requireArea: false },
  },
  {
    code: "TN", name: L("Tunisia", "تونس"), currency: "TND", defaultLocale: "ar",
    address: { cityLabel: city.governorate, areaLabel: area.district, postalCode: "optional", postalPattern: "^\\d{4}$" },
    tax: VAT(19), payments: { badges: ["visa", "mastercard", "cod"], local: [L("e-Dinar", "إي دينار")] },
    checkout: { requireArea: false },
  },
  {
    code: "DZ", name: L("Algeria", "الجزائر"), currency: "DZD", defaultLocale: "ar",
    address: { cityLabel: city.wilaya, areaLabel: area.district, postalCode: "optional", postalPattern: "^\\d{5}$" },
    tax: VAT(19), payments: { badges: ["edahabia", "cib", "cod"], local: [L("Edahabia", "الذهبية"), L("CIB", "CIB")] },
    checkout: { requireArea: false },
  },
];

function dial(code: string) {
  try {
    return `+${getCountryCallingCode(code as CountryCode)}`;
  } catch {
    return "";
  }
}

export const COUNTRY_PROFILES: CountryProfile[] = DEFS.map((d) => ({ ...d, dialCode: d.dialCode ?? dial(d.code), timezone: tz[d.code as keyof typeof tz] ?? "UTC" }));
export const PRIMARY_COUNTRIES = COUNTRY_PROFILES.map((c) => c.code);

/** Profile for any ISO country; unknown countries get neutral defaults. */
export function countryProfile(code: string | null | undefined): CountryProfile {
  const cc = (code ?? "").toUpperCase();
  const hit = COUNTRY_PROFILES.find((c) => c.code === cc);
  if (hit) return hit;
  return {
    code: cc || "SA",
    name: L(cc, cc),
    currency: "USD",
    dialCode: dial(cc),
    defaultLocale: "en",
    timezone: "UTC",
    address: { cityLabel: city.city, areaLabel: area.area, postalCode: "optional" },
    tax: NO_TAX,
    payments: { badges: ["visa", "mastercard", "cod"], local: [] },
    checkout: { requireArea: false },
  };
}

export const isSupportedPrimaryCountry = (code: string) => PRIMARY_COUNTRIES.includes(code.toUpperCase());
/** Ready-made governorate list size (0 = none bundled). */
export const countryCityPreset = (code: string) => regionPresetCount(code.toUpperCase());

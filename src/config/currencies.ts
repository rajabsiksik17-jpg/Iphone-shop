/**
 * Currency catalogue: everything the store needs to know about a currency
 * besides its exchange rate (which lives in the database and is refreshed
 * from a rates provider). Used by the seed, the admin "add currency" list,
 * the currency selector and country → currency detection.
 */
export type CurrencyMeta = {
  code: string;
  name: { en: string; ar: string };
  symbol: { en: string; ar: string };
  decimals: number;
  /** Country whose flag represents the currency (EU for the euro). */
  flag: string;
  /** ISO countries where this is the natural shopping currency. */
  countries: string[];
};

export const CURRENCY_CATALOG: CurrencyMeta[] = [
  { code: "SAR", name: { en: "Saudi Riyal", ar: "ريال سعودي" }, symbol: { en: "SAR", ar: "ر.س" }, decimals: 2, flag: "SA", countries: ["SA"] },
  { code: "AED", name: { en: "UAE Dirham", ar: "درهم إماراتي" }, symbol: { en: "AED", ar: "د.إ" }, decimals: 2, flag: "AE", countries: ["AE"] },
  { code: "QAR", name: { en: "Qatari Riyal", ar: "ريال قطري" }, symbol: { en: "QAR", ar: "ر.ق" }, decimals: 2, flag: "QA", countries: ["QA"] },
  { code: "KWD", name: { en: "Kuwaiti Dinar", ar: "دينار كويتي" }, symbol: { en: "KWD", ar: "د.ك" }, decimals: 3, flag: "KW", countries: ["KW"] },
  { code: "BHD", name: { en: "Bahraini Dinar", ar: "دينار بحريني" }, symbol: { en: "BHD", ar: "د.ب" }, decimals: 3, flag: "BH", countries: ["BH"] },
  { code: "OMR", name: { en: "Omani Rial", ar: "ريال عماني" }, symbol: { en: "OMR", ar: "ر.ع" }, decimals: 3, flag: "OM", countries: ["OM"] },
  { code: "JOD", name: { en: "Jordanian Dinar", ar: "دينار أردني" }, symbol: { en: "JOD", ar: "د.أ" }, decimals: 3, flag: "JO", countries: ["JO", "PS"] },
  { code: "EGP", name: { en: "Egyptian Pound", ar: "جنيه مصري" }, symbol: { en: "EGP", ar: "ج.م" }, decimals: 2, flag: "EG", countries: ["EG"] },
  // Fils are not used in practice; prices show whole dinars.
  { code: "IQD", name: { en: "Iraqi Dinar", ar: "دينار عراقي" }, symbol: { en: "IQD", ar: "د.ع" }, decimals: 0, flag: "IQ", countries: ["IQ"] },
  { code: "MAD", name: { en: "Moroccan Dirham", ar: "درهم مغربي" }, symbol: { en: "MAD", ar: "د.م" }, decimals: 2, flag: "MA", countries: ["MA"] },
  { code: "TND", name: { en: "Tunisian Dinar", ar: "دينار تونسي" }, symbol: { en: "TND", ar: "د.ت" }, decimals: 3, flag: "TN", countries: ["TN"] },
  { code: "DZD", name: { en: "Algerian Dinar", ar: "دينار جزائري" }, symbol: { en: "DZD", ar: "د.ج" }, decimals: 2, flag: "DZ", countries: ["DZ"] },
  { code: "TRY", name: { en: "Turkish Lira", ar: "ليرة تركية" }, symbol: { en: "₺", ar: "₺" }, decimals: 2, flag: "TR", countries: ["TR"] },
  { code: "USD", name: { en: "US Dollar", ar: "دولار أمريكي" }, symbol: { en: "$", ar: "$" }, decimals: 2, flag: "US", countries: ["US", "LB", "YE", "SY", "SD", "LY"] },
  {
    code: "EUR",
    name: { en: "Euro", ar: "يورو" },
    symbol: { en: "€", ar: "€" },
    decimals: 2,
    flag: "EU",
    countries: ["DE", "FR", "IT", "ES", "NL", "BE", "AT", "IE", "PT", "FI", "GR", "LU", "SK", "SI", "EE", "LV", "LT", "MT", "CY", "HR"],
  },
  { code: "GBP", name: { en: "British Pound", ar: "جنيه إسترليني" }, symbol: { en: "£", ar: "£" }, decimals: 2, flag: "GB", countries: ["GB"] },
];

export const currencyMeta = (code: string) => CURRENCY_CATALOG.find((c) => c.code === code);

/** Natural currency for a country, if the catalogue has one. */
export function currencyForCountry(country: string | null | undefined): string | null {
  if (!country) return null;
  const cc = country.toUpperCase();
  return CURRENCY_CATALOG.find((c) => c.countries.includes(cc))?.code ?? null;
}

/** 🇸🇦 from "SA" (regional-indicator pair); 🇪🇺 works the same way for "EU". */
export function flagEmoji(country: string | null | undefined) {
  if (!country || !/^[a-z]{2}$/i.test(country)) return "";
  return String.fromCodePoint(...[...country.toUpperCase()].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65));
}

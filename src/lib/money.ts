/**
 * Money is integer minor units of the store's base currency. Formatting can
 * convert to a display currency using its rate relative to the base.
 */
export type CurrencyFormat = {
  code: string;
  symbol: string;
  decimals: number;
  symbolPosition: "BEFORE" | "AFTER";
  thousandsSep: string;
  decimalSep: string;
  rate: number;
  /** Render digits as Arabic-Indic (٠١٢٣…) — Settings → Languages & region. */
  arabicDigits?: boolean;
};

export type MoneyContext = {
  base: { code: string; decimals: number };
  display: CurrencyFormat;
};

export function toMinor(amount: number, decimals: number): number {
  return Math.round(amount * 10 ** decimals);
}

export function fromMinor(minor: number, decimals: number): number {
  return minor / 10 ** decimals;
}

function group(intPart: string, sep: string) {
  return intPart.replace(/\B(?=(\d{3})+(?!\d))/g, sep);
}

/** Format a base-currency minor amount in the display currency. */
export function formatMoney(minor: number, ctx: MoneyContext, opts: { trimZeros?: boolean } = {}): string {
  const { display, base } = ctx;
  const major = fromMinor(minor, base.decimals) * (display.code === base.code ? 1 : display.rate);
  const negative = major < 0;
  let fixed = Math.abs(major).toFixed(display.decimals);
  if (opts.trimZeros && /\.0+$/.test(fixed)) fixed = fixed.replace(/\.0+$/, "");
  const [i, d] = fixed.split(".");
  const num = group(i, display.thousandsSep) + (d ? display.decimalSep + d : "");
  const digits = display.arabicDigits ? num.replace(/\d/g, (d) => "٠١٢٣٤٥٦٧٨٩"[Number(d)]) : num;
  const out = display.symbolPosition === "BEFORE" ? `${display.symbol}${digits}` : `${digits} ${display.symbol}`;
  return negative ? `-${out}` : out;
}

/** Percentage saved, rounded down so we never over-promise. */
export function discountPercent(regular: number, sale: number): number {
  if (!regular || sale >= regular) return 0;
  return Math.floor(((regular - sale) / regular) * 100);
}

/** Convert user-entered major amount string (e.g. "349.500") to minor units. */
export function parseMajor(input: string | number, decimals: number): number | null {
  const s = String(input).trim().replace(/,/g, "");
  if (!/^-?\d+(\.\d+)?$/.test(s)) return null;
  return toMinor(Number(s), decimals);
}

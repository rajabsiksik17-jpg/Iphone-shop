import "server-only";
import { cache } from "react";
import { db } from "../db";
import { t } from "@/lib/i18n-text";
import { getSettings } from "../settings/service";
import { formatMoney, type CurrencyFormat, type MoneyContext } from "@/lib/money";

type Row = Awaited<ReturnType<typeof db.currency.findMany>>[number];

const g = globalThis as unknown as { __currencies?: { rows: Row[]; at: number } };

async function rows() {
  if (g.__currencies && Date.now() - g.__currencies.at < 60_000) return g.__currencies.rows;
  const list = await db.currency.findMany({ orderBy: { position: "asc" } });
  g.__currencies = { rows: list, at: Date.now() };
  return list;
}

export function invalidateCurrencies() {
  g.__currencies = undefined;
}

function toFormat(row: Row, locale: string): CurrencyFormat {
  return {
    code: row.code,
    symbol: t(row.symbol, locale, row.code),
    decimals: row.decimals,
    symbolPosition: row.symbolPosition,
    thousandsSep: row.thousandsSep,
    decimalSep: row.decimalSep,
    rate: row.rate,
  };
}

// Used only if the currency table is empty (fresh install before seeding).
const FALLBACK: Row = {
  code: "SAR",
  name: { en: "Saudi Riyal", ar: "ريال سعودي" },
  symbol: { en: "SAR", ar: "ر.س" },
  decimals: 2,
  symbolPosition: "AFTER",
  thousandsSep: ",",
  decimalSep: ".",
  rate: 1,
  isBase: true,
  isActive: true,
  position: 0,
  autoRate: false,
  rateUpdatedAt: null,
  flag: "SA",
};

export async function baseCurrency() {
  const list = await rows();
  return list.find((r) => r.isBase) ?? FALLBACK;
}

export async function activeCurrencies() {
  return (await rows()).filter((r) => r.isActive);
}

/**
 * Currencies shoppers may switch to: active ones, narrowed to the list in
 * Settings → Languages & region when it is set. The base is always included.
 */
export async function switchableCurrencies() {
  const [list, { displayCurrencies }] = await Promise.all([activeCurrencies(), getSettings("localization")]);
  if (!displayCurrencies.length) return list;
  return list.filter((r) => r.isBase || displayCurrencies.includes(r.code));
}

/** Money formatting context for a locale and (optional) display currency. */
export const moneyContext = cache(async (locale: string, displayCode?: string | null): Promise<MoneyContext> => {
  const [list, allowed, l10n] = await Promise.all([rows(), switchableCurrencies(), getSettings("localization")]);
  const base = list.find((r) => r.isBase) ?? FALLBACK;
  const display = (displayCode && allowed.find((r) => r.code === displayCode)) || base;
  return { base: { code: base.code, decimals: base.decimals }, display: { ...toFormat(display, locale), arabicDigits: locale === "ar" && l10n.useArabicDigits } };
});

export async function formatBase(minor: number, locale: string) {
  return formatMoney(minor, await moneyContext(locale), { trimZeros: true });
}

/** Convert base minor units into another currency's minor units (for gateways). */
export async function converter() {
  const list = await rows();
  const base = list.find((r) => r.isBase) ?? FALLBACK;
  return (minor: number, to: string) => {
    const target = list.find((r) => r.code === to.toUpperCase());
    if (!target || target.code === base.code) return { amount: minor, decimals: base.decimals };
    const major = (minor / 10 ** base.decimals) * target.rate;
    return { amount: Math.round(major * 10 ** target.decimals), decimals: target.decimals };
  };
}

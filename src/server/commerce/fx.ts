import "server-only";
import { db } from "../db";
import { logger, errorMessage } from "../logger";
import { emit } from "../events";
import { getSettings, patchSettings } from "../settings/service";
import { invalidateCurrencies } from "./currency";

/**
 * Exchange rates.
 *
 * Source of truth: every price is stored in the base currency (minor units).
 * Other currencies are display conversions using `Currency.rate` (units per
 * 1 base). Rates come from a public provider and are refreshed on a schedule;
 * an admin can pin a manual rate per currency (autoRate = false).
 *
 * Failure behaviour: if the provider is unreachable or returns bad data we
 * keep the last valid rates (the store never shows broken prices), record the
 * error for the admin, and alert once rates are older than 48 hours.
 * Orders record the display currency and rate used at purchase time, so later
 * rate changes never alter historical orders.
 */

const PROVIDER = (base: string) => `https://open.er-api.com/v6/latest/${encodeURIComponent(base)}`;
const STALE_ALERT_MS = 48 * 3_600_000;
const RETRY_AFTER_FAILURE_MS = 30 * 60_000;

export type FxResult = { ok: boolean; updated: number; message: string };

export async function refreshRates(opts: { force?: boolean } = {}): Promise<FxResult> {
  const fx = await getSettings("fx");
  const now = Date.now();
  if (!opts.force) {
    if (!fx.autoUpdate) return { ok: true, updated: 0, message: "auto-update off" };
    const last = fx.lastSuccessAt ? Date.parse(fx.lastSuccessAt) : 0;
    const attempted = fx.lastAttemptAt ? Date.parse(fx.lastAttemptAt) : 0;
    if (now - last < fx.intervalHours * 3_600_000) return { ok: true, updated: 0, message: "fresh" };
    if (fx.lastError && now - attempted < RETRY_AFTER_FAILURE_MS) return { ok: false, updated: 0, message: "backing off" };
  }

  const currencies = await db.currency.findMany();
  const base = currencies.find((c) => c.isBase);
  if (!base) return { ok: false, updated: 0, message: "no base currency" };
  const attemptAt = new Date().toISOString();

  try {
    const res = await fetch(PROVIDER(base.code), { signal: AbortSignal.timeout(10_000), headers: { Accept: "application/json" } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const body = (await res.json()) as { result?: string; base_code?: string; rates?: Record<string, number> };
    if (body.result !== "success" || body.base_code !== base.code || !body.rates) throw new Error("Unexpected response from rates provider");

    let updated = 0;
    const stamp = new Date();
    for (const c of currencies) {
      if (c.isBase || !c.autoRate) continue;
      const r = body.rates[c.code];
      // Reject nonsense values instead of publishing them as prices.
      if (typeof r !== "number" || !Number.isFinite(r) || r <= 0) continue;
      // Guard against a corrupt feed — only for rates that already came from the
      // provider (placeholders and admin-entered rates may legitimately differ).
      if (c.rateUpdatedAt && c.rate > 0 && (r / c.rate > 5 || c.rate / r > 5)) {
        logger.warn("fx", `Ignoring suspicious ${c.code} rate change`, { from: c.rate, to: r });
        continue;
      }
      await db.currency.update({ where: { code: c.code }, data: { rate: r, rateUpdatedAt: stamp } });
      updated++;
    }
    await db.currency.update({ where: { code: base.code }, data: { rate: 1, rateUpdatedAt: stamp } });
    invalidateCurrencies();
    await patchSettings("fx", { lastAttemptAt: attemptAt, lastSuccessAt: stamp.toISOString(), lastError: null });
    return { ok: true, updated, message: `Updated ${updated} rates` };
  } catch (e) {
    const message = errorMessage(e).slice(0, 300);
    await patchSettings("fx", { lastAttemptAt: attemptAt, lastError: message });
    logger.warn("fx", "Exchange-rate refresh failed; keeping last valid rates", { message });
    const lastOk = fx.lastSuccessAt ? Date.parse(fx.lastSuccessAt) : 0;
    // One alert when rates become stale (not on every retry).
    if (lastOk && now - lastOk > STALE_ALERT_MS && (!fx.lastError || !fx.lastAttemptAt || Date.parse(fx.lastAttemptAt) - lastOk <= STALE_ALERT_MS)) {
      emit("INTEGRATION_FAILED", { key: "exchange_rates", message: `Exchange rates not updated since ${new Date(lastOk).toISOString()}: ${message}` });
    }
    return { ok: false, updated: 0, message };
  }
}

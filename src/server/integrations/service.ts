import "server-only";
import { db } from "../db";
import { decryptJson, encryptJson } from "../crypto";
import { emit } from "../events";
import { logger, errorMessage } from "../logger";
import { getDefinition, INTEGRATIONS, secretKeysOf } from "./registry";
import type { IntegrationContext, TestResult } from "./types";
import { SECRET_UNCHANGED } from "../settings/service";

export async function loadContext(key: string): Promise<(IntegrationContext & { isEnabled: boolean; status: string }) | null> {
  const row = await db.integration.findUnique({ where: { key } });
  if (!row) return null;
  return {
    config: (row.config as Record<string, unknown>) ?? {},
    secrets: decryptJson<Record<string, string>>(row.secrets) ?? {},
    mode: row.mode === "live" ? "live" : "test",
    isEnabled: row.isEnabled,
    status: row.status,
  };
}

/** Enabled + connected integration context, or null. */
export async function activeIntegration(key: string) {
  const ctx = await loadContext(key);
  return ctx && ctx.isEnabled ? ctx : null;
}

/** Admin listing: definitions merged with stored state. Secrets are reduced to "is set" flags. */
export async function listIntegrations() {
  const rows = await db.integration.findMany();
  const byKey = new Map(rows.map((r) => [r.key, r]));
  return INTEGRATIONS.map((def) => {
    const row = byKey.get(def.key);
    const secrets = decryptJson<Record<string, string>>(row?.secrets) ?? {};
    return {
      key: def.key,
      category: def.category,
      name: def.name,
      description: def.description,
      icon: def.icon,
      docsUrl: def.docsUrl,
      availability: def.availability,
      supportsModes: Boolean(def.supportsModes),
      fields: def.fields,
      canSync: Boolean(def.sync),
      isEnabled: row?.isEnabled ?? false,
      mode: row?.mode ?? "test",
      status: row?.status ?? "NOT_CONFIGURED",
      config: (row?.config as Record<string, unknown>) ?? {},
      secretsSet: Object.fromEntries(secretKeysOf(def).map((k) => [k, Boolean(secrets[k])])),
      lastCheckedAt: row?.lastCheckedAt?.toISOString() ?? null,
      lastError: row?.lastError ?? null,
      lastSyncAt: row?.lastSyncAt?.toISOString() ?? null,
      position: row?.position ?? 0,
    };
  });
}

export type IntegrationListItem = Awaited<ReturnType<typeof listIntegrations>>[number];

export async function saveIntegration(
  key: string,
  input: { isEnabled: boolean; mode?: string; config: Record<string, unknown>; secrets: Record<string, string>; clearSecrets?: string[] },
) {
  const def = getDefinition(key);
  if (!def) throw new Error("Unknown integration");
  if (def.availability !== "available") throw new Error("This integration is not available yet");
  const current = await loadContext(key);
  const secretKeys = secretKeysOf(def);
  const secrets: Record<string, string> = { ...(current?.secrets ?? {}) };
  for (const k of secretKeys) {
    const v = input.secrets[k];
    if (input.clearSecrets?.includes(k)) delete secrets[k];
    else if (typeof v === "string" && v.trim() && v !== SECRET_UNCHANGED) secrets[k] = v.trim();
  }
  // Only persist known, non-secret config keys.
  const allowed = def.fields.filter((f) => !secretKeys.includes(f.key)).map((f) => f.key);
  const config = Object.fromEntries(Object.entries(input.config).filter(([k]) => allowed.includes(k)));
  const missingRequired = def.fields.filter((f) => f.required && (!f.mode || f.mode === (input.mode ?? "test"))).filter((f) => (secretKeys.includes(f.key) ? !secrets[f.key] : !config[f.key]));

  const row = await db.integration.upsert({
    where: { key },
    create: {
      key,
      category: def.category,
      isEnabled: input.isEnabled,
      mode: input.mode === "live" ? "live" : "test",
      config: config as object,
      secrets: encryptJson(secrets),
      status: input.isEnabled ? (missingRequired.length ? "ERROR" : "NOT_CONFIGURED") : "DISABLED",
      lastError: missingRequired.length ? `Missing: ${missingRequired.map((f) => f.key).join(", ")}` : null,
    },
    update: {
      isEnabled: input.isEnabled,
      mode: input.mode === "live" ? "live" : "test",
      config: config as object,
      secrets: encryptJson(secrets),
      status: input.isEnabled ? (missingRequired.length ? "ERROR" : current?.status === "CONNECTED" ? "CONNECTED" : "NOT_CONFIGURED") : "DISABLED",
      lastError: missingRequired.length ? `Missing: ${missingRequired.map((f) => f.key).join(", ")}` : null,
    },
  });
  return row;
}

export async function testIntegration(key: string): Promise<TestResult> {
  const def = getDefinition(key);
  if (!def?.test) return { ok: false, message: "This integration has no connection test." };
  const ctx = await loadContext(key);
  if (!ctx) return { ok: false, message: "Save the configuration first." };
  let result: TestResult;
  try {
    result = await def.test(ctx);
  } catch (e) {
    result = { ok: false, message: errorMessage(e) };
  }
  await db.integration.update({
    where: { key },
    data: {
      lastCheckedAt: new Date(),
      lastError: result.ok ? null : result.message.slice(0, 1000),
      status: !ctx.isEnabled ? "DISABLED" : result.ok ? "CONNECTED" : "ERROR",
    },
  });
  if (!result.ok) {
    logger.warn("integrations", `Connection test failed for ${key}`, { message: result.message });
    if (ctx.isEnabled) emit("INTEGRATION_FAILED", { key, message: result.message });
  }
  return result;
}

export async function syncIntegration(key: string) {
  const def = getDefinition(key);
  if (!def?.sync) return { ok: false, message: "Sync not supported." };
  const ctx = await activeIntegration(key);
  if (!ctx) return { ok: false, message: "Enable and configure the integration first." };
  const result = await def.sync(ctx).catch((e) => ({ ok: false, message: errorMessage(e), data: undefined }));
  await db.integration.update({
    where: { key },
    data: result.ok
      ? { lastSyncAt: new Date(), syncData: (result.data ?? {}) as object, lastError: null, status: "CONNECTED" }
      : { lastError: result.message.slice(0, 1000), status: "ERROR" },
  });
  if (!result.ok) emit("INTEGRATION_FAILED", { key, message: result.message });
  return result;
}

/** Public, non-secret values for the storefront (tracking IDs, verification tokens). */
export async function publicIntegrationConfig() {
  const rows = await db.integration.findMany({ where: { isEnabled: true } });
  const out: Record<string, Record<string, unknown>> = {};
  for (const row of rows) {
    const def = getDefinition(row.key);
    if (!def?.publicKeys) continue;
    const config = row.config as Record<string, unknown>;
    out[row.key] = Object.fromEntries(def.publicKeys.map((k) => [k, config[k]]));
  }
  return out;
}

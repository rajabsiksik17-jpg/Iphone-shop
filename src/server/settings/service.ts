import "server-only";
import { db } from "../db";
import { decrypt, encrypt } from "../crypto";
import { SECRET_FIELDS, settingsSchemas, type Settings, type SettingsGroup } from "./schemas";

/** Sentinel the admin UI sends back for a secret it didn't change. */
export const SECRET_UNCHANGED = "__unchanged__";
const ENC_PREFIX = "enc:";

type Cache = Map<SettingsGroup, { value: unknown; at: number }>;
const g = globalThis as unknown as { __settingsCache?: Cache };
const cache: Cache = (g.__settingsCache ??= new Map());
const TTL = 30_000;

function getPath(obj: Record<string, unknown>, path: string): unknown {
  return path.split(".").reduce<unknown>((o, k) => (o && typeof o === "object" ? (o as Record<string, unknown>)[k] : undefined), obj);
}

function setPath(obj: Record<string, unknown>, path: string, value: unknown) {
  const keys = path.split(".");
  let cur = obj;
  for (const k of keys.slice(0, -1)) {
    if (!cur[k] || typeof cur[k] !== "object") cur[k] = {};
    cur = cur[k] as Record<string, unknown>;
  }
  cur[keys[keys.length - 1]] = value;
}

function decryptSecrets(group: SettingsGroup, raw: Record<string, unknown>) {
  for (const path of SECRET_FIELDS[group] ?? []) {
    const v = getPath(raw, path);
    if (typeof v === "string" && v.startsWith(ENC_PREFIX)) {
      try {
        setPath(raw, path, decrypt(v.slice(ENC_PREFIX.length)));
      } catch {
        setPath(raw, path, "");
      }
    }
  }
  return raw;
}

/** Server-side read, secrets decrypted. Never pass the result to the client as-is. */
export async function getSettings<G extends SettingsGroup>(group: G): Promise<Settings<G>> {
  const hit = cache.get(group);
  if (hit && Date.now() - hit.at < TTL) return hit.value as Settings<G>;
  const row = await db.setting.findUnique({ where: { key: group } });
  const raw = decryptSecrets(group, structuredClone((row?.value as Record<string, unknown>) ?? {}));
  const parsed = settingsSchemas[group].safeParse(raw);
  // Corrupt/legacy data falls back to defaults rather than breaking the store.
  const value = (parsed.success ? parsed.data : settingsSchemas[group].parse({})) as Settings<G>;
  cache.set(group, { value, at: Date.now() });
  return value;
}

export async function getManySettings<G extends SettingsGroup>(groups: G[]): Promise<{ [K in G]: Settings<K> }> {
  const entries = await Promise.all(groups.map(async (gr) => [gr, await getSettings(gr)] as const));
  return Object.fromEntries(entries) as { [K in G]: Settings<K> };
}

/** For the admin UI: secrets replaced by a mask that says whether one is set. */
export async function getSettingsForAdmin<G extends SettingsGroup>(group: G) {
  const value = structuredClone(await getSettings(group)) as Record<string, unknown>;
  const secrets: Record<string, boolean> = {};
  for (const path of SECRET_FIELDS[group] ?? []) {
    secrets[path] = Boolean(getPath(value, path));
    setPath(value, path, "");
  }
  return { value: value as Settings<G>, secrets };
}

/**
 * Validate and persist a settings group. Secret fields left as "" or the
 * unchanged sentinel keep their stored value; anything else is encrypted.
 */
export async function saveSettings<G extends SettingsGroup>(
  group: G,
  input: unknown,
  opts: { userId?: string; clearSecrets?: string[] } = {},
): Promise<Settings<G>> {
  const current = await getSettings(group);
  const merged = structuredClone(input) as Record<string, unknown>;
  for (const path of SECRET_FIELDS[group] ?? []) {
    const incoming = getPath(merged, path);
    if (opts.clearSecrets?.includes(path)) setPath(merged, path, "");
    else if (incoming === undefined || incoming === "" || incoming === SECRET_UNCHANGED)
      setPath(merged, path, getPath(current as Record<string, unknown>, path) ?? "");
  }
  const parsed = settingsSchemas[group].parse(merged) as Settings<G>;

  const toStore = structuredClone(parsed) as Record<string, unknown>;
  for (const path of SECRET_FIELDS[group] ?? []) {
    const v = getPath(toStore, path);
    if (typeof v === "string" && v) setPath(toStore, path, ENC_PREFIX + encrypt(v));
  }
  await db.setting.upsert({
    where: { key: group },
    create: { key: group, value: toStore as object, updatedById: opts.userId },
    update: { value: toStore as object, updatedById: opts.userId },
  });
  cache.delete(group);
  return parsed;
}

/** Shallow-merge a partial update into a group (server-side use). */
export async function patchSettings<G extends SettingsGroup>(group: G, patch: Partial<Settings<G>>) {
  const current = await getSettings(group);
  return saveSettings(group, { ...current, ...patch });
}

export function invalidateSettings(group?: SettingsGroup) {
  if (group) cache.delete(group);
  else cache.clear();
}

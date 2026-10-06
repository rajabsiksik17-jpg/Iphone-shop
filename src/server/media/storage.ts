import "server-only";
import fs from "node:fs/promises";
import path from "node:path";
import { env } from "../env";

/**
 * Storage driver abstraction: local disk (default) or Supabase Storage.
 * Callers only see put/read/remove plus publicUrl().
 */
export interface StorageDriver {
  put(key: string, data: Buffer, contentType: string): Promise<void>;
  read(key: string): Promise<Buffer | null>;
  remove(key: string): Promise<void>;
}

const SAFE_KEY = /^[a-z0-9][a-z0-9/_.-]{0,200}$/i;

export function assertSafeKey(key: string) {
  if (!SAFE_KEY.test(key) || key.includes("..") || key.includes("//")) throw new Error("Invalid storage key");
}

class LocalDriver implements StorageDriver {
  private root = path.resolve(env().STORAGE_DIR);

  private resolve(key: string) {
    assertSafeKey(key);
    const full = path.resolve(this.root, key);
    // Defence in depth against traversal even after the regex.
    if (!full.startsWith(this.root + path.sep)) throw new Error("Invalid storage key");
    return full;
  }

  async put(key: string, data: Buffer) {
    const full = this.resolve(key);
    await fs.mkdir(path.dirname(full), { recursive: true });
    await fs.writeFile(full, data);
  }

  async read(key: string) {
    try {
      return await fs.readFile(this.resolve(key));
    } catch {
      return null;
    }
  }

  async remove(key: string) {
    await fs.rm(this.resolve(key), { force: true });
  }
}

/**
 * Supabase Storage over its REST API with the service-role key — server-side
 * only, so the key never reaches a browser. The bucket should be public-read
 * (media are product images); writes are possible only through this server.
 */
class SupabaseDriver implements StorageDriver {
  private base: string;
  private bucket: string;
  private headers: Record<string, string>;

  constructor() {
    const e = env();
    this.base = `${e.SUPABASE_URL!.replace(/\/$/, "")}/storage/v1`;
    this.bucket = e.SUPABASE_STORAGE_BUCKET;
    const key = e.SUPABASE_SERVICE_ROLE_KEY!;
    // New-style secret keys (sb_secret_…) aren't JWTs: send them only as `apikey`
    // and the gateway authorises the request. Legacy service_role JWTs also go as Bearer.
    this.headers = key.startsWith("sb_secret_") ? { apikey: key } : { Authorization: `Bearer ${key}`, apikey: key };
  }

  private url(key: string) {
    assertSafeKey(key);
    return `${this.base}/object/${this.bucket}/${key.split("/").map(encodeURIComponent).join("/")}`;
  }

  async put(key: string, data: Buffer, contentType: string) {
    const res = await fetch(this.url(key), {
      method: "POST",
      headers: { ...this.headers, "Content-Type": contentType, "x-upsert": "true", "Cache-Control": "max-age=31536000" },
      body: new Uint8Array(data),
    });
    if (!res.ok) throw new Error(`Supabase upload failed (${res.status}): ${(await res.text()).slice(0, 200)}`);
  }

  async read(key: string) {
    const res = await fetch(this.url(key), { headers: this.headers });
    return res.ok ? Buffer.from(await res.arrayBuffer()) : null;
  }

  async remove(key: string) {
    assertSafeKey(key);
    const res = await fetch(`${this.base}/object/${this.bucket}`, { method: "DELETE", headers: { ...this.headers, "Content-Type": "application/json" }, body: JSON.stringify({ prefixes: [key] }) });
    if (!res.ok && res.status !== 404) throw new Error(`Supabase delete failed (${res.status})`);
  }
}

let driver: StorageDriver | undefined;
export const storage = (): StorageDriver => (driver ??= env().STORAGE_DRIVER === "supabase" ? new SupabaseDriver() : new LocalDriver());

/** Public URL for a stored object: Supabase's CDN, or the app's /media route. */
export function publicUrl(key: string) {
  const e = env();
  if (e.STORAGE_DRIVER === "supabase") return `${e.SUPABASE_URL!.replace(/\/$/, "")}/storage/v1/object/public/${e.SUPABASE_STORAGE_BUCKET}/${key}`;
  return `/media/${key}`;
}

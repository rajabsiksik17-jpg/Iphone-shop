import "server-only";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";

// One client per generated PrismaClient class. Several module graphs share
// globalThis in development (the custom server loaded by tsx plus Next's own
// server bundles), each with its own class identity, so clients are keyed by
// class and never torn down here: disconnecting one graph's client from
// another breaks its in-flight queries ("Cannot use a pool after calling end").
// After `prisma generate` the new class simply gets a fresh client.
const globalForPrisma = globalThis as unknown as { __prismaClients?: Map<unknown, PrismaClient> };

function create() {
  // DATABASE_URL is the runtime connection (on Supabase: the pooled URL, port 6543).
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
  return new PrismaClient({ adapter });
}

/**
 * Development only: hot reloads re-evaluate the generated client, so every
 * edit can add a client (and a connection pool) that nothing uses any more;
 * after a few hours that exhausts the heap. Keep the first two (the
 * long-lived custom-server and Next graphs) and the newest four, and close
 * the rest after a grace period so any in-flight query can finish.
 */
const KEEP_FIRST = 2;
const KEEP_LATEST = 4;
function retireStaleClients(clients: Map<unknown, PrismaClient>) {
  const entries = [...clients.entries()];
  if (entries.length <= KEEP_FIRST + KEEP_LATEST) return;
  for (const [key, c] of entries.slice(KEEP_FIRST, entries.length - KEEP_LATEST)) {
    clients.delete(key);
    setTimeout(() => void c.$disconnect().catch(() => null), 120_000).unref?.();
  }
}

function client() {
  const clients = (globalForPrisma.__prismaClients ??= new Map());
  let c = clients.get(PrismaClient);
  if (!c) {
    c = create();
    clients.set(PrismaClient, c);
    if (process.env.NODE_ENV !== "production" && clients.size > 1) {
      // Each module graph legitimately has one; a growing count means a leak.
      console.warn(`[db] Prisma clients in this process: ${clients.size}`);
      retireStaleClients(clients);
    }
  }
  return c;
}

// ───────────────────────────── Store-type profiles ─────────────────────────────
//
// Catalog and homepage rows carry the store-type profile they belong to
// (null = shared by every type). Every query on these models — storefront and
// admin alike — is limited to the active profile plus shared rows, and new rows
// are filed under the active profile. Switching store type therefore never
// copies, overwrites or deletes anything: it changes which rows are in scope.
// Nested includes (an order's product, a cart line's product) are not filtered,
// so history always resolves.

/** Models whose rows belong to a store-type profile. */
export const PROFILE_MODELS = ["Product", "Category", "Brand", "Slider", "PageSection"] as const;
const SCOPED = new Set<string>(PROFILE_MODELS);
const FILTERED_OPS = new Set(["findUnique", "findUniqueOrThrow", "findFirst", "findFirstOrThrow", "findMany", "count", "aggregate", "groupBy", "update", "updateMany", "updateManyAndReturn", "delete", "deleteMany", "upsert"]);
const CREATE_OPS = new Set(["create", "createMany", "createManyAndReturn"]);

// State lives on globalThis: shared by every module graph (custom server + Next bundles), so a switch is seen everywhere at once.
const PROFILE_TTL = 10_000;

/** Active store-type profile (cached briefly; refreshed immediately after a switch). */
export async function activeProfile(): Promise<string> {
  const g = globalThis as unknown as { __nqProfile?: { key: string; at: number } | null };
  const hit = g.__nqProfile;
  if (hit && Date.now() - hit.at < PROFILE_TTL) return hit.key;
  const row = await client().setting.findUnique({ where: { key: "storeType" }, select: { value: true } });
  const key = ((row?.value as { type?: unknown } | null)?.type as string | undefined) || "electronics";
  g.__nqProfile = { key, at: Date.now() };
  return key;
}

/** Called after the active store type changes. */
export function setActiveProfileCache(key: string | null) {
  (globalThis as unknown as { __nqProfile?: { key: string; at: number } | null }).__nqProfile = key ? { key, at: Date.now() } : null;
}

type Where = Record<string, unknown> | undefined;
/** Adds "this profile or shared" unless the caller filters by profile explicitly. */
export function scopeWhere(where: Where, key: string): Record<string, unknown> {
  if (where && Object.prototype.hasOwnProperty.call(where, "profile")) return where;
  const scope = { OR: [{ profile: key }, { profile: null }] };
  if (!where) return { AND: [scope] };
  const and = where.AND ? (Array.isArray(where.AND) ? where.AND : [where.AND]) : [];
  return { ...where, AND: [...and, scope] };
}

const withProfile = <T extends Record<string, unknown>>(data: T, key: string) => (data && data.profile === undefined ? { ...data, profile: key } : data);

function scoped(base: PrismaClient): PrismaClient {
  return base.$extends({
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          if (!SCOPED.has(model)) return query(args);
          const key = await activeProfile();
          const a = (args ?? {}) as Record<string, unknown>;
          if (FILTERED_OPS.has(operation)) {
            const next: Record<string, unknown> = { ...a, where: scopeWhere(a.where as Where, key) };
            if (operation === "upsert") next.create = withProfile(a.create as Record<string, unknown>, key);
            return query(next as typeof args);
          }
          if (CREATE_OPS.has(operation)) {
            const data = a.data as Record<string, unknown> | Record<string, unknown>[];
            return query({ ...a, data: Array.isArray(data) ? data.map((d) => withProfile(d, key)) : withProfile(data, key) } as typeof args);
          }
          return query(args);
        },
      },
    },
  }) as unknown as PrismaClient;
}

/**
 * Spread into a `where` to reach a row whatever profile it belongs to — for
 * bookkeeping that follows existing orders/stock (restocks, sales counters,
 * ratings, scheduled prices), never for listing what shoppers see.
 */
export const ANY_PROFILE = { profile: undefined } as const;

/**
 * Filter for nested relation includes (e.g. a page's sections), which the
 * query extension can't see: `include: { sections: { where: await inProfile() } }`.
 */
export async function inProfile() {
  return { OR: [{ profile: await activeProfile() }, { profile: null }] };
}

/** Unscoped client: every profile at once. Only for profile management, templates, reports and migrations. */
export const dbAll: PrismaClient = client();
/** The application client: catalog/homepage queries are limited to the active store-type profile. */
export const db: PrismaClient = scoped(dbAll);

export type Tx = Parameters<Parameters<PrismaClient["$transaction"]>[0]>[0];
export { Prisma } from "@/generated/prisma/client";

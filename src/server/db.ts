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

export const db: PrismaClient = client();

export type Tx = Parameters<Parameters<PrismaClient["$transaction"]>[0]>[0];
export { Prisma } from "@/generated/prisma/client";

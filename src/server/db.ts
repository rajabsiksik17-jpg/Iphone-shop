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

function client() {
  const clients = (globalForPrisma.__prismaClients ??= new Map());
  let c = clients.get(PrismaClient);
  if (!c) {
    c = create();
    clients.set(PrismaClient, c);
    if (process.env.NODE_ENV !== "production" && clients.size > 1) {
      // Each module graph legitimately has one; a growing count means a leak.
      console.warn(`[db] Prisma clients in this process: ${clients.size}`);
    }
  }
  return c;
}

export const db: PrismaClient = client();

export type Tx = Parameters<Parameters<PrismaClient["$transaction"]>[0]>[0];
export { Prisma } from "@/generated/prisma/client";

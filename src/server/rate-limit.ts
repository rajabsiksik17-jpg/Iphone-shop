import "server-only";

/**
 * Sliding-window rate limiter held in process memory. Suitable for a single
 * Node instance (the default deployment). For horizontal scaling, swap the
 * store for Redis behind the same interface.
 */
type Bucket = { hits: number[] };
const g = globalThis as unknown as { __rl?: Map<string, Bucket>; __rlGc?: NodeJS.Timeout };
const store: Map<string, Bucket> = (g.__rl ??= new Map<string, Bucket>());

export type RateLimitResult = { ok: boolean; remaining: number; retryAfterSec: number };

export function rateLimit(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now();
  const bucket = store.get(key) ?? { hits: [] };
  bucket.hits = bucket.hits.filter((t) => now - t < windowMs);
  if (bucket.hits.length >= limit) {
    store.set(key, bucket);
    return { ok: false, remaining: 0, retryAfterSec: Math.ceil((windowMs - (now - bucket.hits[0])) / 1000) };
  }
  bucket.hits.push(now);
  store.set(key, bucket);
  return { ok: true, remaining: limit - bucket.hits.length, retryAfterSec: 0 };
}

// Periodic cleanup so the map can't grow unbounded.
g.__rlGc ??= setInterval(() => {
  const now = Date.now();
  for (const [k, b] of store) if (!b.hits.some((t) => now - t < 3_600_000)) store.delete(k);
}, 600_000).unref();

/** Presets: [max hits, window ms] per key. */
export const limits = {
  login: [10, 15 * 60_000],
  otpVerify: [10, 10 * 60_000],
  otpResend: [3, 10 * 60_000],
  passwordReset: [5, 60 * 60_000],
  register: [5, 60 * 60_000],
  contact: [5, 60 * 60_000],
  review: [5, 60 * 60_000],
  reviewReport: [10, 60 * 60_000],
  chatStart: [5, 60 * 60_000],
  chatMessage: [30, 60_000],
  search: [120, 60_000],
  cart: [120, 60_000],
  checkout: [10, 10 * 60_000],
  newsletter: [5, 60 * 60_000],
  upload: [60, 10 * 60_000],
  adminTest: [20, 10 * 60_000],
  analytics: [300, 60_000],
} as const satisfies Record<string, readonly [number, number]>;

export function limitBy(name: keyof typeof limits, id: string) {
  const [n, w] = limits[name];
  return rateLimit(`${name}:${id}`, n, w);
}

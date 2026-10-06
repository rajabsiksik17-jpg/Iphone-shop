import "server-only";
import { logger } from "../logger";

/**
 * Domain events. Business code emits facts ("an order was created"); side
 * effects (notifications, emails, realtime pushes, analytics) subscribe.
 * Adding a channel or reaction never touches the code that emits.
 */
export type DomainEvents = {
  ORDER_CREATED: { orderId: string };
  ORDER_PAID: { orderId: string };
  ORDER_STATUS_CHANGED: { orderId: string; from: string | null; to: string; notifyCustomer: boolean; actorId?: string };
  PAYMENT_FAILED: { orderId: string; provider: string; message: string };
  USER_REGISTERED: { userId: string };
  REVIEW_CREATED: { reviewId: string };
  PRODUCT_LOW_STOCK: { productId: string; variantId?: string | null; stock: number };
  PRODUCT_OUT_OF_STOCK: { productId: string; variantId?: string | null };
  STOCK_CHANGED: { productId: string };
  CONTACT_SUBMITTED: { submissionId: string };
  CHAT_STARTED: { conversationId: string };
  CHAT_ACCEPTED: { conversationId: string; agentId: string };
  CHAT_MESSAGE: { conversationId: string; messageId: string };
  CHAT_CLOSED: { conversationId: string };
  ADMIN_LOGIN: { userId: string; ip: string | null; userAgent: string | null };
  ADMIN_LOGIN_FAILED: { email: string; ip: string | null; reason: string };
  INTEGRATION_FAILED: { key: string; message: string };
};

export type EventName = keyof DomainEvents;
type Handler<E extends EventName> = (payload: DomainEvents[E]) => Promise<void> | void;

type Registry = { handlers: Map<EventName, Set<Handler<EventName>>> };
const g = globalThis as unknown as { __eventBus?: Registry };
const registry: Registry = (g.__eventBus ??= { handlers: new Map() });

export function on<E extends EventName>(event: E, handler: Handler<E>) {
  const set = registry.handlers.get(event) ?? new Set();
  set.add(handler as Handler<EventName>);
  registry.handlers.set(event, set);
}

/**
 * Fire-and-forget: handlers run after the current tick so the request that
 * emitted (e.g. checkout) is never slowed down or failed by a side effect.
 */
export function emit<E extends EventName>(event: E, payload: DomainEvents[E]) {
  const set = registry.handlers.get(event);
  if (!set?.size) return;
  setImmediate(() => {
    for (const handler of set) {
      Promise.resolve()
        .then(() => handler(payload))
        .catch((e) => logger.error("events", `Handler for ${event} failed`, { error: e, payload }));
    }
  });
}

/** For tests: run handlers synchronously and await them. */
export async function emitAndWait<E extends EventName>(event: E, payload: DomainEvents[E]) {
  const set = registry.handlers.get(event);
  if (!set) return;
  await Promise.all([...set].map((h) => h(payload)));
}

export function isRegistered(flag: string) {
  const gg = globalThis as unknown as Record<string, boolean>;
  if (gg[flag]) return true;
  gg[flag] = true;
  return false;
}

import "server-only";
import { db } from "./db";
import { requestMeta } from "./request";

export type AuditInput = {
  actor?: { id: string; email: string } | null;
  action: string;
  entityType?: string;
  entityId?: string;
  summary?: string;
  changes?: Record<string, unknown>;
};

/** Record an administrative action. Never throws. */
export async function audit(input: AuditInput) {
  try {
    const meta = await requestMeta().catch(() => ({ ip: null, userAgent: null }));
    await db.auditLog.create({
      data: {
        actorId: input.actor?.id,
        actorEmail: input.actor?.email,
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId,
        summary: input.summary?.slice(0, 500),
        changes: (input.changes ?? {}) as object,
        ip: meta.ip,
        userAgent: meta.userAgent,
      },
    });
  } catch (e) {
    console.error("[audit] failed", e);
  }
}

/** Shallow diff of changed fields between two plain objects (for price/status audit trails). */
export function diff(before: Record<string, unknown>, after: Record<string, unknown>, keys?: string[]) {
  const out: Record<string, { from: unknown; to: unknown }> = {};
  for (const k of keys ?? Object.keys(after)) {
    const a = before[k];
    const b = after[k];
    if (JSON.stringify(a) !== JSON.stringify(b)) out[k] = { from: a, to: b };
  }
  return out;
}

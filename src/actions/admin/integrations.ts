"use server";

import { z } from "zod";
import { saveIntegration, testIntegration, syncIntegration } from "@/server/integrations/service";
import { getDefinition } from "@/server/integrations/registry";
import { audit } from "@/server/audit";
import { Errors } from "@/server/errors";
import type { Permission } from "@/config/permissions";
import { adminRun } from "./_base";

const keySchema = z.string().regex(/^[a-z0-9_]{2,40}$/);

/** Payment gateways need settings.payments; everything else settings.integrations. */
function permissionFor(key: string): Permission {
  const def = getDefinition(key);
  if (!def) throw Errors.notFound("integration");
  return def.category === "payments" ? "settings.payments" : "settings.integrations";
}

const saveSchema = z.object({
  isEnabled: z.boolean(),
  mode: z.enum(["test", "live"]).optional(),
  config: z.record(z.string(), z.union([z.string().max(20_000), z.number(), z.boolean()])),
  secrets: z.record(z.string(), z.string().max(20_000)),
  clearSecrets: z.array(z.string().max(60)).max(20).optional(),
});

export async function saveIntegrationAction(key: string, input: unknown) {
  const k = keySchema.parse(key);
  return adminRun(permissionFor(k), async (s) => {
    const row = await saveIntegration(k, saveSchema.parse(input));
    // Never log secret values — only which integration changed and its state.
    await audit({ actor: s, action: "integration.updated", entityType: "integration", entityId: k, summary: `${k}: ${row.isEnabled ? "enabled" : "disabled"} (${row.mode})` });
    return { status: row.status, lastError: row.lastError };
  });
}

export async function testIntegrationAction(key: string) {
  const k = keySchema.parse(key);
  return adminRun(permissionFor(k), () => testIntegration(k), { revalidate: false });
}

export async function syncIntegrationAction(key: string) {
  const k = keySchema.parse(key);
  return adminRun(permissionFor(k), async () => {
    const r = await syncIntegration(k);
    return { ok: r.ok, message: r.message };
  }, { revalidate: false });
}

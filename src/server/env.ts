import "server-only";
import { z } from "zod";

const schema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  APP_URL: z.string().url().default("http://localhost:3000"),
  DATABASE_URL: z.string().min(1),
  APP_SECRET: z.string().min(32, "APP_SECRET must be at least 32 characters"),
  ENCRYPTION_KEY: z
    .string()
    .refine((v) => Buffer.from(v, "base64").length === 32, "ENCRYPTION_KEY must be 32 bytes, base64-encoded"),
  STORAGE_DIR: z.string().default("./storage"),
  // "local" (disk under STORAGE_DIR) or "supabase" (Supabase Storage bucket).
  STORAGE_DRIVER: z.enum(["local", "supabase"]).default("local"),
  // Server-only. The service-role key bypasses RLS: never prefix it with NEXT_PUBLIC_.
  SUPABASE_URL: z.string().url().optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(20).optional(),
  SUPABASE_STORAGE_BUCKET: z.string().regex(/^[a-z0-9][a-z0-9_-]{1,62}$/).default("media"),
  TRUST_PROXY: z
    .string()
    .optional()
    .transform((v) => v === "true" || v === "1"),
}).superRefine((e, ctx) => {
  if (e.STORAGE_DRIVER === "supabase") {
    if (!e.SUPABASE_URL) ctx.addIssue({ code: "custom", path: ["SUPABASE_URL"], message: "required when STORAGE_DRIVER=supabase" });
    if (!e.SUPABASE_SERVICE_ROLE_KEY) ctx.addIssue({ code: "custom", path: ["SUPABASE_SERVICE_ROLE_KEY"], message: "required when STORAGE_DRIVER=supabase" });
  }
  // A key that would ship to the browser is a configuration error, not a warning.
  for (const k of Object.keys(process.env)) {
    if (k.startsWith("NEXT_PUBLIC_") && /SERVICE_ROLE|SECRET|PASSWORD|PRIVATE/i.test(k)) ctx.addIssue({ code: "custom", path: [k], message: "secrets must not use the NEXT_PUBLIC_ prefix" });
  }
});

export type Env = z.infer<typeof schema>;

let cached: Env | undefined;

/** Validated server environment. Throws at first use if misconfigured. */
export function env(): Env {
  if (!cached) {
    const parsed = schema.safeParse(process.env);
    if (!parsed.success) {
      const issues = parsed.error.issues.map((i) => `  - ${i.path.join(".")}: ${i.message}`).join("\n");
      throw new Error(`Invalid environment configuration:\n${issues}`);
    }
    cached = parsed.data;
  }
  return cached;
}

export const isProd = () => env().NODE_ENV === "production";

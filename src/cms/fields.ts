import { z } from "zod";
import { localized, type LocalizedText } from "@/lib/i18n-text";

/**
 * Declarative field descriptors. One description drives the admin editor form
 * (auto-generated), server-side validation (Zod schema derived from it) and
 * default values. Adding a section type never requires a bespoke form.
 */
export type Field =
  | { key: string; type: "text"; label: LocalizedText; localized?: boolean; placeholder?: string; max?: number; help?: LocalizedText }
  | { key: string; type: "textarea"; label: LocalizedText; localized?: boolean; max?: number; help?: LocalizedText }
  | { key: string; type: "richtext"; label: LocalizedText; localized?: boolean; help?: LocalizedText }
  | { key: string; type: "number"; label: LocalizedText; min?: number; max?: number; step?: number; help?: LocalizedText }
  | { key: string; type: "boolean"; label: LocalizedText; help?: LocalizedText }
  | { key: string; type: "select"; label: LocalizedText; options: { value: string; label: LocalizedText }[]; help?: LocalizedText }
  | { key: string; type: "color"; label: LocalizedText; help?: LocalizedText }
  | { key: string; type: "image"; label: LocalizedText; help?: LocalizedText }
  | { key: string; type: "link"; label: LocalizedText; help?: LocalizedText }
  | { key: string; type: "icon"; label: LocalizedText }
  | { key: string; type: "category"; label: LocalizedText; multiple?: boolean }
  | { key: string; type: "brand"; label: LocalizedText; multiple?: boolean }
  | { key: string; type: "products"; label: LocalizedText }
  | { key: string; type: "slider"; label: LocalizedText }
  | { key: string; type: "list"; label: LocalizedText; itemLabel: LocalizedText; fields: Field[]; max?: number; titleKey?: string };

export type FieldValues = Record<string, unknown>;

const lt = () => localized({ max: 20_000 }).prefault({});

export function schemaFor(fields: Field[]): z.ZodType<FieldValues> {
  const shape: Record<string, z.ZodTypeAny> = {};
  for (const f of fields) {
    switch (f.type) {
      case "text":
      case "textarea":
      case "richtext":
        shape[f.key] = f.type !== "richtext" && f.localized === false ? z.string().max(("max" in f && f.max) || 20_000).default("") : lt();
        break;
      case "number":
        shape[f.key] = z.coerce.number().min(f.min ?? -1e9).max(f.max ?? 1e9).optional();
        break;
      case "boolean":
        shape[f.key] = z.boolean().default(false);
        break;
      case "select":
        shape[f.key] = z.enum(f.options.map((o) => o.value) as [string, ...string[]]).optional();
        break;
      case "color":
        shape[f.key] = z.union([z.string().regex(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i), z.literal("")]).default("");
        break;
      case "image":
        shape[f.key] = z.object({ id: z.string().optional(), url: z.string().max(2000) }).nullable().default(null);
        break;
      case "link":
        // Relative paths or http(s) only — no javascript: URLs.
        shape[f.key] = z.union([z.string().regex(/^(\/(?!\/)|https?:\/\/|mailto:|tel:|#)/i).max(2000), z.literal("")]).default("");
        break;
      case "icon":
        shape[f.key] = z.string().max(60).default("");
        break;
      case "category":
      case "brand":
        shape[f.key] = f.multiple ? z.array(z.string()).max(50).default([]) : z.string().default("");
        break;
      case "products":
        shape[f.key] = z.array(z.string()).max(48).default([]);
        break;
      case "slider":
        shape[f.key] = z.string().default("");
        break;
      case "list":
        shape[f.key] = z.array(schemaFor(f.fields)).max(f.max ?? 30).default([]);
        break;
    }
  }
  return z.object(shape).passthrough() as unknown as z.ZodType<FieldValues>;
}

export function defaultsFor(fields: Field[]): FieldValues {
  return schemaFor(fields).parse({});
}

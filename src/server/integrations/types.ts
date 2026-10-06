import type { LocalizedText } from "@/lib/i18n-text";

export type IntegrationCategory = "analytics" | "search" | "marketing" | "payments" | "messaging" | "shipping" | "email";

export type FieldDef = {
  key: string;
  label: LocalizedText;
  type: "text" | "secret" | "textarea" | "secret-textarea" | "select" | "boolean" | "number";
  required?: boolean;
  placeholder?: string;
  help?: LocalizedText;
  options?: { value: string; label: LocalizedText }[];
  /** Only show this field in this mode. */
  mode?: "test" | "live";
};

export type IntegrationContext = {
  config: Record<string, unknown>;
  secrets: Record<string, string>;
  mode: "test" | "live";
};

export type TestResult = { ok: boolean; message: string; details?: Record<string, unknown> };

export type IntegrationDefinition = {
  key: string;
  category: IntegrationCategory;
  name: string;
  description: LocalizedText;
  /** simple-icons slug or a lucide icon name prefixed with "lucide:" */
  icon: string;
  docsUrl?: string;
  /**
   * `available` — fully implemented. `coming_soon` — listed so the
   * architecture & UI are ready, but clearly marked as not yet functional.
   */
  availability: "available" | "coming_soon";
  supportsModes?: boolean;
  fields: FieldDef[];
  test?: (ctx: IntegrationContext) => Promise<TestResult>;
  sync?: (ctx: IntegrationContext) => Promise<TestResult & { data?: Record<string, unknown> }>;
  /** Public (non-secret) config keys the storefront may read, e.g. a pixel id. */
  publicKeys?: string[];
};

import "server-only";
import type { IntegrationContext, IntegrationDefinition, TestResult } from "../types";

const GRAPH = "https://graph.facebook.com/v21.0";

/**
 * WhatsApp Business Cloud API (official Meta API). Business-initiated messages
 * outside the 24-hour customer-service window MUST use a pre-approved message
 * template — arbitrary text to arbitrary numbers isn't permitted by WhatsApp.
 * We send notifications through a single approved template with one body
 * parameter ({{1}}) carrying the message text.
 */
export const whatsappCloud: IntegrationDefinition = {
  key: "whatsapp_cloud",
  category: "messaging",
  name: "WhatsApp Business Cloud API",
  icon: "whatsapp",
  docsUrl: "https://developers.facebook.com/docs/whatsapp/cloud-api",
  availability: "available",
  description: {
    en: "Send order & staff notifications through Meta's official WhatsApp Business Platform using an approved message template.",
    ar: "أرسل إشعارات الطلبات والفريق عبر منصة واتساب للأعمال الرسمية من ميتا باستخدام قالب رسائل معتمد.",
  },
  fields: [
    { key: "phoneNumberId", type: "text", required: true, label: { en: "Phone number ID", ar: "معرّف رقم الهاتف" } },
    { key: "accessToken", type: "secret", required: true, label: { en: "Permanent access token", ar: "رمز الوصول الدائم" } },
    {
      key: "templateName",
      type: "text",
      required: true,
      placeholder: "store_notification",
      label: { en: "Approved template name", ar: "اسم القالب المعتمد" },
      help: { en: "A UTILITY template whose body contains one variable: {{1}}.", ar: "قالب من نوع UTILITY يحتوي متغيراً واحداً في النص: {{1}}." },
    },
    { key: "templateLanguage", type: "text", placeholder: "en", label: { en: "Template language code", ar: "رمز لغة القالب" } },
  ],
  async test({ config, secrets }) {
    if (!config.phoneNumberId || !secrets.accessToken) return { ok: false, message: "Phone number ID and access token are required." };
    const res = await fetch(`${GRAPH}/${config.phoneNumberId}?fields=display_phone_number,verified_name,quality_rating`, {
      headers: { Authorization: `Bearer ${secrets.accessToken}` },
      signal: AbortSignal.timeout(10_000),
    });
    const body = (await res.json()) as { display_phone_number?: string; verified_name?: string; error?: { message: string } };
    return res.ok
      ? { ok: true, message: `Connected: ${body.verified_name ?? ""} ${body.display_phone_number ?? ""}`.trim() }
      : { ok: false, message: body.error?.message ?? `Meta responded ${res.status}` };
  },
};

export async function sendWhatsAppTemplate(ctx: IntegrationContext, toE164: string, text: string): Promise<TestResult & { id?: string }> {
  const to = toE164.replace(/[^\d]/g, "");
  const res = await fetch(`${GRAPH}/${ctx.config.phoneNumberId}/messages`, {
    method: "POST",
    headers: { Authorization: `Bearer ${ctx.secrets.accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to,
      type: "template",
      template: {
        name: ctx.config.templateName,
        language: { code: (ctx.config.templateLanguage as string) || "en" },
        components: [{ type: "body", parameters: [{ type: "text", text: text.slice(0, 1000) }] }],
      },
    }),
    signal: AbortSignal.timeout(15_000),
  });
  const body = (await res.json()) as { messages?: { id: string }[]; error?: { message: string } };
  return res.ok ? { ok: true, message: "sent", id: body.messages?.[0]?.id } : { ok: false, message: body.error?.message ?? `HTTP ${res.status}` };
}

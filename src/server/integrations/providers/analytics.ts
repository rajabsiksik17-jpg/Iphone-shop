import "server-only";
import type { IntegrationDefinition } from "../types";
import { describeGoogleError, googleClient, googleFetch } from "../google";

export const googleAnalytics: IntegrationDefinition = {
  key: "google_analytics",
  category: "analytics",
  name: "Google Analytics 4",
  icon: "googleanalytics",
  docsUrl: "https://support.google.com/analytics/answer/9304153",
  availability: "available",
  description: {
    en: "GA4 tracking with consent mode and e-commerce events (view_item, add_to_cart, begin_checkout, purchase, search). Server-side purchase events via Measurement Protocol; optional reporting via the Data API.",
    ar: "تتبع GA4 مع وضع الموافقة وأحداث التجارة الإلكترونية (عرض منتج، إضافة للسلة، بدء الدفع، الشراء، البحث). أحداث الشراء من الخادم عبر Measurement Protocol، وتقارير اختيارية عبر Data API.",
  },
  publicKeys: ["measurementId"],
  fields: [
    { key: "measurementId", type: "text", required: true, placeholder: "G-XXXXXXXXXX", label: { en: "Measurement ID", ar: "معرّف القياس" } },
    {
      key: "apiSecret",
      type: "secret",
      label: { en: "Measurement Protocol API secret", ar: "مفتاح Measurement Protocol" },
      help: { en: "Admin → Data streams → your stream → Measurement Protocol API secrets. Enables reliable server-side purchase events.", ar: "الإدارة ← مصادر البيانات ← المصدر ← مفاتيح Measurement Protocol. يتيح إرسال أحداث الشراء من الخادم." },
    },
    { key: "propertyId", type: "text", placeholder: "123456789", label: { en: "Property ID (for reports)", ar: "معرّف الموقع (للتقارير)" } },
    {
      key: "serviceAccountJson",
      type: "secret-textarea",
      label: { en: "Service account JSON (for reports)", ar: "ملف حساب الخدمة JSON (للتقارير)" },
      help: { en: "Grant this service account 'Viewer' on the GA4 property.", ar: "امنح حساب الخدمة صلاحية 'مشاهد' على الموقع في GA4." },
    },
    { key: "trackEcommerce", type: "boolean", label: { en: "Send e-commerce events", ar: "إرسال أحداث التجارة الإلكترونية" } },
  ],
  async test({ config, secrets }) {
    const id = String(config.measurementId ?? "");
    if (!/^G-[A-Z0-9]{4,}$/i.test(id)) return { ok: false, message: "Measurement ID must look like G-XXXXXXXXXX." };
    const results: string[] = [];
    if (secrets.apiSecret) {
      // GA's validation server checks the measurement id / secret pairing and payload.
      const res = await fetch(
        `https://www.google-analytics.com/debug/mp/collect?measurement_id=${encodeURIComponent(id)}&api_secret=${encodeURIComponent(secrets.apiSecret)}`,
        { method: "POST", body: JSON.stringify({ client_id: "connection-test.1", events: [{ name: "connection_test", params: {} }] }), signal: AbortSignal.timeout(10_000) },
      );
      if (!res.ok) return { ok: false, message: `Measurement Protocol responded ${res.status}.` };
      const body = (await res.json()) as { validationMessages?: { description: string }[] };
      if (body.validationMessages?.length) return { ok: false, message: body.validationMessages.map((m) => m.description).join("; ") };
      results.push("Measurement Protocol accepted a validation event");
    }
    if (secrets.serviceAccountJson && config.propertyId) {
      try {
        const { client } = googleClient(secrets.serviceAccountJson, ["https://www.googleapis.com/auth/analytics.readonly"]);
        await googleFetch(client, `https://analyticsdata.googleapis.com/v1beta/properties/${config.propertyId}/metadata`);
        results.push("Data API access confirmed");
      } catch (e) {
        return { ok: false, message: `Data API: ${describeGoogleError(e)}` };
      }
    }
    return { ok: true, message: results.length ? results.join(" · ") : "Measurement ID format is valid. Add an API secret to verify it with Google." };
  },
  async sync({ config, secrets }) {
    if (!secrets.serviceAccountJson || !config.propertyId) return { ok: false, message: "Reporting needs a property ID and a service account." };
    try {
      const { client } = googleClient(secrets.serviceAccountJson, ["https://www.googleapis.com/auth/analytics.readonly"]);
      const report = await googleFetch<{ rows?: { dimensionValues: { value: string }[]; metricValues: { value: string }[] }[] }>(
        client,
        `https://analyticsdata.googleapis.com/v1beta/properties/${config.propertyId}:runReport`,
        {
          method: "POST",
          body: {
            dateRanges: [{ startDate: "28daysAgo", endDate: "today" }],
            dimensions: [{ name: "date" }],
            metrics: [{ name: "activeUsers" }, { name: "sessions" }, { name: "ecommercePurchases" }],
            orderBys: [{ dimension: { dimensionName: "date" } }],
          },
        },
      );
      const rows = (report.rows ?? []).map((r) => ({
        date: r.dimensionValues[0].value,
        users: Number(r.metricValues[0].value),
        sessions: Number(r.metricValues[1].value),
        purchases: Number(r.metricValues[2].value),
      }));
      return { ok: true, message: `Synced ${rows.length} days`, data: { daily: rows } };
    } catch (e) {
      return { ok: false, message: describeGoogleError(e) };
    }
  },
};

export const searchConsole: IntegrationDefinition = {
  key: "google_search_console",
  category: "search",
  name: "Google Search Console",
  icon: "googlesearchconsole",
  docsUrl: "https://developers.google.com/webmaster-tools/v1/how-tos/authorizing",
  availability: "available",
  description: {
    en: "Verify ownership, submit your sitemap and pull top queries & pages (clicks, impressions, CTR, position) into the dashboard.",
    ar: "تحقق من الملكية، أرسل خريطة الموقع، واجلب أهم عبارات البحث والصفحات (النقرات، مرات الظهور، نسبة النقر، الترتيب) إلى لوحة التحكم.",
  },
  fields: [
    { key: "siteUrl", type: "text", required: true, placeholder: "sc-domain:example.com or https://example.com/", label: { en: "Property", ar: "الموقع" } },
    { key: "verificationToken", type: "text", placeholder: "google-site-verification token", label: { en: "HTML tag verification token", ar: "رمز التحقق (وسم HTML)" }, help: { en: "Only the content value — it's rendered as a meta tag on every page.", ar: "قيمة المحتوى فقط — تُضاف كوسم meta في كل الصفحات." } },
    { key: "serviceAccountJson", type: "secret-textarea", required: true, label: { en: "Service account JSON", ar: "ملف حساب الخدمة JSON" }, help: { en: "Add the service account email as a user (Full) in Search Console → Settings → Users and permissions.", ar: "أضف بريد حساب الخدمة كمستخدم (كامل) في Search Console ← الإعدادات ← المستخدمون والأذونات." } },
  ],
  publicKeys: ["verificationToken"],
  async test({ config, secrets }) {
    try {
      const { client, email } = googleClient(secrets.serviceAccountJson, ["https://www.googleapis.com/auth/webmasters"]);
      const site = encodeURIComponent(String(config.siteUrl ?? ""));
      const res = await googleFetch<{ permissionLevel?: string }>(client, `https://www.googleapis.com/webmasters/v3/sites/${site}`);
      return { ok: true, message: `Connected as ${email} (${res.permissionLevel ?? "access granted"})` };
    } catch (e) {
      return { ok: false, message: describeGoogleError(e) };
    }
  },
  async sync({ config, secrets }) {
    try {
      const { client } = googleClient(secrets.serviceAccountJson, ["https://www.googleapis.com/auth/webmasters"]);
      const site = encodeURIComponent(String(config.siteUrl ?? ""));
      const end = new Date();
      const start = new Date(Date.now() - 28 * 86_400_000);
      const fmt = (d: Date) => d.toISOString().slice(0, 10);
      const query = (dimension: string) =>
        googleFetch<{ rows?: { keys: string[]; clicks: number; impressions: number; ctr: number; position: number }[] }>(
          client,
          `https://www.googleapis.com/webmasters/v3/sites/${site}/searchAnalytics/query`,
          { method: "POST", body: { startDate: fmt(start), endDate: fmt(end), dimensions: [dimension], rowLimit: 25 } },
        );
      const [queries, pages, daily] = await Promise.all([query("query"), query("page"), query("date")]);
      const map = (r: { rows?: { keys: string[]; clicks: number; impressions: number; ctr: number; position: number }[] }) =>
        (r.rows ?? []).map((x) => ({ key: x.keys[0], clicks: x.clicks, impressions: x.impressions, ctr: x.ctr, position: x.position }));
      return { ok: true, message: "Search performance synced", data: { queries: map(queries), pages: map(pages), daily: map(daily) } };
    } catch (e) {
      return { ok: false, message: describeGoogleError(e) };
    }
  },
};

export const metaPixel: IntegrationDefinition = {
  key: "meta_pixel",
  category: "marketing",
  name: "Meta Pixel & Conversions API",
  icon: "meta",
  docsUrl: "https://developers.facebook.com/docs/meta-pixel",
  availability: "available",
  description: {
    en: "Meta Pixel (consent-gated) for ViewContent, AddToCart, InitiateCheckout and Purchase. Optional Conversions API token enables server-side Purchase events.",
    ar: "بكسل ميتا (بعد الموافقة) لأحداث عرض المحتوى والإضافة للسلة وبدء الدفع والشراء. رمز Conversions API الاختياري يتيح إرسال أحداث الشراء من الخادم.",
  },
  publicKeys: ["pixelId"],
  fields: [
    { key: "pixelId", type: "text", required: true, placeholder: "1234567890", label: { en: "Pixel ID", ar: "معرّف البكسل" } },
    { key: "accessToken", type: "secret", label: { en: "Conversions API access token", ar: "رمز Conversions API" } },
    { key: "testEventCode", type: "text", label: { en: "Test event code (optional)", ar: "رمز أحداث الاختبار (اختياري)" } },
  ],
  async test({ config, secrets }) {
    const id = String(config.pixelId ?? "");
    if (!/^\d{6,20}$/.test(id)) return { ok: false, message: "Pixel ID should be numeric." };
    if (!secrets.accessToken) return { ok: true, message: "Pixel ID format is valid. Add a Conversions API token to verify with Meta." };
    const res = await fetch(`https://graph.facebook.com/v21.0/${id}?fields=name&access_token=${encodeURIComponent(secrets.accessToken)}`, { signal: AbortSignal.timeout(10_000) });
    const body = (await res.json()) as { name?: string; error?: { message: string } };
    return res.ok ? { ok: true, message: `Connected to pixel "${body.name ?? id}"` } : { ok: false, message: body.error?.message ?? `Meta responded ${res.status}` };
  },
};

export const tiktokPixel: IntegrationDefinition = {
  key: "tiktok_pixel",
  category: "marketing",
  name: "TikTok Pixel",
  icon: "tiktok",
  availability: "available",
  description: { en: "Consent-gated TikTok pixel with ViewContent, AddToCart, InitiateCheckout and CompletePayment.", ar: "بكسل تيك توك (بعد الموافقة) مع أحداث العرض والإضافة للسلة وبدء الدفع وإتمام الدفع." },
  publicKeys: ["pixelCode"],
  fields: [{ key: "pixelCode", type: "text", required: true, placeholder: "C1234ABCD…", label: { en: "Pixel code", ar: "رمز البكسل" } }],
  async test({ config }) {
    const code = String(config.pixelCode ?? "");
    return /^[A-Z0-9]{10,30}$/i.test(code)
      ? { ok: true, message: "Pixel code format looks valid (TikTok offers no public verification endpoint)." }
      : { ok: false, message: "Pixel code format is invalid." };
  },
};

const soon = (key: string, category: IntegrationDefinition["category"], name: string, icon: string, en: string, ar: string): IntegrationDefinition => ({
  key,
  category,
  name,
  icon,
  availability: "coming_soon",
  description: { en, ar },
  fields: [],
});

export const plannedIntegrations: IntegrationDefinition[] = [
  soon("google_merchant", "marketing", "Google Merchant Center", "google", "Product feed sync for Shopping ads and free listings.", "مزامنة المنتجات لإعلانات التسوق والقوائم المجانية."),
  soon("google_ads", "marketing", "Google Ads conversions", "googleads", "Enhanced conversion tracking.", "تتبع التحويلات المحسّن."),
  soon("mailchimp", "email", "Mailchimp", "mailchimp", "Sync newsletter subscribers & customers.", "مزامنة المشتركين والعملاء."),
  soon("aramex", "shipping", "Aramex", "lucide:truck", "Live rates, label creation and tracking.", "أسعار الشحن المباشرة وإنشاء البوالص والتتبع."),
  soon("twilio_sms", "messaging", "Twilio SMS", "twilio", "SMS notifications channel.", "قناة إشعارات الرسائل النصية."),
];

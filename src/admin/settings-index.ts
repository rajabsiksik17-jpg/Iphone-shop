import type { Permission } from "@/config/permissions";
import type { AdminKey } from "./i18n";

/**
 * Searchable index of settings. Typing "SMTP" in ⌘K or the settings search
 * jumps straight to Email → SMTP; "OTP" → Security → Admin OTP, etc.
 */
export type SettingsEntry = { title: AdminKey; section: AdminKey; href: string; permission: Permission; keywords: string[] };

export const SETTINGS_INDEX: SettingsEntry[] = [
  { title: "s.store", section: "nav.settings", href: "/admin/settings/store", permission: "settings.general", keywords: ["store", "name", "logo", "address", "tax number", "order number", "prefix", "متجر", "شعار", "اسم"] },
  { title: "s.storeType", section: "nav.settings", href: "/admin/settings/store-type", permission: "settings.general", keywords: ["store type", "preset", "fashion", "electronics", "beauty", "grocery", "attributes", "card", "icons", "نوع المتجر", "قالب", "أزياء", "إلكترونيات"] },
  { title: "s.appearance", section: "nav.settings", href: "/admin/settings/appearance", permission: "settings.general", keywords: ["theme", "color", "colour", "font", "radius", "header", "footer", "badge", "product card", "ثيم", "لون", "خط", "مظهر"] },
  { title: "s.localization", section: "nav.settings", href: "/admin/settings/localization", permission: "settings.general", keywords: ["language", "arabic", "english", "timezone", "locale", "لغة", "منطقة زمنية"] },
  { title: "s.currencies", section: "nav.settings", href: "/admin/settings/currencies", permission: "settings.general", keywords: ["currency", "jod", "usd", "eur", "exchange", "rate", "symbol", "عملة", "دينار"] },
  { title: "s.seo", section: "nav.settings", href: "/admin/settings/seo", permission: "settings.general", keywords: ["seo", "meta", "title", "robots", "index", "verification", "sitemap", "og", "سيو"] },
  { title: "s.checkout", section: "nav.settings", href: "/admin/settings/checkout", permission: "settings.general", keywords: ["checkout", "guest", "terms", "minimum", "postal", "notes", "دفع", "شروط"] },
  { title: "s.tax", section: "nav.settings", href: "/admin/settings/tax", permission: "settings.general", keywords: ["tax", "vat", "sales tax", "ضريبة"] },
  { title: "s.shipping", section: "nav.settings", href: "/admin/settings/shipping", permission: "settings.shipping", keywords: ["shipping", "delivery", "zone", "free shipping", "pickup", "rate", "شحن", "توصيل"] },
  { title: "s.regions", section: "nav.settings", href: "/admin/settings/regions", permission: "settings.shipping", keywords: ["city", "cities", "governorate", "region", "country", "delivery price", "delivery time", "saudi", "مدينة", "مدن", "محافظة", "منطقة", "دولة", "سعر التوصيل", "مدة التوصيل", "السعودية"] },
  { title: "s.payments", section: "nav.settings", href: "/admin/integrations?category=payments", permission: "settings.payments", keywords: ["payment", "stripe", "paypal", "cod", "cash", "bank", "cliq", "gateway", "دفع", "كاش"] },
  { title: "s.email", section: "nav.settings", href: "/admin/settings/email", permission: "settings.email", keywords: ["smtp", "imap", "email", "mail", "from", "test email", "بريد"] },
  { title: "s.templates", section: "nav.settings", href: "/admin/settings/email/templates", permission: "settings.email", keywords: ["template", "email template", "order confirmation", "welcome", "قالب"] },
  { title: "s.notifications", section: "nav.settings", href: "/admin/settings/notifications", permission: "settings.notifications", keywords: ["notification", "alert", "whatsapp", "email alert", "إشعار", "تنبيه"] },
  { title: "s.otpTitle", section: "s.security", href: "/admin/settings/security", permission: "settings.security", keywords: ["otp", "2fa", "two factor", "code", "رمز التحقق"] },
  { title: "s.security", section: "nav.settings", href: "/admin/settings/security", permission: "settings.security", keywords: ["security", "session", "lockout", "password", "timeout", "أمان", "جلسة"] },
  { title: "s.chat", section: "nav.settings", href: "/admin/settings/chat", permission: "support.chat", keywords: ["chat", "live chat", "hours", "offline", "welcome message", "محادثة"] },
  { title: "s.contact", section: "nav.settings", href: "/admin/settings/contact", permission: "content.manage", keywords: ["contact", "phone", "whatsapp", "map", "hours", "form", "floating", "widget", "تواصل", "واتساب"] },
  { title: "s.loyalty", section: "nav.settings", href: "/admin/settings/loyalty", permission: "marketing.manage", keywords: ["loyalty", "points", "reward", "نقاط", "ولاء"] },
  { title: "s.orderStatuses", section: "nav.settings", href: "/admin/settings/order-statuses", permission: "settings.general", keywords: ["status", "order status", "workflow", "حالة"] },
  { title: "s.privacy", section: "nav.settings", href: "/admin/settings/privacy", permission: "settings.general", keywords: ["privacy", "cookie", "consent", "gdpr", "export", "delete account", "خصوصية"] },
  { title: "s.maintenance", section: "nav.settings", href: "/admin/settings/maintenance", permission: "settings.general", keywords: ["maintenance", "offline", "coming soon", "صيانة"] },
  { title: "s.geo", section: "nav.settings", href: "/admin/settings/geo", permission: "settings.general", keywords: ["country", "geo", "detect", "location", "دولة"] },
  { title: "nav.integrations", section: "nav.settings", href: "/admin/integrations", permission: "settings.integrations", keywords: ["google analytics", "search console", "meta pixel", "tiktok", "whatsapp api", "integration", "تكامل"] },
  { title: "cms.tickerSettings", section: "nav.content", href: "/admin/announcements", permission: "content.manage", keywords: ["ticker", "announcement", "news", "marquee", "شريط", "إعلان"] },
  { title: "cms.floatingWidgets", section: "nav.content", href: "/admin/social", permission: "content.manage", keywords: ["floating", "social", "button", "زر عائم"] },
];

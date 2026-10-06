"use client";

import type { SettingsGroup } from "@/server/settings/schemas";
import type { AdminKey } from "@/admin/i18n";
import type { SettingSection } from "./form";
import { Select } from "../fields";

type Def = { group: SettingsGroup; title: AdminKey; description?: readonly [string, string]; sections: SettingSection[] };
const o = (value: string, en: string, ar: string) => ({ value, label: [en, ar] as const });
const upper2 = (s: string) => s.trim().toUpperCase().slice(0, 2);
const upper3 = (s: string) => s.trim().toUpperCase().slice(0, 3);

const TIMEZONES = (() => {
  try {
    return Intl.supportedValuesOf("timeZone");
  } catch {
    return ["Asia/Amman", "Asia/Riyadh", "Asia/Dubai", "Africa/Cairo", "Europe/London", "UTC"];
  }
})();

/** Declarative definitions for settings groups that are plain key/value forms. */
export const SETTINGS_DEFS: Record<string, Def> = {
  store: {
    group: "store",
    title: "s.store",
    sections: [
      {
        title: ["Identity", "الهوية"],
        fields: [
          { path: "name", type: "localized", label: ["Store name", "اسم المتجر"] },
          { path: "tagline", type: "localized", label: ["Tagline", "الشعار النصي"] },
          { path: "logoUrl", type: "image", label: ["Logo (light backgrounds)", "الشعار (خلفيات فاتحة)"], hint: ["SVG or PNG, transparent background", "SVG أو PNG بخلفية شفافة"] },
          { path: "logoDarkUrl", type: "image", label: ["Logo (dark backgrounds)", "الشعار (خلفيات داكنة)"] },
          { path: "faviconUrl", type: "image", label: ["Favicon", "أيقونة المتصفح"] },
        ],
      },
      {
        title: ["Business details", "بيانات النشاط"],
        description: ["Shown on invoices, emails and the contact page.", "تظهر على الفواتير والبريد وصفحة التواصل."],
        fields: [
          { path: "email", type: "email", label: ["Store email", "بريد المتجر"] },
          { path: "phone", type: "text", label: ["Phone", "الهاتف"], ltr: true },
          { path: "address", type: "localizedTextarea", label: ["Address", "العنوان"] },
          { path: "legalName", type: "text", label: ["Legal name", "الاسم القانوني"] },
          { path: "taxNumber", type: "text", label: ["Tax number", "الرقم الضريبي"], ltr: true },
        ],
      },
      {
        title: ["Operations", "التشغيل"],
        fields: [
          { path: "defaultCountry", type: "text", label: ["Default country (ISO)", "الدولة الافتراضية (ISO)"], ltr: true, placeholder: "JO" },
          { path: "orderNumberPrefix", type: "text", label: ["Order number prefix", "بادئة رقم الطلب"], ltr: true },
          { path: "lowStockThreshold", type: "number", label: ["Low-stock threshold", "حد المخزون المنخفض"], min: 0 },
          { path: "newProductDays", type: "number", label: ["“New” badge for (days)", "شارة «جديد» لمدة (أيام)"], min: 0, max: 365 },
        ],
      },
    ],
  },
  appearance: {
    group: "appearance",
    title: "s.appearance",
    description: ["Your storefront theme. Changes apply instantly after saving.", "ثيم واجهة المتجر. تُطبّق التغييرات فور الحفظ."],
    sections: [
      {
        title: ["Colours", "الألوان"],
        fields: [
          { path: "colors.primary", type: "color", label: ["Primary", "الأساسي"] },
          { path: "colors.primaryForeground", type: "color", label: ["Text on primary", "النص على الأساسي"] },
          { path: "colors.accent", type: "color", label: ["Accent", "المميز"] },
          { path: "colors.accentForeground", type: "color", label: ["Text on accent", "النص على المميز"] },
          { path: "colors.background", type: "color", label: ["Background", "الخلفية"] },
          { path: "colors.surface", type: "color", label: ["Surface", "الأسطح"] },
          { path: "colors.foreground", type: "color", label: ["Text", "النص"] },
          { path: "colors.muted", type: "color", label: ["Muted text", "النص الثانوي"] },
          { path: "colors.border", type: "color", label: ["Borders", "الحدود"] },
          { path: "colors.sale", type: "color", label: ["Sale price", "سعر التخفيض"] },
          { path: "colors.success", type: "color", label: ["Success", "النجاح"] },
          { path: "colors.warning", type: "color", label: ["Warning", "التحذير"] },
        ],
      },
      {
        title: ["Typography & shape", "الخطوط والأشكال"],
        fields: [
          { path: "fontLatin", type: "select", label: ["Latin font", "الخط اللاتيني"], options: [o("geist", "Geist", "Geist"), o("inter", "Inter", "Inter"), o("manrope", "Manrope", "Manrope"), o("dm-sans", "DM Sans", "DM Sans")] },
          { path: "fontArabic", type: "select", label: ["Arabic font", "الخط العربي"], options: [o("ibm-plex-arabic", "IBM Plex Sans Arabic", "IBM Plex Sans Arabic"), o("noto-kufi", "Noto Kufi Arabic", "Noto Kufi Arabic"), o("tajawal", "Tajawal", "Tajawal"), o("cairo", "Cairo", "Cairo")] },
          { path: "radius", type: "number", label: ["Corner radius", "انحناء الزوايا"], min: 0, max: 28, suffix: "px" },
          { path: "containerWidth", type: "number", label: ["Max content width", "أقصى عرض للمحتوى"], min: 1024, max: 1920, step: 8, suffix: "px" },
          { path: "buttonShape", type: "segmented", label: ["Buttons", "الأزرار"], options: [o("pill", "Pill", "دائري"), o("rounded", "Rounded", "منحني"), o("square", "Square", "مربع")] },
          { path: "shadow", type: "segmented", label: ["Shadows", "الظلال"], options: [o("none", "None", "بدون"), o("soft", "Soft", "خفيف"), o("medium", "Medium", "متوسط"), o("strong", "Strong", "قوي")] },
        ],
      },
      {
        title: ["Header", "الهيدر"],
        fields: [
          { path: "header.sticky", type: "boolean", label: ["Sticky header", "هيدر ثابت عند التمرير"] },
          { path: "header.showCategoryBar", type: "boolean", label: ["Category bar", "شريط التصنيفات"] },
          { path: "header.style", type: "segmented", label: ["Style", "النمط"], options: [o("blur", "Frosted", "ضبابي"), o("solid", "Solid", "مصمت")] },
        ],
      },
      {
        title: ["Product cards", "بطاقات المنتجات"],
        fields: [
          { path: "productCard.style", type: "segmented", label: ["Style", "النمط"], options: [o("minimal", "Minimal", "بسيط"), o("bordered", "Bordered", "بإطار"), o("elevated", "Elevated", "مرتفع")] },
          { path: "productCard.imageRatio", type: "segmented", label: ["Image ratio", "نسبة الصورة"], options: [o("1/1", "1:1", "1:1"), o("4/5", "4:5", "4:5"), o("3/4", "3:4", "3:4")] },
          { path: "productCard.showBrand", type: "boolean", label: ["Show brand", "إظهار العلامة"] },
          { path: "productCard.showRating", type: "boolean", label: ["Show rating", "إظهار التقييم"] },
          { path: "productCard.quickAdd", type: "boolean", label: ["Quick add to cart", "إضافة سريعة للسلة"] },
          { path: "productCard.hoverSecondImage", type: "boolean", label: ["Second image on hover", "صورة ثانية عند التمرير"] },
        ],
      },
      {
        title: ["Badges", "الشارات"],
        fields: [
          { path: "badges.new", type: "color", label: ["New", "جديد"] },
          { path: "badges.sale", type: "color", label: ["Sale", "تخفيض"] },
          { path: "badges.bestSeller", type: "color", label: ["Best seller", "الأكثر مبيعاً"] },
          { path: "badges.lowStock", type: "color", label: ["Low stock", "كمية محدودة"] },
          { path: "badges.outOfStock", type: "color", label: ["Out of stock", "نفد المخزون"] },
          { path: "badges.limited", type: "color", label: ["Limited", "إصدار محدود"] },
          { path: "badges.showNew", type: "boolean", label: ["Show “New”", "إظهار «جديد»"] },
          { path: "badges.showSale", type: "boolean", label: ["Show “Sale”", "إظهار «تخفيض»"] },
          { path: "badges.salePercent", type: "boolean", label: ["Show discount as percentage", "عرض الخصم كنسبة مئوية"] },
          { path: "badges.showBestSeller", type: "boolean", label: ["Show “Best seller”", "إظهار «الأكثر مبيعاً»"] },
          { path: "badges.showLowStock", type: "boolean", label: ["Show “Low stock”", "إظهار «كمية محدودة»"] },
        ],
      },
      {
        title: ["Footer", "الفوتر"],
        fields: [
          { path: "footer.style", type: "segmented", label: ["Style", "النمط"], options: [o("dark", "Dark", "داكن"), o("light", "Light", "فاتح")] },
          { path: "footer.about", type: "localizedTextarea", label: ["About text", "نبذة"] },
          { path: "footer.showNewsletter", type: "boolean", label: ["Newsletter signup", "الاشتراك في النشرة"] },
          { path: "footer.showPaymentIcons", type: "boolean", label: ["Payment icons", "أيقونات الدفع"] },
          { path: "footer.paymentIcons", type: "tags", label: ["Payment icons shown", "أيقونات الدفع الظاهرة"], placeholder: "visa, mastercard, applepay, cod", showIf: (v) => Boolean((v.footer as { showPaymentIcons?: boolean })?.showPaymentIcons), transform: (s) => s.trim().toLowerCase() },
        ],
      },
    ],
  },
  localization: {
    group: "localization",
    title: "s.localization",
    sections: [
      {
        title: ["Language & region", "اللغة والمنطقة"],
        fields: [
          { path: "defaultLocale", type: "segmented", label: ["Default language", "اللغة الافتراضية"], options: [o("ar", "العربية", "العربية"), o("en", "English", "English")] },
          {
            path: "timezone",
            type: "custom",
            label: ["Store timezone", "المنطقة الزمنية"],
            hint: ["Used for reports and order dates", "تُستخدم في التقارير وتواريخ الطلبات"],
            render: (v, set) => (
              <Select value={String(v ?? "Asia/Amman")} onChange={(e) => set(e.target.value)}>
                {TIMEZONES.map((z) => (
                  <option key={z} value={z}>
                    {z}
                  </option>
                ))}
              </Select>
            ),
          },
          { path: "displayCurrencies", type: "tags", label: ["Currencies shoppers can switch to", "العملات المتاحة للتبديل"], hint: ["ISO codes of active currencies", "رموز ISO للعملات المفعّلة"], transform: upper3 },
          { path: "useArabicDigits", type: "boolean", label: ["Use Arabic-Indic digits (٠١٢٣) in Arabic", "استخدام الأرقام العربية الهندية (٠١٢٣)"] },
        ],
      },
    ],
  },
  seo: {
    group: "seo",
    title: "s.seo",
    sections: [
      {
        title: ["Defaults", "الافتراضيات"],
        fields: [
          { path: "titleTemplate", type: "localized", label: ["Title template", "قالب العنوان"], hint: ["%s is replaced by the page title", "يُستبدل %s بعنوان الصفحة"] },
          { path: "defaultTitle", type: "localized", label: ["Homepage title", "عنوان الصفحة الرئيسية"] },
          { path: "defaultDescription", type: "localizedTextarea", label: ["Default meta description", "الوصف التعريفي الافتراضي"] },
          { path: "productTitleTemplate", type: "localized", label: ["Product title template", "قالب عنوان المنتج"], hint: ["Variables: %name% %brand% %category%", "المتغيرات: %name% %brand% %category%"] },
          { path: "ogImageUrl", type: "image", label: ["Default social share image (1200×630)", "صورة المشاركة الافتراضية (1200×630)"] },
          { path: "twitterHandle", type: "text", label: ["X (Twitter) handle", "حساب X"], ltr: true, placeholder: "@yourstore" },
        ],
      },
      {
        title: ["Indexing & verification", "الفهرسة والتحقق"],
        fields: [
          { path: "allowIndexing", type: "boolean", label: ["Allow search engines to index the store", "السماح لمحركات البحث بأرشفة المتجر"], hint: ["Turn off for staging sites", "أوقفه لمواقع الاختبار"] },
          { path: "robotsDisallow", type: "tags", label: ["Extra paths to block in robots.txt", "مسارات إضافية تُحجب في robots.txt"], placeholder: "/landing/old" },
          { path: "googleVerification", type: "text", label: ["Google site verification", "رمز تحقق Google"], ltr: true },
          { path: "bingVerification", type: "text", label: ["Bing site verification", "رمز تحقق Bing"], ltr: true },
        ],
      },
    ],
  },
  checkout: {
    group: "checkout",
    title: "s.checkout",
    sections: [
      {
        title: ["Checkout rules", "قواعد الدفع"],
        fields: [
          { path: "guestCheckout", type: "boolean", label: ["Allow guest checkout", "السماح بالشراء كزائر"] },
          { path: "allowOrderNotes", type: "boolean", label: ["Allow order notes", "السماح بملاحظات الطلب"] },
          { path: "requireTerms", type: "boolean", label: ["Require accepting terms", "اشتراط الموافقة على الشروط"] },
          { path: "termsPageSlug", type: "text", label: ["Terms page slug", "رابط صفحة الشروط"], ltr: true, showIf: (v) => Boolean(v.requireTerms) },
          { path: "privacyPageSlug", type: "text", label: ["Privacy page slug", "رابط صفحة الخصوصية"], ltr: true },
          { path: "minOrderAmount", type: "money", label: ["Minimum order amount", "أقل مبلغ للطلب"] },
          { path: "postalCode", type: "segmented", label: ["Postal code", "الرمز البريدي"], options: [o("hidden", "Hidden", "مخفي"), o("optional", "Optional", "اختياري"), o("required", "Required", "إلزامي")] },
          { path: "holdUnpaidMinutes", type: "number", label: ["Cancel unpaid online orders after", "إلغاء الطلبات غير المدفوعة بعد"], min: 5, max: 10080, suffix: "min" },
          { path: "allowedCountries", type: "tags", label: ["Ship only to (ISO codes; empty = all)", "الشحن فقط إلى (رموز ISO؛ فارغ = الكل)"], placeholder: "JO, SA, AE", transform: upper2 },
        ],
      },
    ],
  },
  tax: {
    group: "tax",
    title: "s.tax",
    sections: [
      {
        title: ["Sales tax", "ضريبة المبيعات"],
        fields: [
          { path: "enabled", type: "boolean", label: ["Charge tax", "احتساب الضريبة"] },
          { path: "rateBp", type: "percentBp", label: ["Rate", "النسبة"], showIf: (v) => Boolean(v.enabled) },
          { path: "pricesIncludeTax", type: "boolean", label: ["Catalog prices include tax", "الأسعار تشمل الضريبة"], showIf: (v) => Boolean(v.enabled) },
          { path: "label", type: "localized", label: ["Label on receipts", "التسمية على الفواتير"], showIf: (v) => Boolean(v.enabled) },
        ],
      },
    ],
  },
  security: {
    group: "security",
    title: "s.security",
    sections: [
      {
        title: ["Admin login OTP", "رمز التحقق لدخول المدراء"],
        description: ["Admins enter a one-time code sent by email after their password. Test SMTP first so you can't lock yourself out.", "يُدخل المدراء رمزاً يُرسل بالبريد بعد كلمة المرور. اختبر SMTP أولاً حتى لا تُقفل الدخول على نفسك."],
        fields: [
          { path: "adminOtp.enabled", type: "boolean", label: ["Require OTP for admin login", "طلب رمز التحقق عند دخول المدراء"] },
          { path: "adminOtp.length", type: "number", label: ["Code length", "طول الرمز"], min: 4, max: 10, showIf: (v) => Boolean((v.adminOtp as { enabled?: boolean })?.enabled) },
          { path: "adminOtp.ttlMinutes", type: "number", label: ["Code valid for", "صلاحية الرمز"], min: 1, max: 60, suffix: "min", showIf: (v) => Boolean((v.adminOtp as { enabled?: boolean })?.enabled) },
          { path: "adminOtp.maxAttempts", type: "number", label: ["Max attempts", "أقصى عدد محاولات"], min: 1, max: 20, showIf: (v) => Boolean((v.adminOtp as { enabled?: boolean })?.enabled) },
          { path: "adminOtp.resendCooldownSeconds", type: "number", label: ["Resend cooldown", "مهلة إعادة الإرسال"], min: 10, max: 600, suffix: "s", showIf: (v) => Boolean((v.adminOtp as { enabled?: boolean })?.enabled) },
        ],
      },
      {
        title: ["Sign-in protection", "حماية تسجيل الدخول"],
        fields: [
          { path: "login.maxFailedAttempts", type: "number", label: ["Lock after failed attempts", "القفل بعد محاولات فاشلة"], min: 3, max: 50 },
          { path: "login.lockoutMinutes", type: "number", label: ["Lockout duration", "مدة القفل"], min: 1, max: 1440, suffix: "min" },
          { path: "passwordMinLength", type: "number", label: ["Minimum password length", "أقل طول لكلمة المرور"], min: 8, max: 128 },
          { path: "alertOnNewAdminLogin", type: "boolean", label: ["Email admins on new sign-in", "تنبيه المدراء بالبريد عند كل دخول"] },
        ],
      },
      {
        title: ["Sessions", "الجلسات"],
        fields: [
          { path: "sessions.adminIdleMinutes", type: "number", label: ["Admin idle timeout", "مهلة خمول المدير"], min: 5, max: 10080, suffix: "min" },
          { path: "sessions.adminMaxHours", type: "number", label: ["Admin session max age", "أقصى مدة لجلسة المدير"], min: 1, max: 720, suffix: "h" },
          { path: "sessions.customerDays", type: "number", label: ["Customer stays signed in", "مدة بقاء العميل مسجلاً"], min: 1, max: 365, suffix: "days" },
        ],
      },
    ],
  },
  chat: {
    group: "chat",
    title: "s.chat",
    sections: [
      {
        title: ["Availability", "التوفر"],
        fields: [
          { path: "enabled", type: "boolean", label: ["Live chat enabled", "تفعيل المحادثة المباشرة"] },
          { path: "requireAgentOnline", type: "boolean", label: ["Only accept chats when an agent is online", "قبول المحادثات فقط عند اتصال موظف"], hint: ["Otherwise shoppers see the offline message and can leave a message", "وإلا تظهر رسالة عدم الاتصال ويمكن ترك رسالة"] },
          { path: "useBusinessHours", type: "boolean", label: ["Limit to business hours", "حصرها بساعات العمل"] },
          { path: "hours", type: "hours", label: ["Business hours", "ساعات العمل"], showIf: (v) => Boolean(v.useBusinessHours) },
        ],
      },
      {
        title: ["Messages", "الرسائل"],
        fields: [
          { path: "welcome", type: "localizedTextarea", label: ["Agent welcome message", "رسالة ترحيب الموظف"] },
          { path: "waiting", type: "localizedTextarea", label: ["While waiting", "أثناء الانتظار"] },
          { path: "offline", type: "localizedTextarea", label: ["When offline", "عند عدم الاتصال"] },
        ],
      },
      {
        title: ["Queue", "قائمة الانتظار"],
        fields: [
          { path: "maxQueue", type: "number", label: ["Max waiting chats", "أقصى عدد بالانتظار"], min: 1, max: 500 },
          { path: "autoCloseMinutes", type: "number", label: ["Close idle chats after", "إغلاق المحادثات الخاملة بعد"], min: 5, max: 1440, suffix: "min" },
          { path: "sound", type: "boolean", label: ["Sound for new chats", "صوت للمحادثات الجديدة"] },
        ],
      },
    ],
  },
  contact: {
    group: "contact",
    title: "s.contact",
    sections: [
      {
        title: ["Contact details", "بيانات التواصل"],
        fields: [
          { path: "phone", type: "text", label: ["Phone", "الهاتف"], ltr: true },
          { path: "email", type: "email", label: ["Email", "البريد"] },
          { path: "whatsapp", type: "text", label: ["WhatsApp number", "رقم واتساب"], ltr: true, placeholder: "9627XXXXXXXX" },
          { path: "mapEmbedUrl", type: "url", label: ["Google Maps embed URL", "رابط تضمين خرائط Google"], hint: ["Maps → Share → Embed a map → copy the src", "الخرائط ← مشاركة ← تضمين خريطة ← انسخ src"] },
          { path: "address", type: "localizedTextarea", label: ["Address", "العنوان"] },
          { path: "hours", type: "localized", label: ["Opening hours", "ساعات العمل"] },
        ],
      },
      {
        title: ["Contact form", "نموذج التواصل"],
        fields: [
          { path: "form.phone", type: "segmented", label: ["Phone field", "حقل الهاتف"], options: [o("hidden", "Hidden", "مخفي"), o("optional", "Optional", "اختياري"), o("required", "Required", "إلزامي")] },
          { path: "form.subject", type: "segmented", label: ["Subject field", "حقل الموضوع"], options: [o("hidden", "Hidden", "مخفي"), o("optional", "Optional", "اختياري"), o("required", "Required", "إلزامي")] },
          { path: "form.orderNumber", type: "segmented", label: ["Order number field", "حقل رقم الطلب"], options: [o("hidden", "Hidden", "مخفي"), o("optional", "Optional", "اختياري"), o("required", "Required", "إلزامي")] },
          { path: "showLiveChat", type: "boolean", label: ["Show live chat card", "إظهار بطاقة المحادثة"] },
          { path: "showWhatsapp", type: "boolean", label: ["Show WhatsApp card", "إظهار بطاقة واتساب"] },
        ],
      },
    ],
  },
  loyalty: {
    group: "loyalty",
    title: "s.loyalty",
    sections: [
      {
        title: ["Points programme", "برنامج النقاط"],
        fields: [
          { path: "enabled", type: "boolean", label: ["Enable loyalty points", "تفعيل نقاط الولاء"] },
          { path: "pointsPerUnit", type: "number", label: ["Points per 1 unit spent", "نقاط لكل وحدة إنفاق"], min: 0, max: 1000, step: 0.1, showIf: (v) => Boolean(v.enabled) },
          { path: "pointValue", type: "number", label: ["Value of one point (minor units)", "قيمة النقطة (بالوحدات الصغرى)"], hint: ["JOD: 10 = 0.010 JOD", "للدينار: 10 = 0.010 د.أ"], min: 0, showIf: (v) => Boolean(v.enabled) },
          { path: "minRedeemPoints", type: "number", label: ["Minimum points to redeem", "أقل نقاط للاستبدال"], min: 0, showIf: (v) => Boolean(v.enabled) },
          { path: "maxRedeemPercent", type: "number", label: ["Max share of order paid with points", "أقصى نسبة من الطلب بالنقاط"], min: 0, max: 100, suffix: "%", showIf: (v) => Boolean(v.enabled) },
          { path: "signupBonus", type: "number", label: ["Sign-up bonus points", "نقاط ترحيبية عند التسجيل"], min: 0, showIf: (v) => Boolean(v.enabled) },
        ],
      },
    ],
  },
  privacy: {
    group: "privacy",
    title: "s.privacy",
    sections: [
      {
        title: ["Consent & data", "الموافقة والبيانات"],
        fields: [
          { path: "consentBanner", type: "boolean", label: ["Show cookie consent banner", "إظهار شريط موافقة ملفات الارتباط"] },
          { path: "requireConsent", type: "boolean", label: ["Load marketing/analytics tags only after consent", "تحميل أدوات التسويق والتحليل بعد الموافقة فقط"] },
          { path: "firstPartyAnalytics", type: "boolean", label: ["First-party cookieless analytics", "تحليلات ذاتية بدون ملفات ارتباط"] },
          { path: "allowDataExport", type: "boolean", label: ["Customers can export their data", "يمكن للعملاء تصدير بياناتهم"] },
          { path: "allowAccountDeletion", type: "boolean", label: ["Customers can delete their account", "يمكن للعملاء حذف حساباتهم"] },
        ],
      },
    ],
  },
  maintenance: {
    group: "maintenance",
    title: "s.maintenance",
    sections: [
      {
        title: ["Maintenance mode", "وضع الصيانة"],
        description: ["Shoppers see a maintenance page; the admin panel keeps working.", "يرى المتسوقون صفحة صيانة، وتبقى لوحة التحكم تعمل."],
        fields: [
          { path: "enabled", type: "boolean", label: ["Store is in maintenance", "المتجر في وضع الصيانة"] },
          { path: "allowStaff", type: "boolean", label: ["Signed-in staff can browse the store", "يمكن للموظفين المسجلين تصفح المتجر"] },
          { path: "title", type: "localized", label: ["Title", "العنوان"] },
          { path: "message", type: "localizedTextarea", label: ["Message", "الرسالة"] },
          { path: "until", type: "text", label: ["Back by (optional, shown to shoppers)", "العودة بحلول (اختياري)"], placeholder: "2026-10-10 18:00", ltr: true },
        ],
      },
    ],
  },
  geo: {
    group: "geo",
    title: "s.geo",
    sections: [
      {
        title: ["Country detection", "تحديد الدولة"],
        description: ["Pre-selects the phone country code and shipping country. No third-party lookups.", "يحدد رمز الدولة للهاتف ودولة الشحن مسبقاً. بدون خدمات خارجية."],
        fields: [
          { path: "defaultCountry", type: "text", label: ["Fallback country (ISO)", "الدولة الاحتياطية (ISO)"], ltr: true, placeholder: "JO" },
          { path: "detectFromHeaders", type: "boolean", label: ["Detect from CDN headers (Cloudflare, Vercel…)", "التحديد من ترويسات CDN (Cloudflare وVercel…)"] },
        ],
      },
    ],
  },
  email: {
    group: "email",
    title: "s.email",
    sections: [
      {
        title: ["Outgoing mail (SMTP)", "البريد الصادر (SMTP)"],
        fields: [
          { path: "smtp.host", type: "text", label: ["SMTP host", "خادم SMTP"], ltr: true, placeholder: "smtp.example.com" },
          { path: "smtp.port", type: "number", label: ["Port", "المنفذ"], min: 1, max: 65535 },
          { path: "smtp.security", type: "segmented", label: ["Security", "الأمان"], options: [o("starttls", "STARTTLS", "STARTTLS"), o("ssl", "SSL/TLS", "SSL/TLS"), o("none", "None", "بدون")] },
          { path: "smtp.username", type: "text", label: ["Username", "اسم المستخدم"], ltr: true },
          { path: "smtp.password", type: "secret", label: ["Password", "كلمة المرور"] },
          { path: "smtp.fromName", type: "text", label: ["From name", "اسم المرسل"] },
          { path: "smtp.fromEmail", type: "email", label: ["From email", "بريد المرسل"] },
          { path: "smtp.replyTo", type: "email", label: ["Reply-to (optional)", "الرد إلى (اختياري)"] },
        ],
      },
      {
        title: ["Incoming mail (IMAP)", "البريد الوارد (IMAP)"],
        description: ["Optional — used to verify the mailbox connection.", "اختياري — للتحقق من اتصال صندوق البريد."],
        fields: [
          { path: "imap.enabled", type: "boolean", label: ["Enable IMAP", "تفعيل IMAP"] },
          { path: "imap.host", type: "text", label: ["IMAP host", "خادم IMAP"], ltr: true, showIf: (v) => Boolean((v.imap as { enabled?: boolean })?.enabled) },
          { path: "imap.port", type: "number", label: ["Port", "المنفذ"], min: 1, max: 65535, showIf: (v) => Boolean((v.imap as { enabled?: boolean })?.enabled) },
          { path: "imap.security", type: "segmented", label: ["Security", "الأمان"], options: [o("ssl", "SSL/TLS", "SSL/TLS"), o("starttls", "STARTTLS", "STARTTLS"), o("none", "None", "بدون")], showIf: (v) => Boolean((v.imap as { enabled?: boolean })?.enabled) },
          { path: "imap.username", type: "text", label: ["Username", "اسم المستخدم"], ltr: true, showIf: (v) => Boolean((v.imap as { enabled?: boolean })?.enabled) },
          { path: "imap.password", type: "secret", label: ["Password", "كلمة المرور"], showIf: (v) => Boolean((v.imap as { enabled?: boolean })?.enabled) },
        ],
      },
      {
        title: ["Branding", "الهوية"],
        fields: [
          { path: "branding.accentColor", type: "color", label: ["Button & link colour", "لون الأزرار والروابط"] },
          { path: "branding.footer", type: "localizedTextarea", label: ["Email footer", "تذييل البريد"] },
        ],
      },
    ],
  },
};

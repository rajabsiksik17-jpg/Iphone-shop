import { z } from "zod";
import { localized } from "@/lib/i18n-text";

/**
 * Every settings group is a Zod schema with complete defaults, so a fresh
 * install works before anything is configured and reads are always typed.
 * Nested objects use `.prefault({})` so inner defaults are applied.
 */
const lt = (max = 2000) => localized({ max }).prefault({});
const hex = z.string().regex(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i, "Invalid colour");
const emailOrEmpty = z.union([z.string().trim().email(), z.literal("")]);

export const storeSchema = z.object({
  name: lt(120).prefault({ en: "Nuqta", ar: "نقطة" }),
  tagline: lt(200).prefault({ en: "Technology, thoughtfully chosen.", ar: "تقنية مختارة بعناية." }),
  logoUrl: z.string().default(""),
  logoDarkUrl: z.string().default(""),
  faviconUrl: z.string().default(""),
  email: emailOrEmpty.default(""),
  phone: z.string().default(""),
  address: lt(400),
  legalName: z.string().default(""),
  taxNumber: z.string().default(""),
  defaultCountry: z.string().length(2).default("SA"),
  orderNumberPrefix: z.string().max(6).default("NQ"),
  lowStockThreshold: z.coerce.number().int().min(0).max(10_000).default(5),
  newProductDays: z.coerce.number().int().min(0).max(365).default(30),
});

export const appearanceSchema = z.object({
  colors: z
    .object({
      primary: hex.default("#0f172a"),
      primaryForeground: hex.default("#ffffff"),
      accent: hex.default("#4f46e5"),
      accentForeground: hex.default("#ffffff"),
      background: hex.default("#ffffff"),
      surface: hex.default("#f6f7f9"),
      foreground: hex.default("#0b1220"),
      muted: hex.default("#64748b"),
      border: hex.default("#e5e7eb"),
      sale: hex.default("#e11d48"),
      success: hex.default("#059669"),
      warning: hex.default("#d97706"),
    })
    .prefault({}),
  radius: z.coerce.number().int().min(0).max(28).default(14),
  shadow: z.enum(["none", "soft", "medium", "strong"]).default("soft"),
  fontLatin: z.enum(["geist", "inter", "manrope", "dm-sans"]).default("geist"),
  fontArabic: z.enum(["ibm-plex-arabic", "noto-kufi", "tajawal", "cairo"]).default("ibm-plex-arabic"),
  buttonShape: z.enum(["rounded", "pill", "square"]).default("pill"),
  containerWidth: z.coerce.number().int().min(1024).max(1920).default(1360),
  header: z
    .object({
      sticky: z.boolean().default(true),
      style: z.enum(["solid", "blur"]).default("blur"),
      showCategoryBar: z.boolean().default(true),
    })
    .prefault({}),
  productCard: z
    .object({
      style: z.enum(["minimal", "bordered", "elevated"]).default("minimal"),
      imageRatio: z.enum(["1/1", "4/5", "3/4"]).default("1/1"),
      showBrand: z.boolean().default(true),
      showRating: z.boolean().default(true),
      quickAdd: z.boolean().default(true),
      hoverSecondImage: z.boolean().default(true),
    })
    .prefault({}),
  footer: z
    .object({
      style: z.enum(["dark", "light"]).default("dark"),
      about: lt(600).prefault({
        en: "Genuine devices, honest prices and support from people who know tech. Delivered across Saudi Arabia.",
        ar: "أجهزة أصلية، أسعار عادلة، ودعم من أشخاص يفهمون التقنية. توصيل لجميع أنحاء المملكة.",
      }),
      showNewsletter: z.boolean().default(true),
      showPaymentIcons: z.boolean().default(true),
      paymentIcons: z.array(z.string()).default(["mada", "visa", "mastercard", "applepay", "cod"]),
    })
    .prefault({}),
  badges: z
    .object({
      new: hex.default("#4f46e5"),
      sale: hex.default("#e11d48"),
      bestSeller: hex.default("#b45309"),
      limited: hex.default("#0f172a"),
      lowStock: hex.default("#d97706"),
      outOfStock: hex.default("#64748b"),
      showNew: z.boolean().default(true),
      showSale: z.boolean().default(true),
      showBestSeller: z.boolean().default(true),
      showLowStock: z.boolean().default(true),
      salePercent: z.boolean().default(true),
    })
    .prefault({}),
});

export const localizationSchema = z.object({
  defaultLocale: z.enum(["ar", "en"]).default("ar"),
  displayCurrencies: z.array(z.string().length(3)).default([]),
  timezone: z.string().default("Asia/Riyadh"),
  useArabicDigits: z.boolean().default(false),
});

export const seoSchema = z.object({
  titleTemplate: lt(120).prefault({ en: "%s · Nuqta", ar: "%s · نقطة" }),
  defaultTitle: lt(120).prefault({ en: "Nuqta — Phones, laptops & accessories in Saudi Arabia", ar: "نقطة — هواتف ولابتوبات وإكسسوارات في السعودية" }),
  defaultDescription: lt(320).prefault({
    en: "Shop genuine smartphones, tablets, laptops, wearables and accessories with fast delivery across Saudi Arabia and honest prices.",
    ar: "تسوّق هواتف ذكية وأجهزة لوحية ولابتوبات وساعات وإكسسوارات أصلية مع توصيل سريع في المملكة وأسعار عادلة.",
  }),
  ogImageUrl: z.string().default(""),
  twitterHandle: z.string().default(""),
  allowIndexing: z.boolean().default(true),
  robotsDisallow: z.array(z.string()).default([]),
  googleVerification: z.string().default(""),
  bingVerification: z.string().default(""),
  productTitleTemplate: lt(120).prefault({ en: "%name% — %brand%", ar: "%name% — %brand%" }),
});

export const checkoutSchema = z.object({
  guestCheckout: z.boolean().default(true),
  requireTerms: z.boolean().default(true),
  termsPageSlug: z.string().default("terms"),
  privacyPageSlug: z.string().default("privacy"),
  allowOrderNotes: z.boolean().default(true),
  minOrderAmount: z.coerce.number().int().min(0).default(0),
  postalCode: z.enum(["hidden", "optional", "required"]).default("optional"),
  allowedCountries: z.array(z.string().length(2)).default([]),
  holdUnpaidMinutes: z.coerce.number().int().min(5).max(10_080).default(60),
});

export const taxSchema = z.object({
  // Saudi Arabia: 15% VAT, conventionally included in displayed prices.
  enabled: z.boolean().default(true),
  rateBp: z.coerce.number().int().min(0).max(10_000).default(1500),
  pricesIncludeTax: z.boolean().default(true),
  label: lt(60).prefault({ en: "VAT", ar: "ضريبة القيمة المضافة" }),
});

export const loyaltySchema = z.object({
  enabled: z.boolean().default(true),
  // Points earned per 1 major unit of base currency spent.
  pointsPerUnit: z.coerce.number().min(0).max(1000).default(1),
  // Minor units of discount one point is worth (SAR: 1 = 0.01 SAR).
  pointValue: z.coerce.number().int().min(0).default(10),
  minRedeemPoints: z.coerce.number().int().min(0).default(100),
  maxRedeemPercent: z.coerce.number().int().min(0).max(100).default(30),
  signupBonus: z.coerce.number().int().min(0).default(0),
});

const transportSecurity = z.enum(["none", "ssl", "starttls"]);
const statusSchema = z
  .object({ ok: z.boolean(), at: z.string(), message: z.string(), code: z.string().optional() })
  .nullable()
  .default(null);

export const emailSchema = z.object({
  smtp: z
    .object({
      host: z.string().default(""),
      port: z.coerce.number().int().min(1).max(65_535).default(587),
      security: transportSecurity.default("starttls"),
      username: z.string().default(""),
      password: z.string().default(""),
      fromName: z.string().default("Nuqta"),
      fromEmail: emailOrEmpty.default(""),
      replyTo: emailOrEmpty.default(""),
    })
    .prefault({}),
  imap: z
    .object({
      enabled: z.boolean().default(false),
      host: z.string().default(""),
      port: z.coerce.number().int().min(1).max(65_535).default(993),
      security: transportSecurity.default("ssl"),
      username: z.string().default(""),
      password: z.string().default(""),
    })
    .prefault({}),
  smtpStatus: statusSchema,
  imapStatus: statusSchema,
  branding: z
    .object({
      accentColor: hex.default("#0f172a"),
      footer: lt(400),
    })
    .prefault({}),
});

export const securitySchema = z.object({
  adminOtp: z
    .object({
      enabled: z.boolean().default(false),
      channel: z.enum(["email"]).default("email"),
      length: z.coerce.number().int().min(4).max(10).default(6),
      ttlMinutes: z.coerce.number().int().min(1).max(60).default(10),
      maxAttempts: z.coerce.number().int().min(1).max(20).default(5),
      resendCooldownSeconds: z.coerce.number().int().min(10).max(600).default(60),
    })
    .prefault({}),
  login: z
    .object({
      maxFailedAttempts: z.coerce.number().int().min(3).max(50).default(5),
      lockoutMinutes: z.coerce.number().int().min(1).max(1440).default(15),
    })
    .prefault({}),
  sessions: z
    .object({
      adminIdleMinutes: z.coerce.number().int().min(5).max(10_080).default(240),
      adminMaxHours: z.coerce.number().int().min(1).max(720).default(24),
      customerDays: z.coerce.number().int().min(1).max(365).default(30),
    })
    .prefault({}),
  passwordMinLength: z.coerce.number().int().min(8).max(128).default(10),
  alertOnNewAdminLogin: z.boolean().default(true),
});

export const NOTIFICATION_EVENTS = [
  "ORDER_CREATED",
  "ORDER_PAID",
  "ORDER_STATUS_CHANGED",
  "PAYMENT_FAILED",
  "USER_REGISTERED",
  "REVIEW_CREATED",
  "PRODUCT_LOW_STOCK",
  "PRODUCT_OUT_OF_STOCK",
  "CONTACT_SUBMITTED",
  "CHAT_STARTED",
  "ADMIN_LOGIN_FAILED",
  "ADMIN_LOGIN",
  "INTEGRATION_FAILED",
] as const;
export type NotificationEventKey = (typeof NOTIFICATION_EVENTS)[number];

const rule = (inApp: boolean, email: boolean, whatsapp = false) =>
  z
    .object({
      inApp: z.boolean().default(inApp),
      email: z.boolean().default(email),
      whatsapp: z.boolean().default(whatsapp),
    })
    .prefault({});

export const notificationsSchema = z.object({
  // Staff (admin) channel routing per event.
  staff: z
    .object({
      ORDER_CREATED: rule(true, true),
      ORDER_PAID: rule(true, false),
      ORDER_STATUS_CHANGED: rule(false, false),
      PAYMENT_FAILED: rule(true, true),
      USER_REGISTERED: rule(true, false),
      REVIEW_CREATED: rule(true, false),
      PRODUCT_LOW_STOCK: rule(true, true),
      PRODUCT_OUT_OF_STOCK: rule(true, true),
      CONTACT_SUBMITTED: rule(true, true),
      CHAT_STARTED: rule(true, false),
      ADMIN_LOGIN_FAILED: rule(true, false),
      ADMIN_LOGIN: rule(false, false),
      INTEGRATION_FAILED: rule(true, true),
    })
    .prefault({}),
  staffEmails: z.array(z.string().email()).default([]),
  staffWhatsapp: z.array(z.string()).default([]),
  // Customer transactional emails, each individually switchable.
  customer: z
    .object({
      welcome: z.boolean().default(true),
      orderConfirmation: z.boolean().default(true),
      orderStatus: z.boolean().default(true),
      paymentConfirmation: z.boolean().default(true),
      whatsappOrderUpdates: z.boolean().default(false),
    })
    .prefault({}),
  sound: z.boolean().default(true),
});

const dayHours = z.object({
  day: z.number().int().min(0).max(6),
  open: z.string().regex(/^\d{2}:\d{2}$/),
  close: z.string().regex(/^\d{2}:\d{2}$/),
  closed: z.boolean().default(false),
});

const defaultWeek = [0, 1, 2, 3, 4, 5, 6].map((day) => ({ day, open: "10:00", close: "22:00", closed: day === 5 }));

export const chatSchema = z.object({
  enabled: z.boolean().default(true),
  useBusinessHours: z.boolean().default(false),
  hours: z.array(dayHours).default(defaultWeek),
  requireAgentOnline: z.boolean().default(true),
  welcome: lt(400).prefault({ en: "Hi! How can we help you today?", ar: "أهلاً! كيف يمكننا مساعدتك اليوم؟" }),
  waiting: lt(400).prefault({
    en: "Thank you. Our support team has been notified — a team member will join shortly.",
    ar: "شكراً لك. تم إبلاغ فريق الدعم وسينضم إليك أحد أعضاء الفريق قريباً.",
  }),
  offline: lt(400).prefault({
    en: "Our support team is currently offline. Leave us a message and we'll get back to you.",
    ar: "فريق الدعم غير متصل حالياً. اترك لنا رسالة وسنعاود التواصل معك.",
  }),
  maxQueue: z.coerce.number().int().min(1).max(500).default(50),
  autoCloseMinutes: z.coerce.number().int().min(5).max(1440).default(30),
  autoAssign: z.boolean().default(false),
  sound: z.boolean().default(true),
});

const fieldMode = z.enum(["hidden", "optional", "required"]);

export const contactSchema = z.object({
  phone: z.string().default(""),
  email: emailOrEmpty.default(""),
  whatsapp: z.string().default(""),
  address: lt(400),
  hours: lt(400),
  mapEmbedUrl: z.string().default(""),
  form: z
    .object({
      phone: fieldMode.default("optional"),
      subject: fieldMode.default("optional"),
      orderNumber: fieldMode.default("hidden"),
    })
    .prefault({}),
  showLiveChat: z.boolean().default(true),
  showWhatsapp: z.boolean().default(true),
});

export const widgetsSchema = z.object({
  social: z
    .object({
      enabled: z.boolean().default(true),
      side: z.enum(["start", "end"]).default("start"),
      size: z.enum(["sm", "md", "lg"]).default("md"),
      animation: z.enum(["none", "pulse", "float"]).default("float"),
      style: z.enum(["brand", "mono"]).default("brand"),
    })
    .prefault({}),
  support: z
    .object({
      enabled: z.boolean().default(true),
      side: z.enum(["start", "end"]).default("end"),
      whatsapp: z.boolean().default(true),
      liveChat: z.boolean().default(true),
    })
    .prefault({}),
  whatsapp: z
    .object({
      number: z.string().default(""),
      message: lt(300).prefault({ en: "Hello! I have a question about…", ar: "مرحباً! لدي سؤال عن…" }),
    })
    .prefault({}),
});

export const tickerSchema = z.object({
  enabled: z.boolean().default(true),
  speed: z.coerce.number().int().min(10).max(200).default(45),
  direction: z.enum(["auto", "forward", "reverse"]).default("auto"),
  background: hex.default("#0f172a"),
  textColor: hex.default("#f8fafc"),
  pauseOnHover: z.boolean().default(true),
  separator: z.enum(["dot", "diamond", "slash", "none"]).default("dot"),
  fontWeight: z.enum(["normal", "medium", "semibold"]).default("medium"),
});

export const maintenanceSchema = z.object({
  enabled: z.boolean().default(false),
  title: lt(200).prefault({ en: "We'll be right back", ar: "سنعود قريباً" }),
  message: lt(1000).prefault({
    en: "We're making improvements to the store. Thanks for your patience.",
    ar: "نقوم بإجراء تحسينات على المتجر. شكراً لصبرك.",
  }),
  until: z.string().default(""),
  allowStaff: z.boolean().default(true),
});

export const privacySchema = z.object({
  consentBanner: z.boolean().default(true),
  // Analytics/marketing tags wait for consent when true.
  requireConsent: z.boolean().default(true),
  allowDataExport: z.boolean().default(true),
  allowAccountDeletion: z.boolean().default(true),
  firstPartyAnalytics: z.boolean().default(true),
});

export const geoSchema = z.object({
  defaultCountry: z.string().length(2).default("SA"),
  // Detect from CDN/proxy headers (Cloudflare, Vercel, Fastly…). No third-party calls.
  detectFromHeaders: z.boolean().default(true),
});

/** Exchange-rate refresh: configuration plus the last run's outcome (written by the job). */
export const fxSchema = z.object({
  autoUpdate: z.boolean().default(true),
  intervalHours: z.coerce.number().int().min(1).max(168).default(12),
  // Shoppers see prices in their country's currency on first visit (they can always switch).
  currencyByCountry: z.boolean().default(true),
  provider: z.string().default("open.er-api.com"),
  lastAttemptAt: z.string().nullable().default(null),
  lastSuccessAt: z.string().nullable().default(null),
  lastError: z.string().nullable().default(null),
});

export const settingsSchemas = {
  store: storeSchema,
  appearance: appearanceSchema,
  localization: localizationSchema,
  seo: seoSchema,
  checkout: checkoutSchema,
  tax: taxSchema,
  loyalty: loyaltySchema,
  email: emailSchema,
  security: securitySchema,
  notifications: notificationsSchema,
  chat: chatSchema,
  contact: contactSchema,
  widgets: widgetsSchema,
  ticker: tickerSchema,
  maintenance: maintenanceSchema,
  privacy: privacySchema,
  geo: geoSchema,
  fx: fxSchema,
} as const;

export type SettingsGroup = keyof typeof settingsSchemas;
export type Settings<G extends SettingsGroup> = z.infer<(typeof settingsSchemas)[G]>;

/** Dot-paths of secret fields per group: encrypted at rest, masked in the admin UI. */
export const SECRET_FIELDS: Partial<Record<SettingsGroup, string[]>> = {
  email: ["smtp.password", "imap.password"],
};

/** Who may read/write each group. */
export const SETTINGS_PERMISSIONS: Record<SettingsGroup, import("@/config/permissions").Permission> = {
  store: "settings.general",
  appearance: "settings.general",
  localization: "settings.general",
  seo: "settings.general",
  checkout: "settings.general",
  tax: "settings.general",
  loyalty: "marketing.manage",
  email: "settings.email",
  security: "settings.security",
  notifications: "settings.notifications",
  chat: "support.chat",
  contact: "content.manage",
  widgets: "content.manage",
  ticker: "content.manage",
  maintenance: "settings.general",
  privacy: "settings.general",
  geo: "settings.general",
  fx: "settings.general",
};

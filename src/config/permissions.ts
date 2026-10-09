/**
 * Granular admin permissions. Roles are rows in the database holding a list of
 * these keys, so stores can define their own roles; the keys themselves are
 * code because each one guards real server logic.
 */
export const PERMISSIONS = {
  "dashboard.view": "View dashboard",
  "analytics.view": "View analytics & reports",

  "catalog.view": "View catalog",
  "catalog.edit": "Create & edit products, categories, brands, attributes",
  "catalog.delete": "Delete catalog items",
  "inventory.manage": "Adjust inventory",
  "reviews.moderate": "Moderate reviews",

  "orders.view": "View orders",
  "orders.manage": "Update orders & statuses",
  "orders.refund": "Issue refunds",

  "customers.view": "View customers",
  "customers.pii": "See customer contact details & addresses",
  "customers.manage": "Edit, suspend & adjust customers",

  "marketing.manage": "Coupons, promotions & newsletter",
  "content.manage": "Pages, homepage, menus, sliders, announcements, FAQ, social",

  "support.chat": "Handle live chat",
  "support.messages": "Read contact form messages",

  "settings.general": "Store, appearance, localization & SEO settings",
  "settings.shipping": "Shipping settings",
  "settings.payments": "Payment gateways & credentials",
  "settings.email": "Email (SMTP/IMAP) & templates",
  "settings.notifications": "Notification rules",
  "settings.security": "Security settings (OTP, sessions)",
  "settings.integrations": "Third-party integrations",

  "staff.manage": "Manage staff users & roles",
  "audit.view": "View audit & system logs",
} as const;

/**
 * Platform-level authority. These are deliberately NOT in PERMISSIONS: they
 * can't be ticked on any role, so only the super-admin (wildcard) holds them.
 * A store manager with every store permission still can't change the store
 * type or the primary country, or touch super-admin accounts.
 */
export const PLATFORM_PERMISSIONS = {
  "platform.storeType": "Change the store type and manage store-type templates",
  "platform.country": "Set the primary store country and location detection",
  "platform.admins": "See and manage super-admin accounts",
} as const;

export type GrantablePermission = keyof typeof PERMISSIONS;
export type Permission = GrantablePermission | keyof typeof PLATFORM_PERMISSIONS;
/** Permissions a role can be given (platform permissions excluded on purpose). */
export const ALL_PERMISSIONS = Object.keys(PERMISSIONS) as GrantablePermission[];

/** Wildcard granted to the super-admin role. */
export const WILDCARD = "*";

/** Super-admin = holds the wildcard (only the locked super_admin role does). */
export const isSuperAdmin = (granted: readonly string[] | null | undefined) => Boolean(granted?.includes(WILDCARD));

export function hasPermission(granted: readonly string[] | null | undefined, needed: Permission | Permission[]): boolean {
  if (!granted) return false;
  if (granted.includes(WILDCARD)) return true;
  const list = Array.isArray(needed) ? needed : [needed];
  // Platform permissions are wildcard-only, even if a forged role lists them.
  return list.every((p) => !p.startsWith("platform.") && granted.includes(p));
}

export function hasAnyPermission(granted: readonly string[] | null | undefined, needed: Permission[]): boolean {
  if (!granted) return false;
  if (granted.includes(WILDCARD)) return true;
  return needed.some((p) => !p.startsWith("platform.") && granted.includes(p));
}

export const PERMISSION_GROUPS: { key: string; permissions: GrantablePermission[] }[] = [
  { key: "overview", permissions: ["dashboard.view", "analytics.view"] },
  { key: "catalog", permissions: ["catalog.view", "catalog.edit", "catalog.delete", "inventory.manage", "reviews.moderate"] },
  { key: "orders", permissions: ["orders.view", "orders.manage", "orders.refund"] },
  { key: "customers", permissions: ["customers.view", "customers.pii", "customers.manage"] },
  { key: "marketing", permissions: ["marketing.manage", "content.manage"] },
  { key: "support", permissions: ["support.chat", "support.messages"] },
  {
    key: "settings",
    permissions: [
      "settings.general",
      "settings.shipping",
      "settings.payments",
      "settings.email",
      "settings.notifications",
      "settings.security",
      "settings.integrations",
    ],
  },
  { key: "system", permissions: ["staff.manage", "audit.view"] },
];

/** Store manager: everything store-level except security policy (OTP/sessions). */
export const MANAGER_PERMISSIONS: GrantablePermission[] = ALL_PERMISSIONS.filter((p) => p !== "settings.security");
/** The store-manager permissions shipped before v2 — used to upgrade untouched roles. */
export const LEGACY_MANAGER_PERMISSIONS = [
  "dashboard.view", "analytics.view", "catalog.view", "catalog.edit", "inventory.manage", "reviews.moderate",
  "orders.view", "orders.manage", "customers.view", "customers.pii", "marketing.manage", "content.manage",
  "support.chat", "support.messages", "settings.shipping",
];

/** Seeded system roles. Editable afterwards except super_admin. */
export const SYSTEM_ROLES: { key: string; name: { en: string; ar: string }; permissions: string[] }[] = [
  { key: "super_admin", name: { en: "Super Admin", ar: "المدير العام" }, permissions: [WILDCARD] },
  {
    key: "admin",
    name: { en: "Admin", ar: "مدير" },
    permissions: ALL_PERMISSIONS.filter((p) => p !== "staff.manage" && p !== "settings.security"),
  },
  {
    key: "manager",
    name: { en: "Store Manager", ar: "مدير المتجر" },
    // Full day-to-day control of the store; platform settings (store type,
    // primary country) and super-admin accounts stay out of reach.
    permissions: MANAGER_PERMISSIONS,
  },
  {
    key: "content_manager",
    name: { en: "Content Manager", ar: "مدير المحتوى" },
    permissions: ["dashboard.view", "catalog.view", "catalog.edit", "content.manage", "reviews.moderate"],
  },
  {
    key: "order_manager",
    name: { en: "Order Manager", ar: "مدير الطلبات" },
    permissions: ["dashboard.view", "orders.view", "orders.manage", "customers.view", "customers.pii", "catalog.view", "inventory.manage"],
  },
  {
    key: "marketing_manager",
    name: { en: "Marketing Manager", ar: "مدير التسويق" },
    permissions: ["dashboard.view", "analytics.view", "catalog.view", "marketing.manage", "content.manage", "customers.view"],
  },
  {
    key: "support_agent",
    name: { en: "Support Agent", ar: "وكيل الدعم" },
    permissions: ["dashboard.view", "support.chat", "support.messages", "orders.view", "customers.view", "catalog.view"],
  },
];

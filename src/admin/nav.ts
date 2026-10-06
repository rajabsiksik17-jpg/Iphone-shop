import type { Permission } from "@/config/permissions";
import type { AdminKey } from "./i18n";
import type { CounterKey } from "@/server/realtime/emitter";

export type NavItem = {
  key: AdminKey;
  href: string;
  icon: string;
  permission?: Permission | Permission[];
  counter?: CounterKey;
  /** Match child routes for the active state. */
  match?: string;
};

export type NavGroup = { key: AdminKey; items: NavItem[] };

/** Admin information architecture. Items are filtered by the viewer's permissions. */
export const NAV: NavGroup[] = [
  {
    key: "nav.dashboard",
    items: [
      { key: "nav.dashboard", href: "/admin", icon: "LayoutDashboard", permission: "dashboard.view" },
      { key: "nav.analytics", href: "/admin/analytics", icon: "LineChart", permission: "analytics.view" },
    ],
  },
  {
    key: "nav.sales",
    items: [
      { key: "nav.orders", href: "/admin/orders", icon: "ShoppingBag", permission: "orders.view", counter: "orders" },
      { key: "nav.customers", href: "/admin/customers", icon: "Users", permission: "customers.view", counter: "customers" },
    ],
  },
  {
    key: "nav.catalog",
    items: [
      { key: "nav.products", href: "/admin/products", icon: "Package", permission: "catalog.view" },
      { key: "nav.categories", href: "/admin/categories", icon: "FolderTree", permission: "catalog.view" },
      { key: "nav.brands", href: "/admin/brands", icon: "BadgeCheck", permission: "catalog.view" },
      { key: "nav.attributes", href: "/admin/attributes", icon: "SlidersHorizontal", permission: "catalog.view" },
      { key: "nav.inventory", href: "/admin/inventory", icon: "Boxes", permission: "inventory.manage", counter: "inventory" },
      { key: "nav.reviews", href: "/admin/reviews", icon: "Star", permission: "reviews.moderate", counter: "reviews" },
    ],
  },
  {
    key: "nav.marketing",
    items: [
      { key: "nav.coupons", href: "/admin/coupons", icon: "TicketPercent", permission: "marketing.manage" },
      { key: "nav.newsletter", href: "/admin/newsletter", icon: "Mail", permission: "marketing.manage" },
    ],
  },
  {
    key: "nav.content",
    items: [
      { key: "nav.homepage", href: "/admin/pages/home", icon: "Home", permission: "content.manage" },
      { key: "nav.pages", href: "/admin/pages", icon: "FileText", permission: "content.manage", match: "/admin/pages/" },
      { key: "nav.sliders", href: "/admin/sliders", icon: "GalleryHorizontal", permission: "content.manage" },
      { key: "nav.announcements", href: "/admin/announcements", icon: "Megaphone", permission: "content.manage" },
      { key: "nav.menus", href: "/admin/menus", icon: "Menu", permission: "content.manage" },
      { key: "nav.faq", href: "/admin/faq", icon: "CircleHelp", permission: "content.manage" },
      { key: "nav.social", href: "/admin/social", icon: "Share2", permission: "content.manage" },
    ],
  },
  {
    key: "nav.support",
    items: [
      { key: "nav.chat", href: "/admin/chat", icon: "MessagesSquare", permission: "support.chat", counter: "chats" },
      { key: "nav.messages", href: "/admin/messages", icon: "Inbox", permission: "support.messages", counter: "messages" },
    ],
  },
  {
    key: "nav.settings",
    items: [
      { key: "nav.integrations", href: "/admin/integrations", icon: "Plug", permission: "settings.integrations" },
      { key: "nav.settings", href: "/admin/settings", icon: "Settings", permission: ["settings.general"] },
      { key: "nav.staff", href: "/admin/staff", icon: "ShieldCheck", permission: "staff.manage" },
      { key: "nav.security", href: "/admin/security", icon: "ScrollText", permission: "audit.view" },
    ],
  },
];

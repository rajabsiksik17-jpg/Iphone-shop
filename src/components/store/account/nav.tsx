"use client";

import { useTranslations } from "next-intl";
import { LayoutDashboard, Package, MapPin, User, Shield, Heart, MessagesSquare, Bell, Coins, Lock, LogOut } from "lucide-react";
import { Link, usePathname } from "@/i18n/navigation";
import { customerLogoutAction } from "@/actions/auth";
import { cn } from "@/lib/utils";

const ITEMS = [
  { href: "/account", key: "dashboard", icon: LayoutDashboard },
  { href: "/account/orders", key: "orders", icon: Package },
  { href: "/wishlist", key: "wishlist", icon: Heart },
  { href: "/account/addresses", key: "addresses", icon: MapPin },
  { href: "/account/points", key: "points", icon: Coins },
  { href: "/account/notifications", key: "notifications", icon: Bell },
  { href: "/account/conversations", key: "conversations", icon: MessagesSquare },
  { href: "/account/profile", key: "profile", icon: User },
  { href: "/account/security", key: "security", icon: Shield },
  { href: "/account/privacy", key: "privacy", icon: Lock },
] as const;

export function AccountNav({ unread }: { unread: number }) {
  const t = useTranslations();
  const pathname = usePathname();
  return (
    <nav aria-label={t("account.title")}>
      <ul className="no-scrollbar -mx-4 flex gap-1 overflow-x-auto px-4 lg:mx-0 lg:flex-col lg:px-0">
        {ITEMS.map(({ href, key, icon: Icon }) => {
          const active = href === "/account" ? pathname === href : pathname.startsWith(href);
          return (
            <li key={href} className="shrink-0">
              <Link href={href} aria-current={active ? "page" : undefined} className={cn("flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium transition", active ? "bg-primary text-primary-fg" : "text-fg/75 hover:bg-surface hover:text-fg")}>
                <Icon className="size-4" />
                {t(`account.${key}`)}
                {key === "notifications" && unread > 0 && <span className="ms-auto rounded-full bg-sale px-1.5 text-[10px] font-bold leading-4 text-white">{unread}</span>}
              </Link>
            </li>
          );
        })}
        <li className="shrink-0 lg:mt-4 lg:border-t lg:border-border lg:pt-4">
          <button type="button" onClick={async () => (await customerLogoutAction(), window.location.assign(`/${document.documentElement.lang}`))} className="flex w-full items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium text-fg/75 hover:bg-surface hover:text-red-600">
            <LogOut className="size-4" /> {t("common.signOut")}
          </button>
        </li>
      </ul>
    </nav>
  );
}

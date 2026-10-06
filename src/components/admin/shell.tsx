"use client";

import { useEffect, useState, useTransition, type ReactNode } from "react";
import { Bell, ChevronsLeft, ExternalLink, LogOut, Moon, Search, Sun, Monitor, User, Plus, Volume2, VolumeX, Globe, Menu as MenuIcon, X, ShoppingBag, Package, BarChart3, Circle } from "lucide-react";
import * as D from "@radix-ui/react-dialog";
import { Link, usePathname } from "@/i18n/navigation";
import { NAV } from "@/admin/nav";
import { AdminIcon } from "./icon";
import { useAdmin } from "./admin-context";
import { CommandPalette } from "./command-palette";
import { NotificationBell } from "./notification-bell";
import { Dropdown, DropdownContent, DropdownItem, DropdownLabel, DropdownSeparator, DropdownTrigger, TooltipProvider } from "@/components/ui/menu";
import { adminLogoutAction } from "@/actions/auth";
import { setAgentStatusAction } from "@/actions/admin/shell";
import { cn } from "@/lib/utils";

type Theme = "light" | "dark" | "system";

function applyTheme(theme: Theme) {
  const dark = theme === "dark" || (theme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.classList.toggle("ad-dark", dark);
}

function useTheme() {
  const [theme, setThemeState] = useState<Theme>("system");
  useEffect(() => {
    let saved: Theme = "system";
    try {
      saved = (localStorage.getItem("nq:admin-theme") as Theme) ?? "system";
    } catch {
      /* ignore */
    }
    setThemeState(saved);
    applyTheme(saved);
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => applyTheme((localStorage.getItem("nq:admin-theme") as Theme) ?? "system");
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);
  const setTheme = (t: Theme) => {
    setThemeState(t);
    try {
      localStorage.setItem("nq:admin-theme", t);
    } catch {
      /* ignore */
    }
    applyTheme(t);
  };
  return { theme, setTheme };
}

function Badge({ n }: { n: number }) {
  if (!n) return null;
  return <span className="tabular ms-auto grid min-w-5 place-items-center rounded-full bg-ad-accent px-1.5 text-[10.5px] font-semibold leading-5 text-ad-accent-fg animate-scale-in">{n > 99 ? "99+" : n}</span>;
}

function SidebarNav({ collapsed, onNavigate }: { collapsed: boolean; onNavigate?: () => void }) {
  const { t, can, counters } = useAdmin();
  const pathname = usePathname();
  return (
    <nav className="space-y-5 px-3 py-4" aria-label="Admin">
      {NAV.map((group) => {
        const items = group.items.filter((i) => !i.permission || can(i.permission));
        if (!items.length) return null;
        return (
          <div key={group.key}>
            {!collapsed && <p className="mb-1.5 px-2.5 text-[11px] font-semibold uppercase tracking-wider text-ad-muted/80">{t(group.key)}</p>}
            <ul className="space-y-0.5">
              {items.map((item) => {
                const active = item.href === "/admin" ? pathname === "/admin" : item.match ? pathname.startsWith(item.match) && pathname !== "/admin/pages/home" : pathname === item.href || pathname.startsWith(`${item.href}/`);
                const n = item.counter ? counters[item.counter] : 0;
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      onClick={onNavigate}
                      title={collapsed ? t(item.key) : undefined}
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "group relative flex h-9 items-center gap-3 rounded-lg px-2.5 text-[13.5px] font-medium transition",
                        active ? "bg-ad-hover text-ad-fg" : "text-ad-muted hover:bg-ad-hover hover:text-ad-fg",
                        collapsed && "justify-center px-0",
                      )}
                    >
                      {active && <span className="absolute inset-y-1.5 start-0 w-[3px] rounded-full bg-ad-accent" />}
                      <AdminIcon name={item.icon} className="size-[18px] shrink-0" />
                      {!collapsed && <span className="truncate">{t(item.key)}</span>}
                      {!collapsed ? <Badge n={n} /> : n > 0 && <span className="absolute end-1.5 top-1.5 size-2 rounded-full bg-ad-accent" />}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
    </nav>
  );
}

function AgentStatus() {
  const { t, user, can } = useAdmin();
  const [status, setStatus] = useState(user.agentStatus);
  const [, start] = useTransition();
  if (!can("support.chat")) return null;
  const color = { ONLINE: "text-emerald-500", AWAY: "text-amber-500", OFFLINE: "text-ad-muted" }[status];
  return (
    <>
      <DropdownLabel>{t("chat.myStatus")}</DropdownLabel>
      {(["ONLINE", "AWAY", "OFFLINE"] as const).map((s) => (
        <DropdownItem key={s} onSelect={() => (setStatus(s), start(async () => void (await setAgentStatusAction(s))))}>
          <Circle className={cn("!size-2.5 fill-current", { ONLINE: "!text-emerald-500", AWAY: "!text-amber-500", OFFLINE: "!text-ad-muted" }[s])} />
          {t(`c.${s.toLowerCase() as "online" | "away" | "offline"}`)}
          {status === s && <span className={cn("ms-auto text-xs", color)}>●</span>}
        </DropdownItem>
      ))}
      <DropdownSeparator />
    </>
  );
}

function UserMenu() {
  const { t, user, locale, sound, setSound } = useAdmin();
  const { theme, setTheme } = useTheme();
  const pathname = usePathname();
  const other = locale === "ar" ? "en" : "ar";
  return (
    <Dropdown>
      <DropdownTrigger className="flex items-center gap-2 rounded-full p-0.5 pe-2 transition hover:bg-ad-hover data-[state=open]:bg-ad-hover">
        {user.avatar ? <img src={user.avatar} alt="" className="size-8 rounded-full object-cover" /> : <span className="grid size-8 place-items-center rounded-full bg-ad-accent text-sm font-semibold text-ad-accent-fg">{user.name.slice(0, 1).toUpperCase()}</span>}
        <span className="hidden whitespace-nowrap text-start text-[13px] leading-tight xl:block">
          <span className="block font-medium text-ad-fg">{user.name}</span>
          <span className="block text-ad-muted">{user.role}</span>
        </span>
      </DropdownTrigger>
      <DropdownContent className="w-60">
        <div className="px-3 py-2">
          <p className="text-sm font-semibold">{user.name}</p>
          <p className="truncate text-xs text-ad-muted">{user.email}</p>
        </div>
        <DropdownSeparator />
        <AgentStatus />
        <DropdownItem asChild>
          <Link href="/admin/profile">
            <User /> {t("nav.profile")}
          </Link>
        </DropdownItem>
        <DropdownItem asChild>
          <Link href={pathname} locale={other}>
            <Globe /> {other === "ar" ? "العربية" : "English"}
          </Link>
        </DropdownItem>
        <DropdownItem onSelect={(e) => (e.preventDefault(), setSound(!sound))}>
          {sound ? <Volume2 /> : <VolumeX />} {t("notif.sound")}
          <span className="ms-auto text-xs text-ad-muted">{sound ? t("c.enabled") : t("c.disabled")}</span>
        </DropdownItem>
        <DropdownSeparator />
        <DropdownLabel>{t("c.theme")}</DropdownLabel>
        <div className="grid grid-cols-3 gap-1 px-1.5 pb-1.5">
          {(
            [
              ["light", Sun],
              ["dark", Moon],
              ["system", Monitor],
            ] as const
          ).map(([k, Icon]) => (
            <button key={k} type="button" onClick={() => setTheme(k)} className={cn("flex flex-col items-center gap-1 rounded-lg py-2 text-[11px] transition", theme === k ? "bg-ad-hover text-ad-fg" : "text-ad-muted hover:bg-ad-hover")}>
              <Icon className="size-4" />
              {t(`c.${k}`)}
            </button>
          ))}
        </div>
        <DropdownSeparator />
        <DropdownItem onSelect={async () => (await adminLogoutAction(), window.location.assign(`/${locale}/admin/login`))}>
          <LogOut /> {t("c.signOut")}
        </DropdownItem>
      </DropdownContent>
    </Dropdown>
  );
}

function ConnectionDot() {
  const { connection, t } = useAdmin();
  const color = { connected: "bg-emerald-500", reconnecting: "bg-amber-500 animate-pulse", connecting: "bg-amber-400 animate-pulse", offline: "bg-red-500" }[connection];
  return (
    <span className="hidden items-center gap-1.5 rounded-full px-2 py-1 text-[11px] text-ad-muted sm:flex" title={t(`c.connection.${connection}`)}>
      <span className={cn("size-1.5 rounded-full", color)} />
      {t(`c.connection.${connection}`)}
    </span>
  );
}

/** Thumb-reachable quick actions on phones. */
function MobileQuickBar() {
  const { t, can, counters } = useAdmin();
  const pathname = usePathname();
  const items = [
    { href: "/admin", icon: BarChart3, label: t("nav.dashboard"), show: can("dashboard.view") },
    { href: "/admin/orders", icon: ShoppingBag, label: t("nav.orders"), show: can("orders.view"), n: counters.orders },
    { href: "/admin/products/new", icon: Plus, label: t("p.new"), show: can("catalog.edit"), primary: true },
    { href: "/admin/products", icon: Package, label: t("nav.products"), show: can("catalog.view") },
    { href: "/admin/chat", icon: Bell, label: t("nav.chat"), show: can("support.chat"), n: counters.chats },
  ].filter((i) => i.show);
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-ad-border bg-ad-panel/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl lg:hidden" aria-label={t("c.quickActions")}>
      <div className="flex h-16 items-center">
        {items.map(({ href, icon: Icon, label, n, primary }) => {
          const active = href === "/admin" ? pathname === href : pathname.startsWith(href);
          return primary ? (
            <Link key={href} href={href} className="flex flex-1 justify-center" aria-label={label}>
              <span className="grid size-12 -translate-y-3 place-items-center rounded-2xl bg-ad-accent text-ad-accent-fg shadow-lg">
                <Icon className="size-6" />
              </span>
            </Link>
          ) : (
            <Link key={href} href={href} className={cn("relative flex flex-1 flex-col items-center gap-0.5 text-[10.5px] font-medium", active ? "text-ad-fg" : "text-ad-muted")}>
              <Icon className="size-[22px]" />
              {label}
              {n ? <span className="absolute top-1 ms-6 grid min-w-4 place-items-center rounded-full bg-ad-accent px-1 text-[9.5px] font-bold leading-4 text-ad-accent-fg">{n}</span> : null}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

export function AdminShell({ children }: { children: ReactNode }) {
  const { t, locale, storeName } = useAdmin();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    try {
      setCollapsed(localStorage.getItem("nq:admin-collapsed") === "1");
    } catch {
      /* ignore */
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setPaletteOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  useEffect(() => setMobileOpen(false), [pathname]);

  const toggleCollapsed = () => {
    setCollapsed((c) => {
      try {
        localStorage.setItem("nq:admin-collapsed", c ? "0" : "1");
      } catch {
        /* ignore */
      }
      return !c;
    });
  };

  const brand = (
    <Link href="/admin" className="flex h-14 items-center gap-2.5 px-4 text-ad-fg">
      <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-ad-fg text-sm font-bold text-ad-panel">{storeName.slice(0, 1)}</span>
      {!collapsed && <span className="truncate text-[15px] font-semibold tracking-tight">{storeName}</span>}
    </Link>
  );

  return (
    <TooltipProvider>
      <div className="min-h-dvh bg-ad-bg text-ad-fg">
        <aside className={cn("fixed inset-y-0 start-0 z-30 hidden flex-col border-e border-ad-border bg-ad-panel transition-[width] duration-300 lg:flex", collapsed ? "w-[68px]" : "w-64")}>
          {brand}
          <div className="min-h-0 flex-1 overflow-y-auto [scrollbar-width:thin]">
            <SidebarNav collapsed={collapsed} />
          </div>
          <div className="border-t border-ad-border p-3">
            <a href={`/${locale}`} target="_blank" rel="noopener" className={cn("flex h-9 items-center gap-3 rounded-lg px-2.5 text-[13px] text-ad-muted hover:bg-ad-hover hover:text-ad-fg", collapsed && "justify-center px-0")}>
              <ExternalLink className="size-4" /> {!collapsed && t("nav.viewStore")}
            </a>
            <button type="button" onClick={toggleCollapsed} className={cn("flex h-9 w-full items-center gap-3 rounded-lg px-2.5 text-[13px] text-ad-muted hover:bg-ad-hover hover:text-ad-fg", collapsed && "justify-center px-0")} aria-label={t("nav.collapse")}>
              <ChevronsLeft className={cn("size-4 transition rtl:rotate-180", collapsed && "rotate-180 rtl:rotate-0")} /> {!collapsed && t("nav.collapse")}
            </button>
          </div>
        </aside>

        <D.Root open={mobileOpen} onOpenChange={setMobileOpen}>
          <D.Portal>
            <D.Overlay className="sheet-overlay fixed inset-0 z-[70] bg-black/40 lg:hidden" />
            <D.Content data-side="start" aria-describedby={undefined} className="sheet fixed inset-y-0 start-0 z-[71] flex w-[min(300px,85vw)] flex-col bg-ad-panel lg:hidden">
              <D.Title className="sr-only">Menu</D.Title>
              <div className="flex items-center justify-between pe-2">
                {brand}
                <D.Close className="grid size-10 place-items-center rounded-lg text-ad-muted hover:bg-ad-hover" aria-label={t("c.close")}>
                  <X className="size-5" />
                </D.Close>
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto">
                <SidebarNav collapsed={false} onNavigate={() => setMobileOpen(false)} />
              </div>
            </D.Content>
          </D.Portal>
        </D.Root>

        <div className={cn("transition-[padding] duration-300", collapsed ? "lg:ps-[68px]" : "lg:ps-64")}>
          <header className="sticky top-0 z-20 flex h-14 items-center gap-2 border-b border-ad-border bg-ad-panel/85 px-3 backdrop-blur-xl sm:px-5">
            <button type="button" onClick={() => setMobileOpen(true)} className="grid size-9 place-items-center rounded-lg text-ad-muted hover:bg-ad-hover lg:hidden" aria-label="Menu">
              <MenuIcon className="size-5" />
            </button>
            <button type="button" onClick={() => setPaletteOpen(true)} className="flex h-9 min-w-0 max-w-md flex-1 items-center gap-2.5 rounded-lg border border-ad-border bg-ad-sunken px-3 text-start text-[13px] text-ad-muted transition hover:border-ad-muted/40">
              <Search className="size-4" />
              <span className="flex-1 truncate">{t("cmd.placeholder")}</span>
              <kbd className="hidden rounded border border-ad-border bg-ad-panel px-1.5 py-0.5 font-sans text-[10.5px] sm:inline">⌘K</kbd>
            </button>
            <div className="ms-auto flex items-center gap-1">
              <ConnectionDot />
              <Link href="/admin/products/new" className="hidden h-9 items-center gap-1.5 whitespace-nowrap rounded-lg bg-ad-fg px-3 text-[13px] font-medium text-ad-panel transition hover:opacity-90 md:flex">
                <Plus className="size-4" /> {t("p.new")}
              </Link>
              <NotificationBell />
              <UserMenu />
            </div>
          </header>
          <main className="mx-auto w-full max-w-[1480px] px-3 pb-28 pt-5 sm:px-5 lg:px-8 lg:pb-12 lg:pt-7">{children}</main>
        </div>
        <MobileQuickBar />
        <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} />
      </div>
    </TooltipProvider>
  );
}


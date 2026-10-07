"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { ArrowLeft, ChevronDown, ChevronLeft, Grid2x2, Heart, Home, LayoutGrid, LogOut, Menu, Package, Search, ShoppingBag, Sparkles, Truck, User, Coins, X } from "lucide-react";
import * as D from "@radix-ui/react-dialog";
import { Link, usePathname, useRouter } from "@/i18n/navigation";
import { useStore } from "@/components/providers/store-context";
import { Dropdown, DropdownContent, DropdownItem, DropdownSeparator, DropdownTrigger } from "@/components/ui/menu";
import { WishlistLink } from "./wishlist-button";
import { SearchOverlay } from "./search-overlay";
import { CurrencyList, CurrencySelect, LanguageList, LanguageSelect } from "./locale-controls";
import { customerLogoutAction } from "@/actions/auth";
import { cn } from "@/lib/utils";
import type { ResolvedMenuItem } from "@/server/cms/queries";

type Props = {
  storeName: string;
  logoUrl: string;
  menu: ResolvedMenuItem[];
  topLinks: ResolvedMenuItem[];
  freeShippingText: string | null;
  sticky: boolean;
  blur: boolean;
  showCategoryBar: boolean;
};

export function Logo({ name, url, className }: { name: string; url: string; className?: string }) {
  if (url) return <img src={url} alt={name} className={cn("h-8 w-auto", className)} />;
  return (
    <span className={cn("text-[22px] font-bold tracking-[-0.04em]", className)}>
      {name}
      <span className="text-accent">.</span>
    </span>
  );
}

function Thumb({ src, className }: { src: string | null; className?: string }) {
  return (
    <span className={cn("grid shrink-0 place-items-center overflow-hidden rounded-xl bg-surface", className)}>
      {src ? <img src={src} alt="" loading="lazy" className="size-full object-cover" /> : <LayoutGrid className="size-1/2 text-muted" />}
    </span>
  );
}

/** Small product count next to a category name (hidden when unknown or zero). */
function Count({ n }: { n?: number }) {
  if (!n) return null;
  return <span className="tabular text-xs text-muted">{n}</span>;
}

function Badge({ text }: { text: string | null }) {
  if (!text) return null;
  return <span className="rounded-full bg-sale px-1.5 py-px text-[10px] font-bold uppercase leading-4 text-white">{text}</span>;
}

// ─────────────────────────────── Account & cart ─────────────────────────────

function AccountMenu() {
  const t = useTranslations();
  const { user } = useStore();
  const router = useRouter();
  if (!user)
    return (
      <Link href="/account/login" className="flex h-10 items-center gap-2 rounded-full px-2.5 text-sm font-medium transition hover:bg-surface" aria-label={t("common.signIn")}>
        <User className="size-[21px]" strokeWidth={1.75} />
        <span className="hidden xl:inline">{t("common.signIn")}</span>
      </Link>
    );
  return (
    <Dropdown>
      <DropdownTrigger className="flex h-10 items-center gap-2 rounded-full px-1.5 transition hover:bg-surface data-[state=open]:bg-surface xl:pe-3" aria-label={t("common.account")}>
        <span className="grid size-7 place-items-center rounded-full bg-primary text-xs font-semibold text-primary-fg">{user.name.slice(0, 1).toUpperCase()}</span>
        <span className="hidden max-w-24 truncate text-sm font-medium xl:inline">{user.name.split(" ")[0]}</span>
      </DropdownTrigger>
      <DropdownContent>
        <div className="px-3 py-2">
          <p className="text-sm font-semibold">{t("header.hi", { name: user.name.split(" ")[0] })}</p>
          <p className="truncate text-xs text-muted">{user.email}</p>
        </div>
        <DropdownSeparator />
        <DropdownItem asChild>
          <Link href="/account">
            <User /> {t("header.myAccount")}
          </Link>
        </DropdownItem>
        <DropdownItem asChild>
          <Link href="/account/orders">
            <Package /> {t("header.orders")}
          </Link>
        </DropdownItem>
        <DropdownItem asChild>
          <Link href="/account/points">
            <Coins /> {t("account.points")}
          </Link>
        </DropdownItem>
        <DropdownSeparator />
        <DropdownItem onSelect={async () => (await customerLogoutAction(), router.refresh())}>
          <LogOut /> {t("common.signOut")}
        </DropdownItem>
      </DropdownContent>
    </Dropdown>
  );
}

function CartButton({ className }: { className?: string }) {
  const t = useTranslations("common");
  const { cartCount, setCartOpen } = useStore();
  const [bump, setBump] = useState(false);
  const prev = useRef(cartCount);
  useEffect(() => {
    if (cartCount > prev.current) setBump(true);
    prev.current = cartCount;
  }, [cartCount]);
  return (
    <button type="button" onClick={() => setCartOpen(true)} className={cn("relative grid size-10 place-items-center rounded-full transition hover:bg-surface", className)} aria-label={`${t("cart")} (${cartCount})`}>
      <ShoppingBag className="size-[22px]" strokeWidth={1.75} />
      {cartCount > 0 && (
        <span onAnimationEnd={() => setBump(false)} className={cn("absolute end-0.5 top-0.5 grid min-w-[18px] place-items-center rounded-full bg-accent px-1 text-[10.5px] font-bold leading-[18px] text-accent-fg", bump && "animate-bump")}>
          {cartCount > 99 ? "99+" : cartCount}
        </span>
      )}
    </button>
  );
}

// ─────────────────────────────── Desktop mega menu ──────────────────────────

/** Category panel: roots on the side (when several), active root's subcategories as visual columns. */
function CategoryPanel({ item, onNavigate }: { item: ResolvedMenuItem; onNavigate: () => void }) {
  const t = useTranslations("header");
  // "All categories" lists roots with their own children; a single category lists its children directly.
  const multi = item.kind === "all-categories";
  const [active, setActive] = useState(0);
  const root = multi ? item.children[active] : item;
  const columns = root?.children ?? [];
  return (
    <div className={cn("grid min-h-[22rem]", multi ? "grid-cols-[17rem_1fr]" : "grid-cols-1")}>
      {multi && (
        <ul className="border-e border-border bg-surface/60 p-2">
          {item.children.map((c, i) => (
            <li key={c.id}>
              <Link
                href={c.href}
                onMouseEnter={() => setActive(i)}
                onFocus={() => setActive(i)}
                onClick={onNavigate}
                className={cn("flex items-center gap-3 rounded-xl px-2.5 py-2 text-[14px] font-medium transition", i === active ? "bg-bg text-fg shadow-sm" : "text-fg/75 hover:text-fg")}
              >
                <Thumb src={c.image} className="size-9" />
                <span className="flex-1">{c.label}</span>
                <Count n={c.count} />
                {c.children.length > 0 && <ChevronLeft className="size-4 text-muted ltr:rotate-180" />}
              </Link>
            </li>
          ))}
        </ul>
      )}
      <div className="p-6">
        <div className="mb-5 flex items-center justify-between">
          <h3 className="text-lg font-semibold tracking-tight">{root?.label}</h3>
          <Link href={root?.href ?? item.href} onClick={onNavigate} className="flex items-center gap-1.5 text-sm font-medium text-accent hover:underline">
            {t("shopAll", { name: root?.label ?? "" })}
            <ArrowLeft className="size-4 ltr:rotate-180" />
          </Link>
        </div>
        {columns.length ? (
          <div className="grid grid-cols-3 gap-x-6 gap-y-5 xl:grid-cols-4">
            {columns.map((c) => (
              <div key={c.id} className="min-w-0">
                <Link href={c.href} onClick={onNavigate} className="group flex items-center gap-3">
                  <Thumb src={c.image} className="size-12 transition group-hover:scale-[1.04]" />
                  <span className="min-w-0">
                    <span className="block text-[14px] font-semibold leading-snug group-hover:text-accent">{c.label}</span>
                    {c.count ? <span className="text-xs text-muted">{t("productCount", { count: c.count })}</span> : null}
                  </span>
                </Link>
                {c.children.length > 0 && (
                  <ul className="mt-2 space-y-1 ps-[3.75rem]">
                    {c.children.slice(0, 6).map((g) => (
                      <li key={g.id}>
                        <Link href={g.href} onClick={onNavigate} className="text-[13px] text-muted transition hover:text-fg">
                          {g.label}
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </div>
        ) : (
          <Link href={root?.href ?? item.href} onClick={onNavigate} className="block overflow-hidden rounded-2xl bg-surface">
            <Thumb src={root?.image ?? null} className="aspect-[16/7] w-full rounded-none" />
          </Link>
        )}
      </div>
    </div>
  );
}

function BrandPanel({ item, onNavigate }: { item: ResolvedMenuItem; onNavigate: () => void }) {
  const t = useTranslations("common");
  return (
    <div className="p-6">
      <div className="mb-5 flex items-center justify-between">
        <h3 className="text-lg font-semibold tracking-tight">{item.label}</h3>
        <Link href={item.href} onClick={onNavigate} className="flex items-center gap-1.5 text-sm font-medium text-accent hover:underline">
          {t("allBrands")}
          <ArrowLeft className="size-4 ltr:rotate-180" />
        </Link>
      </div>
      <div className="grid grid-cols-6 gap-3">
        {item.children.map((b) => (
          <Link key={b.id} href={b.href} onClick={onNavigate} title={b.label} className="grid h-20 place-items-center rounded-2xl border border-border px-4 transition hover:-translate-y-0.5 hover:border-fg/20 hover:shadow-card">
            {b.image ? <img src={b.image} alt={b.label} loading="lazy" className="max-h-8 w-full object-contain" /> : <span className="text-sm font-semibold">{b.label}</span>}
          </Link>
        ))}
      </div>
    </div>
  );
}

function NavItem({ item, open, onOpen, onClose }: { item: ResolvedMenuItem; open: boolean; onOpen: () => void; onClose: () => void }) {
  const hasPanel = item.children.length > 0;
  const base = cn("relative flex h-12 shrink-0 items-center gap-1.5 whitespace-nowrap px-2.5 text-[14.5px] xl:px-3 font-medium transition", item.highlight ? "text-sale hover:text-sale" : "text-fg/80 hover:text-fg", open && "text-fg");
  if (!hasPanel)
    return (
      <Link href={item.href} className={base} target={item.newTab ? "_blank" : undefined}>
        {item.highlight && <Sparkles className="size-4" />}
        {item.label}
        <Badge text={item.badge} />
      </Link>
    );
  return (
    <Link
      href={item.href}
      className={base}
      aria-expanded={open}
      aria-haspopup="true"
      onMouseEnter={onOpen}
      onFocus={onOpen}
      onKeyDown={(e) => {
        if (e.key === "Escape") onClose();
      }}
    >
      {item.kind === "all-categories" && <Grid2x2 className="size-4" />}
      {item.label}
      <Badge text={item.badge} />
      <ChevronDown className={cn("size-3.5 transition-transform", open && "rotate-180")} />
      <span className={cn("absolute inset-x-3 bottom-0 h-0.5 rounded-full bg-fg transition", open ? "scale-x-100" : "scale-x-0")} />
    </Link>
  );
}

function DesktopNav({ menu }: { menu: ResolvedMenuItem[] }) {
  const [openId, setOpenId] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const pathname = usePathname();
  // Hover intent: small delays prevent flicker when the pointer crosses items.
  const openSoon = (id: string) => {
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setOpenId(id), openId ? 0 : 90);
  };
  const closeSoon = () => {
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setOpenId(null), 160);
  };
  useEffect(() => setOpenId(null), [pathname]);
  const active = menu.find((m) => m.id === openId);
  return (
    <div onMouseLeave={closeSoon} onMouseEnter={() => clearTimeout(timer.current)} className="relative">
      <div className="container-store no-scrollbar flex items-center overflow-x-auto">
        {menu.map((item) => (
          <NavItem key={item.id} item={item} open={openId === item.id} onOpen={() => (item.children.length ? openSoon(item.id) : closeSoon())} onClose={() => setOpenId(null)} />
        ))}
      </div>
      {active && active.children.length > 0 && (
        <div className="absolute inset-x-0 top-full z-50 pt-px" onMouseEnter={() => clearTimeout(timer.current)}>
          <div className="container-store">
            <div className="pop overflow-hidden rounded-b-3xl border border-t-0 border-border bg-bg shadow-pop" data-state="open">
              {active.kind === "brands" ? <BrandPanel item={active} onNavigate={() => setOpenId(null)} /> : <CategoryPanel key={active.id} item={active} onNavigate={() => setOpenId(null)} />}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────── Mobile drawer ──────────────────────────────

type Panel = { title: string; href: string; items: ResolvedMenuItem[] };

/** Drawer row: drills into children when there are any, otherwise navigates. */
function DrawerRow({ item, onDrill, onNavigate }: { item: ResolvedMenuItem; onDrill: (i: ResolvedMenuItem) => void; onNavigate: () => void }) {
  return item.children.length ? (
    <button type="button" onClick={() => onDrill(item)} className="flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-start text-[15px] font-medium transition active:bg-surface">
      {item.image !== null || item.kind !== "link" ? <Thumb src={item.image} className="size-10" /> : null}
      <span className={cn("flex-1", item.highlight && "text-sale")}>{item.label}</span>
      <Badge text={item.badge} />
      <Count n={item.count} />
      <ChevronLeft className="size-5 text-muted ltr:rotate-180" />
    </button>
  ) : (
    <Link href={item.href} onClick={onNavigate} className="flex items-center gap-3 rounded-2xl px-3 py-2.5 text-[15px] font-medium transition active:bg-surface">
      {item.image ? <Thumb src={item.image} className="size-10" /> : null}
      <span className={cn("flex-1", item.highlight && "text-sale")}>{item.label}</span>
      <Badge text={item.badge} />
    </Link>
  );
}

/**
 * Layered navigation: each level slides in over the previous one with a clear
 * back button, so deep category trees stay easy to browse with one thumb.
 */
function MobileDrawer({ open, onOpenChange, storeName, menu, topLinks, startAtCategories }: { open: boolean; onOpenChange: (o: boolean) => void; storeName: string; menu: ResolvedMenuItem[]; topLinks: ResolvedMenuItem[]; startAtCategories: boolean }) {
  const t = useTranslations();
  const { user } = useStore();
  const [stack, setStack] = useState<Panel[]>([]);
  const close = () => onOpenChange(false);
  const allCategories = menu.find((m) => m.kind === "all-categories");

  useEffect(() => {
    if (!open) return;
    setStack(startAtCategories && allCategories ? [{ title: allCategories.label, href: allCategories.href, items: allCategories.children }] : []);
  }, [open, startAtCategories, allCategories]);

  const push = (i: ResolvedMenuItem) => setStack((s) => [...s, { title: i.label, href: i.href, items: i.children }]);
  const pop = () => setStack((s) => s.slice(0, -1));
  const panel = stack.at(-1);

  return (
    <D.Root open={open} onOpenChange={onOpenChange}>
      <D.Portal>
        <D.Overlay className="sheet-overlay fixed inset-0 z-[70] bg-black/40 backdrop-blur-[2px]" />
        <D.Content aria-describedby={undefined} className="sheet fixed inset-y-0 start-0 z-[71] flex w-[min(24rem,92vw)] flex-col bg-bg shadow-pop outline-none" data-side="start">
          <div className="flex h-16 items-center gap-2 border-b border-border px-3">
            {panel ? (
              <button type="button" onClick={pop} className="flex h-10 items-center gap-1.5 rounded-full px-2 text-sm font-medium hover:bg-surface" aria-label={t("common.back")}>
                <ArrowLeft className="size-5 rtl:rotate-180" />
                {t("common.back")}
              </button>
            ) : (
              <D.Title className="px-1">
                <Logo name={storeName} url="" className="text-xl" />
              </D.Title>
            )}
            {panel && <D.Title className="sr-only">{panel.title}</D.Title>}
            <D.Close className="ms-auto grid size-10 place-items-center rounded-full hover:bg-surface" aria-label={t("common.close")}>
              <X className="size-5" />
            </D.Close>
          </div>

          <div key={stack.length} className="panel-in min-h-0 flex-1 overflow-y-auto px-2 py-3">
            {panel ? (
              <>
                <Link href={panel.href} onClick={close} className="mb-2 flex items-center justify-between rounded-2xl bg-surface px-4 py-3 text-[15px] font-semibold">
                  {t("header.shopAll", { name: panel.title })}
                  <ArrowLeft className="size-4 ltr:rotate-180" />
                </Link>
                <nav aria-label={panel.title}>
                  {panel.items.map((i) => (
                    <DrawerRow key={i.id} item={i} onDrill={push} onNavigate={close} />
                  ))}
                </nav>
              </>
            ) : (
              <div className="space-y-5">
                {user ? (
                  <Link href="/account" onClick={close} className="mx-1 flex items-center gap-3 rounded-2xl bg-surface p-3">
                    <span className="grid size-11 place-items-center rounded-full bg-primary font-semibold text-primary-fg">{user.name.slice(0, 1)}</span>
                    <span>
                      <span className="block text-sm font-semibold">{user.name}</span>
                      <span className="block text-xs text-muted">{t("header.myAccount")}</span>
                    </span>
                  </Link>
                ) : (
                  <div className="mx-1 grid grid-cols-2 gap-2">
                    <Link href="/account/login" onClick={close} className="rounded-full bg-primary py-3 text-center text-sm font-medium text-primary-fg">
                      {t("common.signIn")}
                    </Link>
                    <Link href="/account/register" onClick={close} className="rounded-full border border-border py-3 text-center text-sm font-medium">
                      {t("common.register")}
                    </Link>
                  </div>
                )}
                <nav aria-label={t("common.categories")}>
                  <Link href="/" onClick={close} className="flex items-center gap-3 rounded-2xl px-3 py-2.5 text-[15px] font-medium active:bg-surface">
                    <span className="grid size-10 place-items-center rounded-xl bg-surface">
                      <Home className="size-5" />
                    </span>
                    {t("common.home")}
                  </Link>
                  {menu.map((i) => (
                    <DrawerRow key={i.id} item={i} onDrill={push} onNavigate={close} />
                  ))}
                </nav>
                {topLinks.length > 0 && (
                  <nav className="border-t border-border pt-3" aria-label={t("header.help")}>
                    {topLinks.map((i) => (
                      <Link key={i.id} href={i.href} onClick={close} className="block rounded-xl px-3 py-2.5 text-[15px] text-fg/80 active:bg-surface">
                        {i.label}
                      </Link>
                    ))}
                  </nav>
                )}
                <div className="space-y-3 border-t border-border px-2 pt-4">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted">{t("common.language")}</p>
                  <LanguageList />
                  <p className="pt-2 text-xs font-semibold uppercase tracking-wider text-muted">{t("common.currency")}</p>
                  <CurrencyList />
                </div>
              </div>
            )}
          </div>
        </D.Content>
      </D.Portal>
    </D.Root>
  );
}

// ─────────────────────────────────── Header ─────────────────────────────────

/**
 * Store header.
 * Desktop: utility bar (shipping note, help links, currency, language) →
 * main row (logo, prominent search, account, wishlist, cart) → navigation
 * with mega menus. Mobile: compact bar + always-visible search pill.
 * On scroll the navigation/search rows tuck away going down and return going
 * up, keeping the essentials (logo, search, cart) one tap away.
 */
export function Header({ storeName, logoUrl, menu, topLinks, freeShippingText, sticky, blur, showCategoryBar }: Props) {
  const t = useTranslations();
  const [drawer, setDrawer] = useState<{ open: boolean; categories: boolean }>({ open: false, categories: false });
  const [searchOpen, setSearchOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [tucked, setTucked] = useState(false);
  const lastY = useRef(0);

  const onScroll = useCallback(() => {
    const y = window.scrollY;
    setScrolled(y > 8);
    // Hysteresis avoids flicker on small scroll jitters.
    if (y > 160 && y > lastY.current + 6) setTucked(true);
    else if (y < lastY.current - 6 || y < 120) setTucked(false);
    lastY.current = y;
  }, []);

  useEffect(() => {
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if ((e.key === "k" && (e.metaKey || e.ctrlKey)) || (e.key === "/" && tag !== "INPUT" && tag !== "TEXTAREA")) {
        e.preventDefault();
        setSearchOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    const openSearch = () => setSearchOpen(true);
    const openCategories = () => setDrawer({ open: true, categories: true });
    window.addEventListener("nq:open-search", openSearch);
    window.addEventListener("nq:open-categories", openCategories);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("nq:open-search", openSearch);
      window.removeEventListener("nq:open-categories", openCategories);
    };
  }, [onScroll]);

  return (
    <>
      <a href="#main" className="sr-only z-[100] rounded-lg bg-primary text-primary-fg focus:not-sr-only focus:fixed focus:start-3 focus:top-3 focus:px-4 focus:py-2">
        {t("common.skipToContent")}
      </a>
      <div className="hidden border-b border-border bg-surface/70 text-[13px] text-muted md:block">
        <div className="container-store flex h-9 items-center justify-between gap-6">
          <p className="flex min-w-0 items-center gap-2 truncate">
            {freeShippingText && <Truck className="size-4 shrink-0 text-accent" />}
            {freeShippingText}
          </p>
          <div className="flex shrink-0 items-center gap-5">
            {topLinks.map((l) => (
              <Link key={l.id} href={l.href} className="transition hover:text-fg">
                {l.label}
              </Link>
            ))}
            <span className="h-4 w-px bg-border" aria-hidden />
            <CurrencySelect />
            <LanguageSelect />
          </div>
        </div>
      </div>

      <header className={cn("z-40 w-full border-b transition-[background,box-shadow,border-color] duration-300", sticky && "sticky top-0", scrolled ? "border-border shadow-[0_6px_24px_-18px_rgb(15_23_42/0.35)]" : "border-transparent", blur ? "bg-bg/85 backdrop-blur-xl backdrop-saturate-150" : "bg-bg")}>
        <div className="container-store flex h-16 items-center gap-2 md:h-[72px] md:gap-6">
          <button type="button" onClick={() => setDrawer({ open: true, categories: false })} className="-ms-2 grid size-10 place-items-center rounded-full hover:bg-surface lg:hidden" aria-label={t("common.openMenu")}>
            <Menu className="size-[22px]" strokeWidth={1.75} />
          </button>
          <Link href="/" className="shrink-0 max-lg:me-auto" aria-label={storeName}>
            <Logo name={storeName} url={logoUrl} />
          </Link>

          <button
            type="button"
            onClick={() => setSearchOpen(true)}
            className="mx-auto hidden h-12 w-full max-w-2xl items-center gap-3 rounded-full border border-border bg-surface/60 px-5 text-start text-sm text-muted transition hover:border-fg/20 hover:bg-surface md:flex"
          >
            <Search className="size-[18px]" />
            <span className="flex-1 truncate">{t("common.searchPlaceholder")}</span>
            <kbd className="hidden rounded-md border border-border bg-bg px-1.5 py-0.5 font-sans text-[11px] lg:inline">⌘K</kbd>
          </button>

          <div className="flex items-center gap-0.5">
            <div className="max-md:hidden">
              <AccountMenu />
            </div>
            <WishlistLink className="max-md:hidden" />
            <CartButton />
          </div>
        </div>

        {/* Mobile: search is the primary action, always one tap away. */}
        <div className={cn("grid transition-[grid-template-rows,opacity] duration-300 md:hidden", tucked ? "grid-rows-[0fr] opacity-0" : "grid-rows-[1fr] opacity-100")}>
          <div className="overflow-hidden">
            <div className="container-store pb-3">
              <button type="button" onClick={() => setSearchOpen(true)} className="flex h-11 w-full items-center gap-3 rounded-full border border-border bg-surface px-4 text-start text-sm text-muted">
                <Search className="size-[18px]" />
                <span className="truncate">{t("common.searchPlaceholder")}</span>
              </button>
            </div>
          </div>
        </div>

        {showCategoryBar && menu.length > 0 && (
          <nav className={cn("hidden border-t border-border/70 transition-[grid-template-rows,opacity] duration-300 lg:grid", tucked ? "grid-rows-[0fr] opacity-0" : "grid-rows-[1fr] opacity-100")} aria-label={t("common.categories")}>
            <div className={cn(tucked ? "overflow-hidden" : "overflow-visible")}>
              <DesktopNav menu={menu} />
            </div>
          </nav>
        )}
      </header>

      <MobileDrawer open={drawer.open} onOpenChange={(o) => setDrawer((d) => ({ ...d, open: o }))} storeName={storeName} menu={menu} topLinks={topLinks} startAtCategories={drawer.categories} />
      <SearchOverlay open={searchOpen} onOpenChange={setSearchOpen} />
    </>
  );
}

/** App-style bottom navigation on phones: thumb-reachable primary actions. */
export function MobileTabBar() {
  const t = useTranslations();
  const pathname = usePathname();
  const { cartCount, setCartOpen, wishlist, user } = useStore();
  const item = "relative flex flex-1 flex-col items-center justify-center gap-0.5 text-[10.5px] font-medium transition active:scale-95";
  const active = (p: string) => (p === "/" ? pathname === "/" : pathname.startsWith(p));
  // Checkout is a focused flow with its own sticky "place order" bar — the tab bar would cover it.
  if (pathname.startsWith("/checkout")) return null;
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-bg/92 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl md:hidden" aria-label="Primary">
      <div className="flex h-16">
        <Link href="/" className={cn(item, active("/") ? "text-fg" : "text-muted")}>
          <Home className="size-[22px]" strokeWidth={active("/") ? 2.2 : 1.75} />
          {t("common.home")}
        </Link>
        <button type="button" onClick={() => window.dispatchEvent(new Event("nq:open-categories"))} className={cn(item, active("/shop") || active("/category") ? "text-fg" : "text-muted")}>
          <Grid2x2 className="size-[22px]" strokeWidth={1.75} />
          {t("common.categories")}
        </button>
        <button type="button" onClick={() => setCartOpen(true)} className={cn(item, "text-muted")}>
          <ShoppingBag className="size-[22px]" strokeWidth={1.75} />
          {cartCount > 0 && <span className="absolute top-1.5 ms-6 grid min-w-4 place-items-center rounded-full bg-accent px-1 text-[10px] font-bold leading-4 text-accent-fg">{cartCount}</span>}
          {t("common.cart")}
        </button>
        <Link href="/wishlist" className={cn(item, active("/wishlist") ? "text-fg" : "text-muted")}>
          <Heart className="size-[22px]" strokeWidth={1.75} />
          {wishlist.size > 0 && <span className="absolute top-1.5 ms-6 grid min-w-4 place-items-center rounded-full bg-sale px-1 text-[10px] font-bold leading-4 text-white">{wishlist.size}</span>}
          {t("common.wishlist")}
        </Link>
        <Link href={user ? "/account" : "/account/login"} className={cn(item, active("/account") ? "text-fg" : "text-muted")}>
          <User className="size-[22px]" strokeWidth={1.75} />
          {t("common.account")}
        </Link>
      </div>
    </nav>
  );
}

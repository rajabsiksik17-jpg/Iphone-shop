"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { ChevronDown, ChevronRight, Globe, Grid2x2, Heart, Home, Menu, Search, ShoppingBag, User, LogOut, Package, Coins } from "lucide-react";
import { Link, usePathname, useRouter } from "@/i18n/navigation";
import { useStore } from "@/components/providers/store-context";
import { Sheet } from "@/components/ui/overlay";
import { Dropdown, DropdownContent, DropdownItem, DropdownSeparator, DropdownTrigger } from "@/components/ui/menu";
import { WishlistLink } from "./wishlist-button";
import { SearchOverlay } from "./search-overlay";
import { setDisplayCurrencyAction } from "@/actions/cart";
import { customerLogoutAction } from "@/actions/auth";
import { cn } from "@/lib/utils";
import type { ResolvedMenuItem } from "@/server/cms/queries";
import type { Tree } from "@/lib/category-tree";
import type { CategoryNode } from "@/server/catalog/taxonomy";

type Props = {
  storeName: string;
  logoUrl: string;
  menu: ResolvedMenuItem[];
  categories: Tree<CategoryNode>[];
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

function LanguageSwitch({ compact }: { compact?: boolean }) {
  const locale = useLocale();
  const pathname = usePathname();
  const other = locale === "ar" ? "en" : "ar";
  return (
    <Link href={pathname} locale={other} className={cn("flex items-center gap-1.5 rounded-full text-sm transition hover:text-fg", compact ? "px-2 py-1" : "")} hrefLang={other} lang={other}>
      <Globe className="size-4" />
      {other === "ar" ? "العربية" : "English"}
    </Link>
  );
}

function CurrencySwitch() {
  const { currencies, money } = useStore();
  const router = useRouter();
  const [, start] = useTransition();
  if (currencies.length < 2) return null;
  return (
    <Dropdown>
      <DropdownTrigger className="flex items-center gap-1 text-sm transition hover:text-fg">
        {money.display.code}
        <ChevronDown className="size-3.5" />
      </DropdownTrigger>
      <DropdownContent className="min-w-40">
        {currencies.map((c) => (
          <DropdownItem key={c.code} onSelect={() => start(async () => (await setDisplayCurrencyAction(c.code), router.refresh()))}>
            <span className="w-8 font-semibold">{c.code}</span>
            <span className="text-muted">{c.name}</span>
          </DropdownItem>
        ))}
      </DropdownContent>
    </Dropdown>
  );
}

function AccountMenu() {
  const t = useTranslations();
  const { user } = useStore();
  const router = useRouter();
  if (!user)
    return (
      <Link href="/account/login" className="grid size-10 place-items-center rounded-full transition hover:bg-surface" aria-label={t("common.signIn")}>
        <User className="size-[22px]" strokeWidth={1.75} />
      </Link>
    );
  return (
    <Dropdown>
      <DropdownTrigger className="grid size-10 place-items-center rounded-full transition hover:bg-surface data-[state=open]:bg-surface" aria-label={t("common.account")}>
        <span className="grid size-7 place-items-center rounded-full bg-primary text-xs font-semibold text-primary-fg">{user.name.slice(0, 1).toUpperCase()}</span>
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

function MegaMenu({ item }: { item: ResolvedMenuItem }) {
  const [open, setOpen] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const enter = () => {
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setOpen(true), 80);
  };
  const leave = () => {
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setOpen(false), 120);
  };
  if (!item.children.length)
    return (
      <Link href={item.href} className={cn("relative flex h-11 items-center px-3 text-[14.5px] font-medium text-fg/80 transition hover:text-fg", item.highlight && "text-sale hover:text-sale")} target={item.newTab ? "_blank" : undefined}>
        {item.label}
      </Link>
    );
  return (
    <div className="relative" onMouseEnter={enter} onMouseLeave={leave} onFocus={enter} onBlur={leave}>
      <Link href={item.href} className="flex h-11 items-center gap-1 px-3 text-[14.5px] font-medium text-fg/80 transition hover:text-fg" aria-expanded={open} aria-haspopup="true">
        {item.label}
        <ChevronDown className={cn("size-3.5 transition-transform", open && "rotate-180")} />
      </Link>
      {open && (
        <div className="pop absolute start-0 top-full z-50 pt-1" data-state="open">
          <div className="grid min-w-64 gap-0.5 rounded-2xl border border-border bg-bg p-2 shadow-pop">
            {item.children.map((c) => (
              <Link key={c.id} href={c.href} onClick={() => setOpen(false)} className="flex items-center justify-between rounded-xl px-3 py-2.5 text-sm transition hover:bg-surface">
                {c.label}
                <ChevronRight className="flip-rtl size-4 text-muted" />
              </Link>
            ))}
            <Link href={item.href} onClick={() => setOpen(false)} className="mt-1 rounded-xl px-3 py-2.5 text-sm font-medium text-accent hover:bg-surface">
              {item.label} →
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

function MobileCategoryTree({ nodes, onNavigate, depth = 0 }: { nodes: Tree<CategoryNode>[]; onNavigate: () => void; depth?: number }) {
  const [open, setOpen] = useState<string | null>(null);
  return (
    <ul className={cn(depth > 0 && "ms-3 border-s border-border ps-2")}>
      {nodes.map((n) => (
        <li key={n.id}>
          <div className="flex items-center">
            <Link href={`/category/${n.fullSlug}`} onClick={onNavigate} className="flex-1 rounded-xl px-3 py-3 text-[15px] font-medium hover:bg-surface">
              {n.name}
            </Link>
            {n.children.length > 0 && (
              <button type="button" onClick={() => setOpen(open === n.id ? null : n.id)} className="grid size-11 place-items-center rounded-xl text-muted hover:bg-surface" aria-expanded={open === n.id} aria-label={n.name}>
                <ChevronDown className={cn("size-4 transition-transform", open === n.id && "rotate-180")} />
              </button>
            )}
          </div>
          {open === n.id && <MobileCategoryTree nodes={n.children} onNavigate={onNavigate} depth={depth + 1} />}
        </li>
      ))}
    </ul>
  );
}

export function Header({ storeName, logoUrl, menu, categories, freeShippingText, sticky, blur, showCategoryBar }: Props) {
  const t = useTranslations();
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const { user } = useStore();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
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
    window.addEventListener("nq:open-search", openSearch);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("nq:open-search", openSearch);
    };
  }, []);

  return (
    <>
      <a href="#main" className="sr-only z-[100] rounded-lg bg-primary text-primary-fg focus:not-sr-only focus:fixed focus:start-3 focus:top-3 focus:px-4 focus:py-2">
        {t("common.skipToContent")}
      </a>
      <div className="hidden border-b border-border bg-surface/70 text-[13px] text-muted md:block">
        <div className="container-store flex h-9 items-center justify-between">
          <p>{freeShippingText}</p>
          <div className="flex items-center gap-5">
            <Link href="/faq" className="transition hover:text-fg">
              {t("header.help")}
            </Link>
            <Link href="/account/orders" className="transition hover:text-fg">
              {t("header.trackOrder")}
            </Link>
            <CurrencySwitch />
            <LanguageSwitch />
          </div>
        </div>
      </div>

      <header className={cn("z-40 w-full border-b transition-[background,box-shadow,border-color] duration-300", sticky && "sticky top-0", scrolled ? "border-border shadow-[0_6px_24px_-18px_rgb(15_23_42/0.35)]" : "border-transparent", blur ? "bg-bg/85 backdrop-blur-xl backdrop-saturate-150" : "bg-bg")}>
        <div className="container-store flex h-16 items-center gap-2 md:h-[72px] md:gap-6">
          <button type="button" onClick={() => setMenuOpen(true)} className="-ms-2 grid size-10 place-items-center rounded-full hover:bg-surface lg:hidden" aria-label={t("common.openMenu")}>
            <Menu className="size-[22px]" strokeWidth={1.75} />
          </button>
          <Link href="/" className="shrink-0" aria-label={storeName}>
            <Logo name={storeName} url={logoUrl} />
          </Link>

          <button
            type="button"
            onClick={() => setSearchOpen(true)}
            className="mx-auto hidden h-11 w-full max-w-xl items-center gap-3 rounded-full border border-border bg-surface/60 px-4 text-start text-sm text-muted transition hover:border-fg/20 hover:bg-surface md:flex"
          >
            <Search className="size-[18px]" />
            <span className="flex-1">{t("common.searchPlaceholder")}</span>
            <kbd className="hidden rounded-md border border-border bg-bg px-1.5 py-0.5 font-sans text-[11px] lg:inline">⌘K</kbd>
          </button>

          <div className="ms-auto flex items-center gap-0.5 md:ms-0">
            <button type="button" onClick={() => setSearchOpen(true)} className="grid size-10 place-items-center rounded-full hover:bg-surface md:hidden" aria-label={t("common.search")}>
              <Search className="size-[22px]" strokeWidth={1.75} />
            </button>
            <div className="max-md:hidden">
              <AccountMenu />
            </div>
            <WishlistLink className="max-md:hidden" />
            <CartButton />
          </div>
        </div>

        {showCategoryBar && (
          <nav className="hidden border-t border-border/70 lg:block" aria-label={t("common.categories")}>
            <div className="container-store flex items-center gap-1">
              <Link href="/shop" className="flex h-11 items-center gap-2 pe-3 text-[14.5px] font-semibold">
                <Grid2x2 className="size-4" />
                {t("common.shop")}
              </Link>
              {menu.map((item) => (
                <MegaMenu key={item.id} item={item} />
              ))}
            </div>
          </nav>
        )}
      </header>

      <Sheet open={menuOpen} onOpenChange={setMenuOpen} side="start" title={storeName} closeLabel={t("common.close")}>
        <div className="flex flex-col gap-6 p-4">
          {!user ? (
            <div className="grid grid-cols-2 gap-2">
              <Link href="/account/login" onClick={() => setMenuOpen(false)} className="rounded-full bg-primary py-3 text-center text-sm font-medium text-primary-fg">
                {t("common.signIn")}
              </Link>
              <Link href="/account/register" onClick={() => setMenuOpen(false)} className="rounded-full border border-border py-3 text-center text-sm font-medium">
                {t("common.register")}
              </Link>
            </div>
          ) : (
            <Link href="/account" onClick={() => setMenuOpen(false)} className="flex items-center gap-3 rounded-2xl bg-surface p-3">
              <span className="grid size-10 place-items-center rounded-full bg-primary font-semibold text-primary-fg">{user.name.slice(0, 1)}</span>
              <span>
                <span className="block text-sm font-semibold">{user.name}</span>
                <span className="block text-xs text-muted">{t("header.myAccount")}</span>
              </span>
            </Link>
          )}
          <div>
            <h3 className="mb-1 px-3 text-xs font-semibold uppercase tracking-wider text-muted">{t("common.categories")}</h3>
            <MobileCategoryTree nodes={categories} onNavigate={() => setMenuOpen(false)} />
          </div>
          <div className="grid gap-1 border-t border-border pt-4">
            <Link href="/shop?sale=1" onClick={() => setMenuOpen(false)} className="rounded-xl px-3 py-3 text-[15px] font-medium text-sale hover:bg-surface">
              {t("common.deals")}
            </Link>
            <Link href="/brands" onClick={() => setMenuOpen(false)} className="rounded-xl px-3 py-3 text-[15px] font-medium hover:bg-surface">
              {t("common.brands")}
            </Link>
            <Link href="/faq" onClick={() => setMenuOpen(false)} className="rounded-xl px-3 py-3 text-[15px] font-medium hover:bg-surface">
              {t("header.help")}
            </Link>
            <Link href="/contact" onClick={() => setMenuOpen(false)} className="rounded-xl px-3 py-3 text-[15px] font-medium hover:bg-surface">
              {t("contact.title")}
            </Link>
          </div>
          <div className="flex items-center justify-between border-t border-border px-3 pt-4 text-sm text-muted">
            <LanguageSwitch />
            <CurrencySwitch />
          </div>
        </div>
      </Sheet>

      <SearchOverlay open={searchOpen} onOpenChange={setSearchOpen} />
    </>
  );
}

/** App-style bottom navigation on phones: thumb-reachable primary actions. */
export function MobileTabBar() {
  const t = useTranslations();
  const pathname = usePathname();
  const { cartCount, setCartOpen, wishlist } = useStore();
  const item = "flex flex-1 flex-col items-center justify-center gap-0.5 text-[10.5px] font-medium";
  const active = (p: string) => (p === "/" ? pathname === "/" : pathname.startsWith(p));
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-bg/92 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl md:hidden" aria-label="Primary">
      <div className="flex h-16">
        <Link href="/" className={cn(item, active("/") ? "text-fg" : "text-muted")}>
          <Home className="size-[22px]" strokeWidth={active("/") ? 2.2 : 1.75} />
          {t("common.home")}
        </Link>
        <Link href="/shop" className={cn(item, active("/shop") || active("/category") ? "text-fg" : "text-muted")}>
          <Grid2x2 className="size-[22px]" strokeWidth={1.75} />
          {t("common.shop")}
        </Link>
        <button type="button" onClick={() => window.dispatchEvent(new Event("nq:open-search"))} className={cn(item, "text-muted")}>
          <Search className="size-[22px]" strokeWidth={1.75} />
          {t("common.search")}
        </button>
        <Link href="/wishlist" className={cn(item, "relative", active("/wishlist") ? "text-fg" : "text-muted")}>
          <Heart className="size-[22px]" strokeWidth={1.75} />
          {wishlist.size > 0 && <span className="absolute top-2 ms-5 size-2 rounded-full bg-sale" />}
          {t("common.wishlist")}
        </Link>
        <button type="button" onClick={() => setCartOpen(true)} className={cn(item, "relative text-muted")}>
          <ShoppingBag className="size-[22px]" strokeWidth={1.75} />
          {cartCount > 0 && <span className="absolute top-1.5 ms-6 grid min-w-4 place-items-center rounded-full bg-accent px-1 text-[10px] font-bold leading-4 text-accent-fg">{cartCount}</span>}
          {t("common.cart")}
        </button>
      </div>
    </nav>
  );
}

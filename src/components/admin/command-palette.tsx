"use client";

import { useEffect, useMemo, useState } from "react";
import { Command } from "cmdk";
import * as D from "@radix-ui/react-dialog";
import { Search, Plus, ShoppingBag, Package, User, FolderTree, BadgeCheck, FileText, Settings, CornerDownLeft } from "lucide-react";
import { useRouter } from "@/i18n/navigation";
import { NAV } from "@/admin/nav";
import { SETTINGS_INDEX } from "@/admin/settings-index";
import { adminSearchAction } from "@/actions/admin/shell";
import { AdminIcon } from "./icon";
import { useAdmin } from "./admin-context";
import { Spinner } from "@/components/ui/spinner";

type Result = { type: "order" | "product" | "customer" | "category" | "brand" | "page"; id: string; label: string; sub: string; href: string };
const TYPE_ICON = { order: ShoppingBag, product: Package, customer: User, category: FolderTree, brand: BadgeCheck, page: FileText };

/**
 * ⌘K command palette: jump to any section or setting, create things, and
 * search orders/products/customers server-side — keyboard-first admin.
 */
export function CommandPalette({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const { t, can, locale } = useAdmin();
  const router = useRouter();
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Result[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) {
      setQ("");
      setResults([]);
      return;
    }
    if (q.trim().length < 2) return setResults([]);
    setLoading(true);
    const h = setTimeout(async () => {
      const r = await adminSearchAction(q, locale);
      setLoading(false);
      if (r.ok) setResults(r.data);
    }, 180);
    return () => clearTimeout(h);
  }, [q, open, locale]);

  const go = (href: string) => {
    onOpenChange(false);
    router.push(href);
  };

  const navItems = useMemo(() => NAV.flatMap((g) => g.items).filter((i) => !i.permission || can(i.permission)), [can]);
  const settings = useMemo(() => SETTINGS_INDEX.filter((s) => can(s.permission)), [can]);
  const creates = [
    { label: t("cmd.newProduct"), href: "/admin/products/new", show: can("catalog.edit") },
    { label: t("cmd.newCategory"), href: "/admin/categories?new=1", show: can("catalog.edit") },
    { label: t("cmd.newCoupon"), href: "/admin/coupons?new=1", show: can("marketing.manage") },
    { label: t("cmd.newPage"), href: "/admin/pages?new=1", show: can("content.manage") },
  ].filter((c) => c.show);

  const item = "flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-ad-fg aria-selected:bg-ad-hover";
  return (
    <D.Root open={open} onOpenChange={onOpenChange}>
      <D.Portal>
        <D.Overlay className="sheet-overlay fixed inset-0 z-[90] bg-black/40 backdrop-blur-[2px]" />
        <D.Content aria-describedby={undefined} className="dialog-content fixed inset-x-3 top-[10vh] z-[91] mx-auto max-w-xl overflow-hidden rounded-2xl border border-ad-border bg-ad-panel shadow-pop outline-none">
          <D.Title className="sr-only">{t("cmd.placeholder")}</D.Title>
          <Command shouldFilter={false} loop className="flex max-h-[70vh] flex-col">
            <div className="flex items-center gap-3 border-b border-ad-border px-4">
              {loading ? <Spinner className="size-4 text-ad-muted" /> : <Search className="size-4 text-ad-muted" />}
              <Command.Input value={q} onValueChange={setQ} placeholder={t("cmd.placeholder")} className="h-13 flex-1 bg-transparent py-4 text-[15px] outline-none placeholder:text-ad-muted" autoFocus />
              <kbd className="rounded border border-ad-border px-1.5 py-0.5 text-[10.5px] text-ad-muted">Esc</kbd>
            </div>
            <Command.List className="min-h-0 flex-1 overflow-y-auto p-2">
              <Command.Empty className="p-6 text-center text-sm text-ad-muted">{t("c.noResults")}</Command.Empty>
              {results.length > 0 && (
                <Command.Group heading={t("cmd.results")} className="[&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-[11px] [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:text-ad-muted">
                  {results.map((r) => {
                    const Icon = TYPE_ICON[r.type];
                    return (
                      <Command.Item key={`${r.type}-${r.id}`} value={`${r.type}-${r.id}`} onSelect={() => go(r.href)} className={item}>
                        <Icon className="size-4 text-ad-muted" />
                        <span className="flex-1 truncate">{r.label}</span>
                        <span className="truncate text-xs text-ad-muted">{r.sub}</span>
                      </Command.Item>
                    );
                  })}
                </Command.Group>
              )}
              {(() => {
                const ql = q.trim().toLowerCase();
                const navMatches = navItems.filter((i) => !ql || t(i.key).toLowerCase().includes(ql));
                const settingMatches = settings.filter((s) => ql && (t(s.title).toLowerCase().includes(ql) || s.keywords.some((k) => k.includes(ql))));
                const createMatches = creates.filter((c) => !ql || c.label.toLowerCase().includes(ql));
                const heading = "[&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-[11px] [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:text-ad-muted";
                return (
                  <>
                    {createMatches.length > 0 && (
                      <Command.Group heading={t("cmd.create")} className={heading}>
                        {createMatches.map((c) => (
                          <Command.Item key={c.href} value={`create-${c.href}`} onSelect={() => go(c.href)} className={item}>
                            <Plus className="size-4 text-ad-muted" />
                            {c.label}
                          </Command.Item>
                        ))}
                      </Command.Group>
                    )}
                    {settingMatches.length > 0 && (
                      <Command.Group heading={t("nav.settings")} className={heading}>
                        {settingMatches.slice(0, 8).map((s) => (
                          <Command.Item key={s.href + s.title} value={`setting-${s.href}-${s.title}`} onSelect={() => go(s.href)} className={item}>
                            <Settings className="size-4 text-ad-muted" />
                            <span className="flex-1">{t(s.title)}</span>
                            <span className="text-xs text-ad-muted">{t(s.section)}</span>
                          </Command.Item>
                        ))}
                      </Command.Group>
                    )}
                    {navMatches.length > 0 && (
                      <Command.Group heading={t("cmd.navigate")} className={heading}>
                        {navMatches.map((i) => (
                          <Command.Item key={i.href} value={`nav-${i.href}`} onSelect={() => go(i.href)} className={item}>
                            <AdminIcon name={i.icon} className="size-4 text-ad-muted" />
                            {t(i.key)}
                          </Command.Item>
                        ))}
                      </Command.Group>
                    )}
                  </>
                );
              })()}
            </Command.List>
            <div className="flex items-center justify-between border-t border-ad-border px-4 py-2 text-[11px] text-ad-muted">
              <span>{t("cmd.hint")}</span>
              <CornerDownLeft className="size-3.5" />
            </div>
          </Command>
        </D.Content>
      </D.Portal>
    </D.Root>
  );
}

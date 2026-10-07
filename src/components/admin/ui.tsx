"use client";

import { useEffect, useState, useTransition, type ReactNode } from "react";
import * as SwitchPrimitive from "@radix-ui/react-switch";
import { useSearchParams } from "next/navigation";
import { ChevronLeft, ChevronRight, Search, ShieldOff, Inbox, ArrowUpRight, ArrowDownRight } from "lucide-react";
import { Link, usePathname, useRouter } from "@/i18n/navigation";
import { Modal } from "@/components/ui/overlay";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useAdmin } from "./admin-context";

export function PageHeader({ title, description, actions, back }: { title: ReactNode; description?: ReactNode; actions?: ReactNode; back?: { href: string; label: string } }) {
  return (
    <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        {back && (
          <Link href={back.href} className="mb-1.5 inline-flex items-center gap-1 text-[13px] text-ad-muted hover:text-ad-fg">
            <ChevronLeft className="flip-rtl size-4" /> {back.label}
          </Link>
        )}
        <h1 className="truncate text-[1.6rem] font-semibold tracking-tight">{title}</h1>
        {description && <p className="mt-1 text-sm text-ad-muted">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function Panel({ title, description, actions, children, className, padded = true }: { title?: ReactNode; description?: ReactNode; actions?: ReactNode; children: ReactNode; className?: string; padded?: boolean }) {
  return (
    <section className={cn("rounded-xl border border-ad-border bg-ad-panel", className)}>
      {(title || actions) && (
        <div className="flex items-start justify-between gap-3 border-b border-ad-border px-5 py-3.5">
          <div className="min-w-0">
            {title && <h2 className="text-[14.5px] font-semibold">{title}</h2>}
            {description && <p className="mt-0.5 text-xs text-ad-muted">{description}</p>}
          </div>
          {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
        </div>
      )}
      <div className={cn(padded && "p-5")}>{children}</div>
    </section>
  );
}

export function StatCard({ label, value, delta, icon, hint }: { label: string; value: ReactNode; delta?: number | null; icon?: ReactNode; hint?: ReactNode }) {
  const { t } = useAdmin();
  return (
    <div className="rounded-xl border border-ad-border bg-ad-panel p-5">
      <div className="flex items-center justify-between">
        <p className="text-[13px] font-medium text-ad-muted">{label}</p>
        {icon && <span className="text-ad-muted [&_svg]:size-4">{icon}</span>}
      </div>
      <p className="tabular mt-3 truncate whitespace-nowrap text-[1.35rem] font-semibold tracking-tight 2xl:text-[1.65rem]">{value}</p>
      <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
        {delta != null && Number.isFinite(delta) && (
          <span className={cn("inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 font-semibold", delta >= 0 ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" : "bg-red-500/10 text-red-600 dark:text-red-400")}>
            {delta >= 0 ? <ArrowUpRight className="size-3" /> : <ArrowDownRight className="size-3" />}
            {Math.abs(delta).toFixed(1)}%
          </span>
        )}
        <span className="text-ad-muted">{hint ?? (delta != null ? t("c.vsPrevious") : "")}</span>
      </div>
    </div>
  );
}

export function Switch({ checked, onCheckedChange, label, description, disabled, id }: { checked: boolean; onCheckedChange: (v: boolean) => void; label?: ReactNode; description?: ReactNode; disabled?: boolean; id?: string }) {
  const sw = (
    <SwitchPrimitive.Root
      id={id}
      checked={checked}
      onCheckedChange={onCheckedChange}
      disabled={disabled}
      className="relative inline-flex h-[22px] w-[38px] shrink-0 cursor-pointer items-center rounded-full bg-ad-border transition-colors data-[state=checked]:bg-ad-accent disabled:cursor-not-allowed disabled:opacity-50"
    >
      <SwitchPrimitive.Thumb className="block size-[18px] translate-x-[2px] rounded-full bg-white shadow transition-transform data-[state=checked]:translate-x-[18px] rtl:-translate-x-[2px] rtl:data-[state=checked]:-translate-x-[18px]" />
    </SwitchPrimitive.Root>
  );
  if (!label) return sw;
  return (
    <label className="flex cursor-pointer items-start justify-between gap-4 py-1">
      <span className="min-w-0">
        <span className="block text-sm font-medium">{label}</span>
        {description && <span className="mt-0.5 block text-xs text-ad-muted">{description}</span>}
      </span>
      {sw}
    </label>
  );
}

export function Segmented<T extends string>({ value, onChange, options, size = "md" }: { value: T; onChange: (v: T) => void; options: { value: T; label: ReactNode }[]; size?: "sm" | "md" }) {
  return (
    <div className="inline-flex rounded-lg bg-ad-sunken p-0.5" role="radiogroup">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn("rounded-md font-medium transition", size === "sm" ? "px-2.5 py-1 text-xs" : "px-3 py-1.5 text-[13px]", value === o.value ? "bg-ad-panel text-ad-fg shadow-sm" : "text-ad-muted hover:text-ad-fg")}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Pill({ children, tone = "neutral", className }: { children: ReactNode; tone?: "neutral" | "green" | "amber" | "red" | "blue" | "violet"; className?: string }) {
  const tones = {
    neutral: "bg-ad-sunken text-ad-muted",
    green: "bg-emerald-500/12 text-emerald-700 dark:text-emerald-400",
    amber: "bg-amber-500/14 text-amber-700 dark:text-amber-400",
    red: "bg-red-500/12 text-red-700 dark:text-red-400",
    blue: "bg-sky-500/12 text-sky-700 dark:text-sky-400",
    violet: "bg-violet-500/12 text-violet-700 dark:text-violet-400",
  };
  return <span className={cn("inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-[11.5px] font-medium", tones[tone], className)}>{children}</span>;
}

export function ColorPill({ label, color }: { label: string; color: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2 py-0.5 text-[11.5px] font-medium" style={{ backgroundColor: `${color}1f`, color }}>
      <span className="size-1.5 rounded-full" style={{ backgroundColor: color }} />
      {label}
    </span>
  );
}

export function Forbidden() {
  const { t } = useAdmin();
  return (
    <div className="grid place-items-center rounded-xl border border-dashed border-ad-border bg-ad-panel px-6 py-20 text-center">
      <ShieldOff className="size-10 text-ad-muted" />
      <p className="mt-4 font-medium">{t("c.forbidden")}</p>
    </div>
  );
}

export function AdminEmpty({ title, text, action, icon }: { title?: ReactNode; text?: ReactNode; action?: ReactNode; icon?: ReactNode }) {
  const { t } = useAdmin();
  return (
    <div className="grid place-items-center px-6 py-16 text-center">
      <div className="grid size-14 place-items-center rounded-2xl bg-ad-sunken text-ad-muted [&_svg]:size-6">{icon ?? <Inbox />}</div>
      <p className="mt-4 font-medium">{title ?? t("c.empty")}</p>
      {text && <p className="mt-1 max-w-sm text-sm text-ad-muted">{text}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

/** URL-synced search box for list pages (debounced; resets pagination). */
export function SearchBox({ placeholder, param = "q" }: { placeholder?: string; param?: string }) {
  const { t } = useAdmin();
  const sp = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const [value, setValue] = useState(sp.get(param) ?? "");
  const [, start] = useTransition();
  useEffect(() => {
    const h = setTimeout(() => {
      if ((sp.get(param) ?? "") === value) return;
      const p = new URLSearchParams(sp.toString());
      if (value) p.set(param, value);
      else p.delete(param);
      p.delete("page");
      start(() => router.replace(`${pathname}?${p.toString()}`));
    }, 300);
    return () => clearTimeout(h);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);
  return (
    <div className="relative w-full sm:w-72">
      <Search className="pointer-events-none absolute inset-y-0 start-3 my-auto size-4 text-ad-muted" />
      <input value={value} onChange={(e) => setValue(e.target.value)} placeholder={placeholder ?? t("c.searchPlaceholder")} className="h-9 w-full rounded-lg border border-ad-border bg-ad-panel pe-3 ps-9 text-[13px] outline-none transition focus:border-ad-accent focus:ring-4 focus:ring-ad-accent/12" type="search" />
    </div>
  );
}

/** URL-synced tabs/filters (e.g. order status). */
export function FilterTabs({ param, options }: { param: string; options: { value: string; label: ReactNode; count?: number }[] }) {
  const sp = useSearchParams();
  const pathname = usePathname();
  const current = sp.get(param) ?? "";
  return (
    <div className="no-scrollbar -mx-3 flex gap-1 overflow-x-auto px-3 sm:mx-0 sm:px-0">
      {options.map((o) => {
        const p = new URLSearchParams(sp.toString());
        if (o.value) p.set(param, o.value);
        else p.delete(param);
        p.delete("page");
        const active = current === o.value;
        return (
          <Link key={o.value || "all"} href={`${pathname}?${p.toString()}`} className={cn("flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-[13px] font-medium transition", active ? "bg-ad-fg text-ad-panel" : "text-ad-muted hover:bg-ad-hover hover:text-ad-fg")}>
            {o.label}
            {o.count != null && <span className={cn("tabular rounded-full px-1.5 text-[11px]", active ? "bg-ad-panel/20" : "bg-ad-sunken")}>{o.count}</span>}
          </Link>
        );
      })}
    </div>
  );
}

export function Pager({ page, pageCount, total }: { page: number; pageCount: number; total: number }) {
  const { t } = useAdmin();
  const sp = useSearchParams();
  const pathname = usePathname();
  if (pageCount <= 1) return <p className="px-5 py-3 text-xs text-ad-muted">{t("c.rows", { n: total })}</p>;
  const href = (n: number) => {
    const p = new URLSearchParams(sp.toString());
    p.set("page", String(n));
    return `${pathname}?${p.toString()}`;
  };
  return (
    <div className="flex items-center justify-between border-t border-ad-border px-4 py-3 text-xs text-ad-muted">
      <span>
        {t("c.rows", { n: total })} · {t("c.page", { page, total: pageCount })}
      </span>
      <div className="flex gap-1">
        {page > 1 ? (
          <Link href={href(page - 1)} className="grid size-8 place-items-center rounded-lg border border-ad-border hover:bg-ad-hover" aria-label={t("c.prev")}>
            <ChevronLeft className="flip-rtl size-4" />
          </Link>
        ) : null}
        {page < pageCount ? (
          <Link href={href(page + 1)} className="grid size-8 place-items-center rounded-lg border border-ad-border hover:bg-ad-hover" aria-label={t("c.next")}>
            <ChevronRight className="flip-rtl size-4" />
          </Link>
        ) : null}
      </div>
    </div>
  );
}

export function ConfirmDialog({ open, onOpenChange, title, text, confirmLabel, onConfirm, danger = true }: { open: boolean; onOpenChange: (o: boolean) => void; title: ReactNode; text?: ReactNode; confirmLabel?: string; onConfirm: () => Promise<void> | void; danger?: boolean }) {
  const { t } = useAdmin();
  const [pending, start] = useTransition();
  return (
    <Modal open={open} onOpenChange={onOpenChange} title={title} description={text}>
      <div className="mt-2 flex justify-end gap-2">
        <Button variant="outline" onClick={() => onOpenChange(false)}>
          {t("c.cancel")}
        </Button>
        <Button variant={danger ? "danger" : "primary"} loading={pending} onClick={() => start(async () => (await onConfirm(), onOpenChange(false)))}>
          {confirmLabel ?? t("c.confirm")}
        </Button>
      </div>
    </Modal>
  );
}

/**
 * Responsive data table: a real table on wide screens, stacked cards on
 * phones (each row's `mobile` renderer), so lists stay usable on the go.
 */
export type Column<T> = { key: string; header: ReactNode; cell: (row: T) => ReactNode; className?: string; align?: "start" | "end" | "center" };

export function DataTable<T extends { id: string }>({
  rows,
  columns,
  mobile,
  href,
  onRowClick,
  selectable,
  selected,
  onSelectedChange,
  empty,
  total,
  allMatching,
  onAllMatchingChange,
}: {
  rows: T[];
  columns: Column<T>[];
  mobile: (row: T) => ReactNode;
  href?: (row: T) => string;
  onRowClick?: (row: T) => void;
  selectable?: boolean;
  selected?: Set<string>;
  onSelectedChange?: (s: Set<string>) => void;
  empty?: ReactNode;
  /** Records matching the current filters (all pages) — enables "select all N". */
  total?: number;
  allMatching?: boolean;
  onAllMatchingChange?: (all: boolean) => void;
}) {
  const router = useRouter();
  const { t } = useAdmin();
  if (!rows.length) return <>{empty ?? <AdminEmpty />}</>;
  const all = selected && rows.every((r) => selected.has(r.id));
  const some = Boolean(selected && !all && rows.some((r) => selected.has(r.id)));
  const toggle = (id: string) => {
    if (!selected || !onSelectedChange) return;
    const n = new Set(selected);
    if (n.has(id)) n.delete(id);
    else n.add(id);
    onSelectedChange(n);
  };
  return (
    <>
      {selectable && all && total != null && total > rows.length && onAllMatchingChange && (
        <div className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1 border-b border-ad-border bg-ad-accent/5 px-4 py-2 text-[13px]" role="status">
          {allMatching ? (
            <>
              <span>{t("c.allMatchingSelected", { n: total })}</span>
              <button type="button" onClick={() => (onAllMatchingChange(false), onSelectedChange?.(new Set()))} className="font-medium text-ad-accent hover:underline">
                {t("c.clearSelection")}
              </button>
            </>
          ) : (
            <>
              <span>{t("c.pageSelected", { n: rows.length })}</span>
              <button type="button" onClick={() => onAllMatchingChange(true)} className="font-medium text-ad-accent hover:underline">
                {t("c.selectAllMatching", { n: total })}
              </button>
            </>
          )}
        </div>
      )}
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full text-[13.5px]">
          <thead>
            <tr className="border-b border-ad-border text-start text-xs text-ad-muted">
              {selectable && (
                <th className="w-10 px-4 py-2.5">
                  <input
                    type="checkbox"
                    checked={Boolean(all)}
                    ref={(el) => {
                      if (el) el.indeterminate = some;
                    }}
                    onChange={() => onSelectedChange?.(all ? new Set() : new Set([...(selected ?? []), ...rows.map((r) => r.id)]))}
                    className="size-4 accent-[var(--ad-accent)]"
                    aria-label={t("c.selectAll")}
                  />
                </th>
              )}
              {columns.map((c) => (
                <th key={c.key} className={cn("whitespace-nowrap px-4 py-2.5 font-medium", c.align === "end" ? "text-end" : c.align === "center" ? "text-center" : "text-start", c.className)}>
                  {c.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-ad-border">
            {rows.map((r) => (
              <tr
                key={r.id}
                onClick={
                  href || onRowClick
                    ? (e) => {
                        const target = e.target as HTMLElement;
                        // React events bubble through portals: ignore clicks from menus/dialogs opened by a cell,
                        // and clicks on the row's own interactive controls.
                        if (!e.currentTarget.contains(target) || target.closest("a,button,input,label,select,[role=menuitem]")) return;
                        if (href) router.push(href(r));
                        else onRowClick?.(r);
                      }
                    : undefined
                }
                className={cn("transition", (href || onRowClick) && "cursor-pointer hover:bg-ad-hover/70", selected?.has(r.id) && "bg-ad-accent/5")}>
                {selectable && (
                  <td className="px-4 py-3">
                    <input type="checkbox" checked={Boolean(selected?.has(r.id))} onChange={() => toggle(r.id)} className="size-4 accent-[var(--ad-accent)]" aria-label={t("c.selectRow")} />
                  </td>
                )}
                {columns.map((c) => (
                  <td key={c.key} className={cn("px-4 py-3", c.align === "end" ? "text-end" : c.align === "center" ? "text-center" : "text-start", c.className)}>
                    {c.cell(r)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <ul className="divide-y divide-ad-border md:hidden">
        {rows.map((r) => (
          <li key={r.id} className={cn("flex items-start gap-3 px-4 py-3.5", selected?.has(r.id) && "bg-ad-accent/5")}>
            {selectable && <input type="checkbox" checked={Boolean(selected?.has(r.id))} onChange={() => toggle(r.id)} className="mt-1 size-4 accent-[var(--ad-accent)]" aria-label={t("c.selectRow")} />}
            <div className="min-w-0 flex-1">{href ? (
                <Link href={href(r)} className="block">
                  {mobile(r)}
                </Link>
              ) : onRowClick ? (
                <div
                  role="button"
                  tabIndex={0}
                  onClick={(e) => {
                    const target = e.target as HTMLElement;
                    if (!e.currentTarget.contains(target) || target.closest("a,button,input,label,select,[role=menuitem]")) return;
                    onRowClick(r);
                  }}
                  onKeyDown={(e) => {
                    if (e.target === e.currentTarget && (e.key === "Enter" || e.key === " ")) {
                      e.preventDefault();
                      onRowClick(r);
                    }
                  }}
                  className="block w-full cursor-pointer rounded-lg text-start focus-visible:outline-2 focus-visible:outline-ad-accent"
                >
                  {mobile(r)}
                </div>
              ) : (
                mobile(r)
              )}</div>
          </li>
        ))}
      </ul>
    </>
  );
}

/** Sticky bar shown while list rows are selected. */
export function BulkBar({ count, onClear, children }: { count: number; onClear: () => void; children: ReactNode }) {
  const { t } = useAdmin();
  if (!count) return null;
  return (
    <div className="animate-fade-up fixed inset-x-3 bottom-20 z-30 mx-auto flex max-w-3xl flex-wrap items-center gap-2 rounded-2xl border border-ad-border bg-ad-panel p-2.5 shadow-pop lg:bottom-6">
      <span className="px-2 text-sm font-medium">{t("c.selected", { n: count })}</span>
      <div className="flex flex-1 flex-wrap items-center gap-1.5">{children}</div>
      <button type="button" onClick={onClear} className="rounded-lg px-2.5 py-1.5 text-xs text-ad-muted hover:bg-ad-hover">
        {t("c.clearSelection")}
      </button>
    </div>
  );
}

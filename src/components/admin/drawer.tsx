"use client";

import { useCallback, useEffect, useMemo, type ReactNode } from "react";
import * as D from "@radix-ui/react-dialog";
import { useSearchParams } from "next/navigation";
import { ChevronRight, X } from "lucide-react";
import { useAdmin } from "./admin-context";
import { cn } from "@/lib/utils";

const WIDTH = {
  sm: "md:w-[min(560px,94vw)]",
  md: "md:w-[min(760px,94vw)]",
  lg: "md:w-[min(1040px,94vw)]",
  xl: "md:w-[min(1280px,96vw)]",
} as const;

/**
 * Management drawer (slides in from the right): an overlay workspace over the current page (the list
 * underneath keeps its scroll, filters and selection — nothing is pushed
 * aside). Large side panel on desktop, wide panel on tablets, full-screen
 * sheet on phones with safe-area padding. Radix provides the focus trap,
 * Escape-to-close and scroll lock; `canClose` lets a dirty form ask first.
 */
export function AdminDrawer({
  open,
  onOpenChange,
  size = "lg",
  label,
  canClose,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  size?: keyof typeof WIDTH;
  /** Accessible name when the header isn't rendered yet (e.g. while loading). */
  label: string;
  canClose?: () => boolean;
  children: ReactNode;
}) {
  const { locale } = useAdmin();
  // Always on the physical right (the reading-start side in Arabic, the usual side in English).
  const side = locale === "ar" ? "start" : "end";
  const change = (o: boolean) => {
    if (!o && canClose && !canClose()) return;
    onOpenChange(o);
  };
  return (
    <D.Root open={open} onOpenChange={change}>
      <D.Portal>
        <D.Overlay className="sheet-overlay fixed inset-0 z-[70] bg-black/35 backdrop-blur-[1px]" />
        <D.Content
          data-side={side}
          aria-describedby={undefined}
          aria-label={label}
          className={cn(
            "sheet fixed inset-y-0 right-0 z-[71] flex w-full flex-col bg-ad-bg text-ad-fg shadow-pop outline-none",
            "pb-[env(safe-area-inset-bottom)] pt-[env(safe-area-inset-top)] md:border-l md:border-ad-border",
            WIDTH[size],
          )}
        >
          {children}
        </D.Content>
      </D.Portal>
    </D.Root>
  );
}

/** Sticky drawer header: context trail, title, status badges, actions and close. */
export function DrawerHeader({ context, title, subtitle, badges, actions }: { context?: string[]; title: ReactNode; subtitle?: ReactNode; badges?: ReactNode; actions?: ReactNode }) {
  const { t } = useAdmin();
  return (
    <header className="sticky top-0 z-10 shrink-0 border-b border-ad-border bg-ad-panel/95 px-4 py-3 backdrop-blur md:px-6">
      {context && context.length > 0 && (
        <p className="mb-1 flex items-center gap-1 truncate text-[11.5px] text-ad-muted">
          {context.map((c, i) => (
            <span key={i} className="flex items-center gap-1">
              {i > 0 && <ChevronRight className="flip-rtl size-3 opacity-60" aria-hidden />}
              {c}
            </span>
          ))}
        </p>
      )}
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <D.Title className="flex flex-wrap items-center gap-2 text-lg font-semibold tracking-tight">
            <span className="truncate">{title}</span>
            {badges}
          </D.Title>
          {subtitle && <p className="mt-0.5 truncate text-[13px] text-ad-muted">{subtitle}</p>}
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          {actions}
          <D.Close className="grid size-9 place-items-center rounded-lg text-ad-muted transition hover:bg-ad-hover hover:text-ad-fg" aria-label={t("c.close")}>
            <X className="size-5" />
          </D.Close>
        </div>
      </div>
    </header>
  );
}

/** Scrolling body. A container, so content adapts to the drawer's width (not the viewport's). */
export function DrawerBody({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("@container min-h-0 flex-1 overflow-y-auto overscroll-contain p-4 md:p-6", className)}>{children}</div>;
}

/** Sticky footer for forms — always visible, never covering content (it's outside the scroll area). */
export function DrawerFooter({ children }: { children: ReactNode }) {
  return <footer className="flex shrink-0 flex-wrap items-center gap-2 border-t border-ad-border bg-ad-panel px-4 py-3 md:px-6">{children}</footer>;
}

/** Placeholder while the record loads — the drawer opens instantly. */
export function DrawerSkeleton() {
  const { t } = useAdmin();
  return (
    <div className="relative flex-1 animate-pulse space-y-4 p-6" aria-busy="true">
      <D.Close className="absolute end-4 top-3 grid size-9 place-items-center rounded-lg text-ad-muted hover:bg-ad-hover" aria-label={t("c.close")}>
        <X className="size-5" />
      </D.Close>
      <div className="h-6 w-1/3 rounded-lg bg-ad-sunken" />
      <div className="h-4 w-1/2 rounded-lg bg-ad-sunken" />
      <div className="grid gap-4 @4xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="h-64 rounded-xl bg-ad-sunken" />
        <div className="h-64 rounded-xl bg-ad-sunken" />
      </div>
    </div>
  );
}

/**
 * Drawer state in the URL (`?order=…`): refresh, deep links, back/forward and
 * sharing all work, while the page itself never re-navigates. Uses the
 * History API, which Next's router keeps in sync with `useSearchParams`.
 */
export function useDrawerParam(name: string) {
  const sp = useSearchParams();
  const value = sp.get(name);
  // Closed by the browser's Back button: the entry we pushed is gone.
  useEffect(() => {
    if (!value && pushedBy === name) pushedBy = null;
  }, [name, value]);
  const write = useCallback(
    (v: string | null, mode: "push" | "replace") => {
      const p = new URLSearchParams(window.location.search);
      if (v) p.set(name, v);
      else p.delete(name);
      const qs = p.toString();
      const url = `${window.location.pathname}${qs ? `?${qs}` : ""}`;
      if (mode === "push") window.history.pushState(null, "", url);
      else window.history.replaceState(null, "", url);
    },
    [name],
  );
  return useMemo(
    () => ({
      value,
      open: (v: string) => {
        // First open adds one history entry (so Back closes the drawer); switching records replaces it.
        if (!value) pushedBy = name;
        write(v, value ? "replace" : "push");
      },
      close: () => {
        if (pushedBy === name) {
          pushedBy = null;
          window.history.back();
        } else write(null, "replace");
      },
    }),
    [name, value, write],
  );
}

/** Which drawer added the current history entry (if any) — closing it steps back instead of stacking entries. */
let pushedBy: string | null = null;

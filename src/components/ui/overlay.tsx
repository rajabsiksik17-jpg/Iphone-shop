"use client";

import * as D from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

/** Accessible modal dialog (focus trap, Esc, scroll lock via Radix). */
export function Modal({
  open,
  onOpenChange,
  title,
  description,
  children,
  className,
  closeLabel = "Close",
  hideTitle,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  title: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  className?: string;
  closeLabel?: string;
  hideTitle?: boolean;
}) {
  return (
    <D.Root open={open} onOpenChange={onOpenChange}>
      <D.Portal>
        <D.Overlay className="sheet-overlay fixed inset-0 z-[80] bg-black/45 backdrop-blur-[2px]" />
        <D.Content
          className={cn(
            "dialog-content fixed inset-x-3 bottom-3 top-auto z-[81] max-h-[88dvh] overflow-y-auto rounded-3xl bg-bg p-6 shadow-pop outline-none sm:inset-x-auto sm:start-1/2 sm:top-1/2 sm:bottom-auto sm:w-full sm:max-w-lg sm:-translate-y-1/2 sm:ltr:-translate-x-1/2 sm:rtl:translate-x-1/2",
            className,
          )}
        >
          <div className={cn("mb-4 pe-10", hideTitle && "sr-only")}>
            <D.Title className="text-lg font-semibold tracking-tight">{title}</D.Title>
            {description && <D.Description className="mt-1 text-sm text-muted">{description}</D.Description>}
          </div>
          {children}
          <D.Close className="absolute end-4 top-4 grid size-9 place-items-center rounded-full text-muted transition hover:bg-surface hover:text-fg" aria-label={closeLabel}>
            <X className="size-5" />
          </D.Close>
        </D.Content>
      </D.Portal>
    </D.Root>
  );
}

/**
 * Side/bottom sheet. `side` is logical (start/end) so drawers open from the
 * correct edge in both RTL and LTR.
 */
export function Sheet({
  open,
  onOpenChange,
  side = "end",
  title,
  children,
  className,
  closeLabel = "Close",
  header,
  footer,
  hideTitle,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  side?: "start" | "end" | "bottom";
  title: ReactNode;
  children: ReactNode;
  className?: string;
  closeLabel?: string;
  header?: ReactNode;
  footer?: ReactNode;
  hideTitle?: boolean;
}) {
  return (
    <D.Root open={open} onOpenChange={onOpenChange}>
      <D.Portal>
        <D.Overlay className="sheet-overlay fixed inset-0 z-[70] bg-black/40 backdrop-blur-[2px]" />
        <D.Content
          data-side={side}
          aria-describedby={undefined}
          className={cn(
            "sheet fixed z-[71] flex flex-col bg-bg shadow-pop outline-none",
            side === "bottom" ? "inset-x-0 bottom-0 max-h-[92dvh] rounded-t-3xl" : "inset-y-0 w-[min(440px,92vw)]",
            side === "end" && "end-0",
            side === "start" && "start-0",
            className,
          )}
        >
          {side === "bottom" && <div className="mx-auto mt-2.5 h-1.5 w-10 shrink-0 rounded-full bg-border" aria-hidden />}
          <div className={cn("flex shrink-0 items-center justify-between gap-3 border-b border-border px-5 py-4", hideTitle && "sr-only")}>
            <D.Title className="text-base font-semibold tracking-tight">{title}</D.Title>
            {header}
            <D.Close className="-me-2 grid size-10 place-items-center rounded-full text-muted transition hover:bg-surface hover:text-fg" aria-label={closeLabel}>
              <X className="size-5" />
            </D.Close>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">{children}</div>
          {footer && <div className="shrink-0 border-t border-border bg-bg px-5 py-4 pb-[max(1rem,env(safe-area-inset-bottom))]">{footer}</div>}
        </D.Content>
      </D.Portal>
    </D.Root>
  );
}

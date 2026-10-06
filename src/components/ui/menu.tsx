"use client";

import * as DM from "@radix-ui/react-dropdown-menu";
import * as T from "@radix-ui/react-tooltip";
import * as P from "@radix-ui/react-popover";
import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

export const Dropdown = DM.Root;
export const DropdownTrigger = DM.Trigger;

export function DropdownContent({ children, className, align = "end", sideOffset = 8 }: { children: ReactNode; className?: string; align?: "start" | "end" | "center"; sideOffset?: number }) {
  return (
    <DM.Portal>
      <DM.Content align={align} sideOffset={sideOffset} className={cn("pop z-[90] min-w-52 overflow-hidden rounded-2xl border border-border bg-bg p-1.5 shadow-pop", className)}>
        {children}
      </DM.Content>
    </DM.Portal>
  );
}

export function DropdownItem({ children, className, ...props }: DM.DropdownMenuItemProps) {
  return (
    <DM.Item
      className={cn(
        "flex cursor-pointer select-none items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm outline-none transition data-[highlighted]:bg-surface data-[disabled]:pointer-events-none data-[disabled]:opacity-50 [&_svg]:size-4 [&_svg]:text-muted",
        className,
      )}
      {...props}
    >
      {children}
    </DM.Item>
  );
}

export const DropdownSeparator = () => <DM.Separator className="my-1 h-px bg-border" />;
export const DropdownLabel = ({ children }: { children: ReactNode }) => <DM.Label className="px-3 py-1.5 text-xs font-medium text-muted">{children}</DM.Label>;

export function Tooltip({ content, children, side = "top" }: { content: ReactNode; children: ReactNode; side?: "top" | "bottom" | "left" | "right" }) {
  return (
    <T.Root delayDuration={250}>
      <T.Trigger asChild>{children}</T.Trigger>
      <T.Portal>
        <T.Content side={side} sideOffset={6} className="pop z-[95] max-w-64 rounded-lg bg-neutral-900 px-2.5 py-1.5 text-xs font-medium text-white shadow-lg">
          {content}
          <T.Arrow className="fill-neutral-900" />
        </T.Content>
      </T.Portal>
    </T.Root>
  );
}

export const TooltipProvider = T.Provider;

export const Popover = P.Root;
export const PopoverTrigger = P.Trigger;
export const PopoverAnchor = P.Anchor;
export function PopoverContent({ children, className, align = "start", sideOffset = 8, ...props }: P.PopoverContentProps) {
  return (
    <P.Portal>
      <P.Content align={align} sideOffset={sideOffset} className={cn("pop z-[90] rounded-2xl border border-border bg-bg p-4 shadow-pop outline-none", className)} {...props}>
        {children}
      </P.Content>
    </P.Portal>
  );
}

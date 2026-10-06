import { Children, cloneElement, isValidElement, type HTMLAttributes, type ReactElement, type ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Minimal Slot: merges props/className onto the single child (for `asChild`). */
export function Slot({ children, className, ...props }: HTMLAttributes<HTMLElement> & { children?: ReactNode }) {
  const child = Children.only(children);
  if (!isValidElement(child)) return null;
  const el = child as ReactElement<{ className?: string }>;
  return cloneElement(el, { ...props, ...el.props, className: cn(className, el.props.className) });
}

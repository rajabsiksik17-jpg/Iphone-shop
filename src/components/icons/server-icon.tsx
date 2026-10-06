import "server-only";
import { icons } from "lucide-react";
import { cn } from "@/lib/utils";
import { parseIcon, type IconValue } from "./icon-value";

/**
 * Server-rendered icon: Lucide icons are resolved on the server so the
 * storefront ships no icon library; custom icons are inlined, already
 * sanitised at upload time. `customSvgs` maps CustomIcon ids → markup.
 */
export function ServerIcon({ value, className, customSvgs, fallback }: { value: IconValue; className?: string; customSvgs?: Record<string, string>; fallback?: string }) {
  const parsed = parseIcon(value) ?? (fallback ? parseIcon(fallback) : null);
  if (!parsed) return null;
  if (parsed.kind === "custom") {
    const svg = customSvgs?.[parsed.id];
    if (!svg) return null;
    return <span aria-hidden className={cn("inline-block [&>svg]:size-full", className)} dangerouslySetInnerHTML={{ __html: svg }} />;
  }
  const I = icons[parsed.name as keyof typeof icons];
  if (!I) return null;
  return <I aria-hidden className={className} strokeWidth={1.75} />;
}

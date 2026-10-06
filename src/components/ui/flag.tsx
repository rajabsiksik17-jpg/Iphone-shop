import { AE, BH, DZ, EG, EU, GB, IQ, JO, KW, MA, OM, QA, SA, TN, TR, US } from "country-flag-icons/react/3x2";
import { Globe } from "lucide-react";
import { cn } from "@/lib/utils";

// Only the flags the currency catalogue uses (named imports tree-shake the rest).
const FLAGS: Record<string, typeof SA> = { AE, BH, DZ, EG, EU, GB, IQ, JO, KW, MA, OM, QA, SA, TN, TR, US };

/** SVG flag (emoji flags don't render on Windows). Falls back to a globe. */
export function Flag({ code, className, title }: { code: string | null | undefined; className?: string; title?: string }) {
  const F = code ? FLAGS[code.toUpperCase()] : undefined;
  if (!F) return <Globe className={cn("size-4 text-muted", className)} aria-hidden />;
  return <F title={title ?? ""} aria-hidden={!title} className={cn("h-3.5 w-[1.3rem] shrink-0 rounded-[3px] object-cover shadow-[0_0_0_1px_rgb(0_0_0/0.08)]", className)} />;
}

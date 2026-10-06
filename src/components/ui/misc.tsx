import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

export function Badge({ children, className, tone = "neutral", style }: { children: ReactNode; className?: string; tone?: "neutral" | "accent" | "sale" | "success" | "warning" | "danger" | "custom"; style?: React.CSSProperties }) {
  const tones = {
    neutral: "bg-surface text-fg/80",
    accent: "bg-accent/10 text-accent",
    sale: "bg-sale text-white",
    success: "bg-emerald-500/12 text-emerald-700 dark:text-emerald-400",
    warning: "bg-amber-500/14 text-amber-700 dark:text-amber-400",
    danger: "bg-red-500/12 text-red-700 dark:text-red-400",
    custom: "",
  };
  return (
    <span style={style} className={cn("inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide", tones[tone], className)}>
      {children}
    </span>
  );
}

export function EmptyState({ icon, title, text, action, className }: { icon: ReactNode; title: ReactNode; text?: ReactNode; action?: ReactNode; className?: string }) {
  return (
    <div className={cn("flex flex-col items-center justify-center px-6 py-16 text-center", className)}>
      <div className="relative mb-6">
        <div className="absolute inset-0 -z-10 scale-150 rounded-full bg-accent/10 blur-2xl" aria-hidden />
        <div className="grid size-20 place-items-center rounded-3xl border border-border bg-bg text-accent shadow-card [&_svg]:size-9 [&_svg]:stroke-[1.5]">{icon}</div>
      </div>
      <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
      {text && <p className="mt-2 max-w-sm text-sm text-pretty text-muted">{text}</p>}
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}

export function SectionHeading({ title, subtitle, action, className, align = "start" }: { title?: ReactNode; subtitle?: ReactNode; action?: ReactNode; className?: string; align?: "start" | "center" }) {
  if (!title && !subtitle) return null;
  return (
    <div className={cn("mb-6 flex items-end justify-between gap-4 sm:mb-8", align === "center" && "flex-col items-center text-center", className)}>
      <div className="min-w-0">
        {title && <h2 className="text-2xl font-semibold tracking-tight text-balance sm:text-[1.75rem]">{title}</h2>}
        {subtitle && <p className="mt-1.5 text-[15px] text-muted text-pretty">{subtitle}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

export function Kbd({ children }: { children: ReactNode }) {
  return <kbd className="rounded-md border border-current/20 px-1.5 py-0.5 font-sans text-[11px] font-medium opacity-70">{children}</kbd>;
}

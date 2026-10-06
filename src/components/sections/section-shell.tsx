import { cn } from "@/lib/utils";
import type { SectionStyle } from "@/cms/sections";
import type { ReactNode } from "react";

/** Applies the per-section appearance options edited alongside the content. */
export function SectionShell({ style, children, className, flush }: { style: SectionStyle; children: ReactNode; className?: string; flush?: boolean }) {
  const bg = {
    none: "",
    surface: "bg-surface",
    dark: "bg-[#0b0f17] text-white [--color-muted:rgb(255_255_255/0.65)] [--color-border:rgb(255_255_255/0.12)] [--color-fg:#fff] [--color-bg:#0b0f17] [--color-surface:rgb(255_255_255/0.06)]",
    accent: "bg-accent text-accent-fg [--color-muted:rgb(255_255_255/0.75)]",
    custom: "",
  }[style.background];
  const pad = { none: "py-0", sm: "py-6 md:py-8", md: "py-12 md:py-16", lg: "py-16 md:py-24" }[style.paddingY];
  return (
    <section
      id={style.anchor || undefined}
      className={cn(bg, pad, style.hideOnMobile && "max-md:hidden", style.hideOnDesktop && "md:hidden", style.align === "center" && "text-center", className)}
      style={style.background === "custom" && style.customBackground ? { backgroundColor: style.customBackground } : undefined}
    >
      <div className={cn(!flush && style.width === "contained" && "container-store", style.animate && "reveal")}>{children}</div>
    </section>
  );
}

import type { ReactNode } from "react";

export default function AdminAuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="relative grid min-h-dvh place-items-center overflow-hidden bg-ad-bg px-4 py-10 text-ad-fg">
      <div className="pointer-events-none absolute inset-0 [background-image:radial-gradient(circle_at_1px_1px,var(--ad-border)_1px,transparent_0)] [background-size:22px_22px] opacity-70" aria-hidden />
      <div className="pointer-events-none absolute -top-48 start-1/2 size-[560px] -translate-x-1/2 rounded-full bg-ad-accent/15 blur-3xl rtl:translate-x-1/2" aria-hidden />
      <div className="relative w-full max-w-sm rounded-2xl border border-ad-border bg-ad-panel p-7 shadow-pop">{children}</div>
    </div>
  );
}

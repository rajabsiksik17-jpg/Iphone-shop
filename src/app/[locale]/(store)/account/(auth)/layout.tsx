import type { ReactNode } from "react";
import type { Metadata } from "next";

export const metadata: Metadata = { robots: { index: false, follow: false } };

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="relative overflow-hidden">
      <div className="pointer-events-none absolute -top-40 start-1/2 size-[520px] -translate-x-1/2 rounded-full bg-accent/10 blur-3xl rtl:translate-x-1/2" aria-hidden />
      <div className="container-store relative grid min-h-[70dvh] place-items-center py-12">
        <div className="w-full max-w-md rounded-[calc(var(--nq-radius)*1.6)] border border-border bg-bg p-6 shadow-card sm:p-9">{children}</div>
      </div>
    </div>
  );
}

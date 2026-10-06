import type { ReactNode } from "react";
import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import type { Locale } from "@/i18n/config";

export const metadata: Metadata = {
  title: { default: "Admin", template: "%s · Admin" },
  robots: { index: false, follow: false, nocache: true },
};

// Applied before first paint: admin token mapping + saved light/dark theme (no flash).
const THEME_BOOT = `(function(){var d=document.documentElement;d.classList.add('admin-mode');try{var t=localStorage.getItem('nq:admin-theme')||'system';var dark=t==='dark'||(t==='system'&&window.matchMedia('(prefers-color-scheme: dark)').matches);d.classList.toggle('ad-dark',dark)}catch(e){}})();`;

export default async function AdminRootLayout({ children, params }: { children: ReactNode; params: Promise<{ locale: string }> }) {
  setRequestLocale((await params).locale as Locale);
  return (
    <>
      <script dangerouslySetInnerHTML={{ __html: THEME_BOOT }} />
      {children}
    </>
  );
}

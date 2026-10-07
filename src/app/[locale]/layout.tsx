import type { ReactNode } from "react";
import Script from "next/script";
import { ADMIN_MODE_BOOT } from "@/lib/admin-mode-boot";
import type { Viewport } from "next";
import { notFound } from "next/navigation";
import { NextIntlClientProvider, hasLocale } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { Cairo, DM_Sans, Geist, IBM_Plex_Sans_Arabic, Inter, Manrope, Noto_Kufi_Arabic, Tajawal } from "next/font/google";
import { routing } from "@/i18n/routing";
import { localeMeta } from "@/i18n/config";
import { getSettings } from "@/server/settings/service";
import { themeCss } from "@/server/storefront";
import { Toaster } from "@/components/providers/toaster";
import { cn } from "@/lib/utils";

// Default pair preloaded; alternates are declared (CSS only) so the theme can
// switch fonts from the admin without a deploy. Browsers download only what's used.
const geist = Geist({ subsets: ["latin"], variable: "--font-geist", display: "swap" });
const plexArabic = IBM_Plex_Sans_Arabic({ subsets: ["arabic"], weight: ["400", "500", "600", "700"], variable: "--font-plex-arabic", display: "swap" });
const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap", preload: false });
const manrope = Manrope({ subsets: ["latin"], variable: "--font-manrope", display: "swap", preload: false });
const dmSans = DM_Sans({ subsets: ["latin"], variable: "--font-dm-sans", display: "swap", preload: false });
const kufi = Noto_Kufi_Arabic({ subsets: ["arabic"], variable: "--font-noto-kufi", display: "swap", preload: false });
const tajawal = Tajawal({ subsets: ["arabic"], weight: ["400", "500", "700"], variable: "--font-tajawal", display: "swap", preload: false });
const cairo = Cairo({ subsets: ["arabic"], variable: "--font-cairo", display: "swap", preload: false });

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [{ media: "(prefers-color-scheme: light)", color: "#ffffff" }],
};

export default async function LocaleLayout({ children, params }: { children: ReactNode; params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const appearance = await getSettings("appearance");
  const meta = localeMeta[locale];

  return (
    <html lang={locale} dir={meta.dir} className={cn(geist.variable, plexArabic.variable, inter.variable, manrope.variable, dmSans.variable, kufi.variable, tajawal.variable, cairo.variable)} suppressHydrationWarning>
      <head>
        <style id="nq-theme" dangerouslySetInnerHTML={{ __html: themeCss(appearance) }} />
        {/* Admin URLs: apply admin tokens + saved theme before first paint (no flash). */}
        <Script id="nq-admin-mode" strategy="beforeInteractive">
          {ADMIN_MODE_BOOT}
        </Script>
      </head>
      <body className="min-h-dvh">
        <NextIntlClientProvider>
          {children}
          <Toaster dir={meta.dir} />
        </NextIntlClientProvider>
      </body>
    </html>
  );
}

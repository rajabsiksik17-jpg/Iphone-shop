import type { ReactNode } from "react";
import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { AdminMode } from "@/components/admin/admin-mode";
import type { Locale } from "@/i18n/config";

export const metadata: Metadata = {
  title: { default: "Admin", template: "%s · Admin" },
  robots: { index: false, follow: false, nocache: true },
};

export default async function AdminRootLayout({ children, params }: { children: ReactNode; params: Promise<{ locale: string }> }) {
  setRequestLocale((await params).locale as Locale);
  return (
    <>
      <AdminMode />
      {children}
    </>
  );
}

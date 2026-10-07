import type { ReactNode } from "react";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { getLocale } from "next-intl/server";
import { getCurrentUser } from "@/server/auth/session";
import { db } from "@/server/db";
import { AccountNav } from "@/components/store/account/nav";
import type { Locale } from "@/i18n/config";

export const metadata: Metadata = { robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function AccountLayout({ children }: { children: ReactNode }) {
  const locale = (await getLocale()) as Locale;
  const user = await getCurrentUser();
  if (!user) return redirect({ href: "/account/login?next=/account", locale });
  const t = await getTranslations("account");
  const unread = await db.notification.count({ where: { userId: user.id, audience: "CUSTOMER", reads: { none: { userId: user.id } } } });
  return (
    <div className="container-store py-8 md:py-12">
      <div className="mb-8 flex items-center gap-4">
        <span className="grid size-14 place-items-center rounded-full bg-primary text-xl font-semibold text-primary-fg">{user.name.slice(0, 1).toUpperCase()}</span>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{t("welcome", { name: user.name.split(" ")[0] })}</h1>
          <p className="text-sm text-muted">{t("memberSince", { date: user.createdAt.toLocaleDateString(locale === "ar" ? "ar-SA-u-ca-gregory-nu-latn" : "en-GB", { month: "long", year: "numeric" }) })}</p>
        </div>
      </div>
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[240px_minmax(0,1fr)]">
        <aside className="lg:sticky lg:top-32 lg:self-start">
          <AccountNav unread={unread} />
        </aside>
        <div className="min-w-0">{children}</div>
      </div>
    </div>
  );
}

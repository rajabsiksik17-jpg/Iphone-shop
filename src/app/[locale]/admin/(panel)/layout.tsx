import type { ReactNode } from "react";
import { getLocale } from "next-intl/server";
import { Link, redirect } from "@/i18n/navigation";
import { getCurrentStaff } from "@/server/auth/session";
import { adminCounters } from "@/server/admin/counters";
import { moneyContext } from "@/server/commerce/currency";
import { getManySettings } from "@/server/settings/service";
import { AdminProvider } from "@/components/admin/admin-context";
import { AdminShell } from "@/components/admin/shell";
import { t } from "@/lib/i18n-text";
import type { Locale } from "@/i18n/config";

export const dynamic = "force-dynamic";

export default async function AdminPanelLayout({ children }: { children: ReactNode }) {
  const locale = (await getLocale()) as Locale;
  const staff = await getCurrentStaff();
  if (!staff) return redirect({ href: "/admin/login", locale });
  const [counters, money, settings, avatar] = await Promise.all([
    adminCounters(staff),
    moneyContext(locale),
    getManySettings(["store", "notifications"]),
    staff.avatarId ? import("@/server/db").then(({ db }) => db.media.findUnique({ where: { id: staff.avatarId! }, select: { url: true } })) : null,
  ]);
  return (
    <AdminProvider
      locale={locale}
      user={{ id: staff.id, name: staff.name, email: staff.email, avatar: avatar?.url ?? null, role: t(staff.role?.name, locale) || "Staff", permissions: [...staff.permissions], agentStatus: staff.agentStatus }}
      initialCounters={counters}
      money={money}
      storeName={t(settings.store.name, locale)}
      soundDefault={settings.notifications.sound}
    >
      <AdminShell>
        {(staff.preferences as { mustChangePassword?: boolean } | null)?.mustChangePassword && (
          // Accounts created or reset with a temporary password are asked to replace it.
          <div role="alert" className="mb-5 flex flex-wrap items-center gap-3 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
            <span className="flex-1">{locale === "ar" ? "أنت تستخدم كلمة مرور مؤقتة. يرجى تغييرها الآن." : "You're using a temporary password. Please change it now."}</span>
            <Link href="/admin/profile#password" className="font-medium underline">
              {locale === "ar" ? "تغيير كلمة المرور" : "Change password"}
            </Link>
          </div>
        )}
        {children}
      </AdminShell>
    </AdminProvider>
  );
}

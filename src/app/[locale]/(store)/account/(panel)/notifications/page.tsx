import { getTranslations, setRequestLocale } from "next-intl/server";
import { db } from "@/server/db";
import { customerOrRedirect } from "@/server/auth/page-guards";
import { NotificationsList } from "@/components/store/account/forms";
import { t as tr } from "@/lib/i18n-text";
import type { Locale } from "@/i18n/config";

export default async function NotificationsPage({ params }: { params: Promise<{ locale: string }> }) {
  const locale = (await params).locale as Locale;
  setRequestLocale(locale);
  const user = await customerOrRedirect();
  const t = await getTranslations("account");
  const rows = await db.notification.findMany({ where: { userId: user.id, audience: "CUSTOMER" }, orderBy: { createdAt: "desc" }, take: 100, include: { reads: { where: { userId: user.id } } } });
  return (
    <section>
      <h2 className="mb-4 text-xl font-semibold">{t("notifications")}</h2>
      <NotificationsList items={rows.map((n) => ({ id: n.id, title: tr(n.title, locale), body: tr(n.body, locale), link: n.link, createdAt: n.createdAt.toISOString(), read: n.reads.length > 0 }))} />
    </section>
  );
}

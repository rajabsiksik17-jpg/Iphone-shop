import { getTranslations, setRequestLocale } from "next-intl/server";
import { Coins } from "lucide-react";
import { db } from "@/server/db";
import { customerOrRedirect } from "@/server/auth/page-guards";
import { getSettings } from "@/server/settings/service";
import { formatBase } from "@/server/commerce/currency";
import { EmptyState } from "@/components/ui/misc";
import { cn } from "@/lib/utils";
import type { Locale } from "@/i18n/config";

export default async function PointsPage({ params }: { params: Promise<{ locale: string }> }) {
  const locale = (await params).locale as Locale;
  setRequestLocale(locale);
  const user = await customerOrRedirect();
  const t = await getTranslations("account");
  const [loyalty, history] = await Promise.all([getSettings("loyalty"), db.pointsTransaction.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, take: 100 })]);
  return (
    <section className="space-y-6">
      <div className="relative overflow-hidden rounded-[calc(var(--nq-radius)*1.4)] bg-gradient-to-br from-[#1e1b4b] to-[#4338ca] p-7 text-white">
        <Coins className="absolute -end-6 -top-6 size-40 opacity-10" />
        <p className="text-sm text-white/70">{t("pointsBalance")}</p>
        <p className="tabular mt-1 text-5xl font-semibold tracking-tight">{user.pointsBalance.toLocaleString(locale === "ar" ? "ar-JO" : "en-US")}</p>
        {loyalty.enabled && <p className="mt-2 text-sm text-white/80">{t("pointsWorth", { value: await formatBase(user.pointsBalance * loyalty.pointValue, locale) })}</p>}
      </div>
      <div>
        <h2 className="mb-4 text-lg font-semibold">{t("pointsHistory")}</h2>
        {history.length ? (
          <ul className="divide-y divide-border rounded-card border border-border">
            {history.map((h) => (
              <li key={h.id} className="flex items-center justify-between gap-3 p-4 text-sm">
                <div>
                  <p className="font-medium">{t(`pointsReasons.${h.reason}`)}</p>
                  <p className="text-xs text-muted">{h.createdAt.toLocaleDateString(locale === "ar" ? "ar-JO" : "en-GB", { dateStyle: "medium" })}</p>
                </div>
                <span className={cn("tabular font-semibold", h.delta > 0 ? "text-success" : "text-fg/70")}>
                  {h.delta > 0 ? "+" : ""}
                  {h.delta}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState icon={<Coins />} title={t("noPoints")} className="rounded-card border border-dashed border-border" />
        )}
      </div>
    </section>
  );
}

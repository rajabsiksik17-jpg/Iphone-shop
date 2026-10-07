import { getTranslations, setRequestLocale } from "next-intl/server";
import { Package, ChevronRight } from "lucide-react";
import { db } from "@/server/db";
import { customerOrRedirect } from "@/server/auth/page-guards";
import { formatBase } from "@/server/commerce/currency";
import { Link } from "@/i18n/navigation";
import { EmptyState } from "@/components/ui/misc";
import { StatusPill } from "@/components/store/account/status-badge";
import { t as tr } from "@/lib/i18n-text";
import type { Locale } from "@/i18n/config";

export default async function OrdersPage({ params }: { params: Promise<{ locale: string }> }) {
  const locale = (await params).locale as Locale;
  setRequestLocale(locale);
  const user = await customerOrRedirect();
  const t = await getTranslations();
  const orders = await db.order.findMany({ where: { userId: user.id }, orderBy: { placedAt: "desc" }, include: { status: true, _count: { select: { items: true } } }, take: 100 });
  return (
    <section>
      <h2 className="mb-5 text-xl font-semibold">{t("account.orders")}</h2>
      {orders.length ? (
        <div className="overflow-hidden rounded-card border border-border">
          <ul className="divide-y divide-border">
            {await Promise.all(
              orders.map(async (o) => (
                <li key={o.id}>
                  <Link href={`/account/orders/${o.number}`} className="grid grid-cols-[1fr_auto] items-center gap-3 p-4 transition hover:bg-surface/60 sm:grid-cols-[1.2fr_1fr_1fr_auto_auto]">
                    <div>
                      <p className="font-medium">{o.number}</p>
                      <p className="text-xs text-muted sm:hidden">{o.placedAt.toLocaleDateString(locale === "ar" ? "ar-SA-u-ca-gregory-nu-latn" : "en-GB", { dateStyle: "medium" })}</p>
                    </div>
                    <p className="hidden text-sm text-muted sm:block">{o.placedAt.toLocaleDateString(locale === "ar" ? "ar-SA-u-ca-gregory-nu-latn" : "en-GB", { dateStyle: "medium" })}</p>
                    <p className="hidden text-sm text-muted sm:block">{t("common.items", { count: o._count.items })}</p>
                    <div className="flex items-center gap-3 sm:contents">
                      <StatusPill label={tr(o.status.label, locale)} color={o.status.color} />
                      <span className="tabular text-sm font-semibold">{await formatBase(o.total, locale)}</span>
                    </div>
                    <ChevronRight className="flip-rtl hidden size-4 text-muted sm:block" />
                  </Link>
                </li>
              )),
            )}
          </ul>
        </div>
      ) : (
        <EmptyState icon={<Package />} title={t("account.noOrders")} text={t("account.noOrdersHint")} className="rounded-card border border-dashed border-border" />
      )}
    </section>
  );
}

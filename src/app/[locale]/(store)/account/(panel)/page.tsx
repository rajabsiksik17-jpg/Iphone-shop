import { getTranslations, setRequestLocale } from "next-intl/server";
import { Package, Coins, Heart, MapPin, ChevronRight } from "lucide-react";
import { db } from "@/server/db";
import { customerOrRedirect } from "@/server/auth/page-guards";
import { formatBase } from "@/server/commerce/currency";
import { getSettings } from "@/server/settings/service";
import { Link } from "@/i18n/navigation";
import { EmptyState } from "@/components/ui/misc";
import { Button } from "@/components/ui/button";
import { StatusPill } from "@/components/store/account/status-badge";
import { t as tr } from "@/lib/i18n-text";
import type { Locale } from "@/i18n/config";

export default async function AccountDashboard({ params }: { params: Promise<{ locale: string }> }) {
  const locale = (await params).locale as Locale;
  setRequestLocale(locale);
  const user = await customerOrRedirect();
  const t = await getTranslations();
  const [orders, orderCount, wishCount, addressCount, loyalty] = await Promise.all([
    db.order.findMany({ where: { userId: user.id }, orderBy: { placedAt: "desc" }, take: 4, include: { status: true, items: { take: 3 } } }),
    db.order.count({ where: { userId: user.id } }),
    db.wishlistItem.count({ where: { userId: user.id } }),
    db.address.count({ where: { userId: user.id } }),
    getSettings("loyalty"),
  ]);
  const stats = [
    { href: "/account/orders", icon: Package, label: t("account.orders"), value: orderCount },
    ...(loyalty.enabled ? [{ href: "/account/points", icon: Coins, label: t("account.points"), value: user.pointsBalance }] : []),
    { href: "/wishlist", icon: Heart, label: t("account.wishlist"), value: wishCount },
    { href: "/account/addresses", icon: MapPin, label: t("account.addresses"), value: addressCount },
  ];
  return (
    <div className="space-y-8">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {stats.map(({ href, icon: Icon, label, value }) => (
          <Link key={href} href={href} className="group rounded-card border border-border p-5 transition hover:border-fg/20 hover:shadow-card">
            <Icon className="size-5 text-muted transition group-hover:text-accent" />
            <p className="tabular mt-4 text-2xl font-semibold">{value}</p>
            <p className="text-sm text-muted">{label}</p>
          </Link>
        ))}
      </div>
      <section>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">{t("account.recentOrders")}</h2>
          {orderCount > 0 && (
            <Link href="/account/orders" className="text-sm text-muted hover:text-fg">
              {t("common.viewAll")}
            </Link>
          )}
        </div>
        {orders.length ? (
          <ul className="divide-y divide-border rounded-card border border-border">
            {await Promise.all(
              orders.map(async (o) => (
                <li key={o.id}>
                  <Link href={`/account/orders/${o.number}`} className="flex items-center gap-4 p-4 transition hover:bg-surface/60">
                    <div className="flex -space-x-3 rtl:space-x-reverse">
                      {o.items.map((i) => (i.imageUrl ? <img key={i.id} src={i.imageUrl} alt="" className="size-11 rounded-lg border-2 border-bg bg-surface object-cover" /> : null))}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-medium">{o.number}</p>
                      <p className="text-xs text-muted">{o.placedAt.toLocaleDateString(locale === "ar" ? "ar-SA-u-ca-gregory-nu-latn" : "en-GB", { dateStyle: "medium" })}</p>
                    </div>
                    <StatusPill label={tr(o.status.label, locale)} color={o.status.color} />
                    <span className="tabular hidden w-24 text-end text-sm font-semibold sm:block">{await formatBase(o.total, locale)}</span>
                    <ChevronRight className="flip-rtl size-4 text-muted" />
                  </Link>
                </li>
              )),
            )}
          </ul>
        ) : (
          <EmptyState
            icon={<Package />}
            title={t("account.noOrders")}
            text={t("account.noOrdersHint")}
            action={
              <Button asChild>
                <Link href="/shop">{t("cart.startShopping")}</Link>
              </Button>
            }
            className="rounded-card border border-dashed border-border"
          />
        )}
      </section>
    </div>
  );
}

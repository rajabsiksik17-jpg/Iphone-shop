import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Check, Truck, ExternalLink } from "lucide-react";
import { db } from "@/server/db";
import { customerOrRedirect } from "@/server/auth/page-guards";
import { formatBase } from "@/server/commerce/currency";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { StatusPill } from "@/components/store/account/status-badge";
import { ReorderButton } from "@/components/store/account/forms";
import { t as tr } from "@/lib/i18n-text";
import { cn } from "@/lib/utils";
import type { Locale } from "@/i18n/config";

export default async function OrderDetail({ params }: { params: Promise<{ locale: string; number: string }> }) {
  const { number } = await params;
  const locale = (await params).locale as Locale;
  setRequestLocale(locale);
  const user = await customerOrRedirect();
  const order = await db.order.findFirst({
    where: { number: decodeURIComponent(number), userId: user.id },
    include: { status: true, items: { include: { product: { select: { slug: true, status: true } } } }, history: { orderBy: { createdAt: "asc" } }, discounts: true },
  });
  if (!order) notFound();
  const t = await getTranslations();
  const statuses = await db.orderStatus.findMany();
  const label = (k: string) => tr(statuses.find((s) => s.key === k)?.label, locale) || k;
  const fmt = (n: number) => formatBase(n, locale);
  const dateFmt = (d: Date) => d.toLocaleString(locale === "ar" ? "ar-JO" : "en-GB", { dateStyle: "medium", timeStyle: "short" });
  const address = order.shippingAddress as Record<string, string>;
  const reorderable = order.items.filter((i) => i.productId && i.product?.status === "ACTIVE");

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <Link href="/account/orders" className="text-sm text-muted hover:text-fg">
            ← {t("account.orders")}
          </Link>
          <h2 className="mt-1 flex items-center gap-3 text-2xl font-semibold">
            {order.number} <StatusPill label={tr(order.status.label, locale)} color={order.status.color} />
          </h2>
          <p className="text-sm text-muted">{t("order.placedOn", { date: dateFmt(order.placedAt) })}</p>
        </div>
        {reorderable.length > 0 && (
          <ReorderButton items={reorderable.map((i) => ({ productId: i.productId!, variantId: i.variantId, quantity: i.quantity, name: tr(i.name, locale), price: i.unitPrice }))} />
        )}
      </div>

      {order.trackingNumber && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-card bg-surface p-5">
          <div className="flex items-center gap-3">
            <Truck className="size-5" />
            <div>
              <p className="text-sm font-medium">{t("order.tracking")}</p>
              <p className="tabular text-sm text-muted">
                {order.carrier ? `${order.carrier} · ` : ""}
                {order.trackingNumber}
              </p>
            </div>
          </div>
          {order.trackingUrl && /^https?:\/\//.test(order.trackingUrl) && (
            <Button asChild size="sm" variant="outline" rightIcon={<ExternalLink />}>
              <a href={order.trackingUrl} target="_blank" rel="noopener noreferrer">
                {t("order.trackPackage")}
              </a>
            </Button>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <div className="rounded-card border border-border p-5">
          <ul className="divide-y divide-border">
            {await Promise.all(
              order.items.map(async (i) => (
                <li key={i.id} className="flex items-center gap-4 py-3 first:pt-0">
                  {i.imageUrl && <img src={i.imageUrl} alt="" className="size-16 rounded-xl bg-surface object-cover" />}
                  <div className="min-w-0 flex-1">
                    {i.product?.slug ? (
                      <Link href={`/product/${i.product.slug}`} className="text-sm font-medium hover:underline">
                        {tr(i.name, locale)}
                      </Link>
                    ) : (
                      <p className="text-sm font-medium">{tr(i.name, locale)}</p>
                    )}
                    {i.variantLabel && <p className="text-xs text-muted">{tr(i.variantLabel, locale)}</p>}
                    <p className="text-xs text-muted">
                      {await fmt(i.unitPrice)} × {i.quantity}
                    </p>
                  </div>
                  <span className="tabular text-sm font-semibold">{await fmt(i.total)}</span>
                </li>
              )),
            )}
          </ul>
          <dl className="mt-4 space-y-2 border-t border-border pt-4 text-sm">
            <div className="flex justify-between">
              <dt className="text-muted">{t("cart.subtotal")}</dt>
              <dd className="tabular">{await fmt(order.subtotal)}</dd>
            </div>
            {await Promise.all(order.discounts.map(async (d) => (
              <div key={d.id} className="flex justify-between text-success">
                <dt>{tr(d.label, locale) || d.code}</dt>
                <dd className="tabular">-{await fmt(d.amount)}</dd>
              </div>
            )))}
            <div className="flex justify-between">
              <dt className="text-muted">{t("cart.shipping")}</dt>
              <dd className="tabular">{order.shippingTotal ? await fmt(order.shippingTotal) : t("common.free")}</dd>
            </div>
            <div className="flex justify-between border-t border-border pt-3 text-base font-semibold">
              <dt>{t("cart.total")}</dt>
              <dd className="tabular">{await fmt(order.total)}</dd>
            </div>
          </dl>
        </div>
        <div className="space-y-6">
          <div className="rounded-card border border-border p-5">
            <h3 className="mb-4 font-semibold">{t("order.timeline")}</h3>
            <ol className="relative space-y-5 border-s border-border ps-5">
              {order.history.map((h, i) => (
                <li key={h.id} className="relative">
                  <span className={cn("absolute -start-[27px] top-0.5 grid size-4 place-items-center rounded-full ring-4 ring-bg", i === order.history.length - 1 ? "bg-accent text-accent-fg" : "bg-border")}>{i === order.history.length - 1 && <Check className="size-2.5" strokeWidth={4} />}</span>
                  <p className="text-sm font-medium">{label(h.toStatus)}</p>
                  <p className="text-xs text-muted">{dateFmt(h.createdAt)}</p>
                </li>
              ))}
            </ol>
          </div>
          <div className="rounded-card border border-border p-5 text-sm">
            <h3 className="mb-2 font-semibold">{t("order.deliveryTo")}</h3>
            <p className="leading-relaxed text-fg/80">
              {address.fullName}
              <br />
              {address.line1}
              {address.line2 ? `, ${address.line2}` : ""}
              <br />
              {[address.area, address.city].filter(Boolean).join(", ")}
              <br />
              <span dir="ltr">{address.phone}</span>
            </p>
            <h3 className="mb-1 mt-4 font-semibold">{t("order.paymentMethod")}</h3>
            <p className="text-fg/80">{order.paymentMethod}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

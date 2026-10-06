import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { CheckCircle2, Clock, AlertTriangle, Package, Truck, Home, Copy } from "lucide-react";
import { db } from "@/server/db";
import { findOrderForShopper } from "@/server/commerce/checkout";
import { formatBase } from "@/server/commerce/currency";
import { getCurrentUser } from "@/server/auth/session";
import { getPaymentProvider } from "@/server/integrations/registry";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { PurchaseTracker } from "@/components/store/purchase-tracker";
import { t as tr } from "@/lib/i18n-text";
import { localeMeta, type Locale } from "@/i18n/config";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { robots: { index: false, follow: false } };

type Props = { params: Promise<{ locale: string; number: string }>; searchParams: Promise<{ token?: string; payment?: string }> };

export default async function OrderConfirmationPage({ params, searchParams }: Props) {
  const { number } = await params;
  const locale = (await params).locale as Locale;
  setRequestLocale(locale);
  const sp = await searchParams;
  const order = await findOrderForShopper(decodeURIComponent(number), sp.token ?? null);
  if (!order) notFound();
  const t = await getTranslations();
  const user = await getCurrentUser();
  const fmt = (n: number) => formatBase(n, locale);
  const address = order.shippingAddress as { fullName: string; phone: string; city: string; line1: string; line2?: string; area?: string; country: string };
  const integration = await db.integration.findUnique({ where: { key: order.paymentMethod } });
  const cfg = (integration?.config ?? {}) as Record<string, string>;
  const methodTitle = cfg[`title_${locale}`] || getPaymentProvider(order.paymentMethod)?.name || order.paymentMethod;
  const instructions = order.paymentStatus !== "PAID" ? cfg[`instructions_${locale}`] || "" : "";
  const failed = sp.payment === "failed" || order.paymentStatus === "FAILED";
  const pending = sp.payment === "pending" || order.paymentStatus === "PENDING";
  const country = new Intl.DisplayNames([localeMeta[locale].intl], { type: "region" }).of(address.country) ?? address.country;

  return (
    <div className="container-store max-w-3xl py-10 md:py-16">
      {!failed && (
        <PurchaseTracker
          orderNumber={order.number}
          items={order.items.map((i) => ({ id: i.productId ?? i.id, name: tr(i.name, locale), price: i.unitPrice, quantity: i.quantity }))}
          total={order.total}
          shipping={order.shippingTotal}
        />
      )}
      <div className="text-center">
        <div className={`animate-scale-in mx-auto grid size-20 place-items-center rounded-full ${failed ? "bg-red-50 text-red-600" : pending ? "bg-amber-50 text-amber-600" : "bg-success/10 text-success"}`}>
          {failed ? <AlertTriangle className="size-10" /> : pending ? <Clock className="size-10" /> : <CheckCircle2 className="size-10" />}
        </div>
        <h1 className="mt-6 text-3xl font-semibold tracking-tight md:text-4xl">{failed ? t("errors.payment_failed") : t("order.thanks", { name: order.customerName.split(" ")[0] })}</h1>
        <p className="mt-3 text-muted">{failed ? t("order.paymentFailed") : pending ? t("order.paymentPending") : t("order.emailSent", { email: order.email })}</p>
        <div className="mt-6 inline-flex items-center gap-3 rounded-full border border-border px-5 py-2.5">
          <span className="text-sm text-muted">{t("order.number")}</span>
          <span className="tabular font-semibold tracking-wide">{order.number}</span>
          <Copy className="size-4 text-muted" aria-hidden />
        </div>
      </div>

      {instructions && (
        <div className="mt-10 rounded-[calc(var(--nq-radius)*1.2)] border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900">
          <p className="mb-1 font-semibold">{t("order.paymentInstructions")}</p>
          <p className="whitespace-pre-line">{instructions}</p>
        </div>
      )}

      {!failed && (
        <div className="mt-10 rounded-[calc(var(--nq-radius)*1.4)] bg-surface p-6">
          <h2 className="font-semibold">{t("order.whatsNext")}</h2>
          <ol className="mt-4 grid gap-4 sm:grid-cols-3">
            {[
              { icon: Package, text: t("order.next1") },
              { icon: Truck, text: t("order.next2") },
              { icon: Home, text: t("order.next3") },
            ].map(({ icon: Icon, text }, i) => (
              <li key={i} className="flex gap-3 text-sm">
                <span className="grid size-9 shrink-0 place-items-center rounded-full bg-bg">
                  <Icon className="size-4" />
                </span>
                <span className="text-fg/80">{text}</span>
              </li>
            ))}
          </ol>
        </div>
      )}

      <div className="mt-8 grid gap-6 rounded-[calc(var(--nq-radius)*1.4)] border border-border p-6 sm:grid-cols-2">
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted">{t("order.deliveryTo")}</h3>
          <p className="mt-2 text-sm leading-relaxed">
            {address.fullName}
            <br />
            {address.line1}
            {address.line2 ? `, ${address.line2}` : ""}
            <br />
            {[address.area, address.city, country].filter(Boolean).join(", ")}
            <br />
            <span dir="ltr">{address.phone}</span>
          </p>
        </div>
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted">{t("order.paymentMethod")}</h3>
          <p className="mt-2 text-sm">{methodTitle}</p>
          <h3 className="mt-4 text-xs font-semibold uppercase tracking-wider text-muted">{t("checkout.shippingMethod")}</h3>
          <p className="mt-2 text-sm">{tr(order.shippingMethodName, locale)}</p>
        </div>
      </div>

      <div className="mt-6 rounded-[calc(var(--nq-radius)*1.4)] border border-border p-6">
        <h3 className="mb-4 font-semibold">{t("order.items")}</h3>
        <ul className="divide-y divide-border">
          {await Promise.all(
            order.items.map(async (i) => (
              <li key={i.id} className="flex items-center gap-4 py-3">
                {i.imageUrl && <img src={i.imageUrl} alt="" className="size-14 rounded-xl bg-surface object-cover" loading="lazy" />}
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">{tr(i.name, locale)}</p>
                  {i.variantLabel && <p className="text-xs text-muted">{tr(i.variantLabel, locale)}</p>}
                </div>
                <span className="tabular text-sm text-muted">×{i.quantity}</span>
                <span className="tabular w-24 text-end text-sm font-medium">{await fmt(i.total)}</span>
              </li>
            )),
          )}
        </ul>
        <dl className="mt-4 space-y-2 border-t border-border pt-4 text-sm">
          <div className="flex justify-between">
            <dt className="text-muted">{t("cart.subtotal")}</dt>
            <dd className="tabular">{await fmt(order.subtotal)}</dd>
          </div>
          {order.discountTotal > 0 && (
            <div className="flex justify-between text-success">
              <dt>{t("cart.discount")}</dt>
              <dd className="tabular">-{await fmt(order.discountTotal)}</dd>
            </div>
          )}
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

      <div className="mt-8 flex flex-wrap justify-center gap-3">
        {user ? (
          <Button asChild size="lg">
            <Link href={`/account/orders/${order.number}`}>{t("order.viewOrders")}</Link>
          </Button>
        ) : (
          <Button asChild size="lg" variant="outline">
            <Link href="/account/register">{t("order.createAccount")}</Link>
          </Button>
        )}
        <Button asChild size="lg" variant={user ? "outline" : "primary"}>
          <Link href="/shop">{t("cart.continueShopping")}</Link>
        </Button>
      </div>
    </div>
  );
}

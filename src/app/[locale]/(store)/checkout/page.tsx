import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { db } from "@/server/db";
import { getCartTotals } from "@/server/commerce/cart";
import { availablePaymentMethods } from "@/server/commerce/checkout";
import { getCurrentUser } from "@/server/auth/session";
import { getManySettings } from "@/server/settings/service";
import { requestMeta } from "@/server/request";
import { checkoutDestinations } from "@/server/commerce/regions";
import { CheckoutForm } from "@/components/store/checkout/checkout-form";
import type { Locale } from "@/i18n/config";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const t = await getTranslations({ locale: (await params).locale, namespace: "checkout" });
  return { title: t("title"), robots: { index: false, follow: false } };
}

export default async function CheckoutPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<{ cancelled?: string }> }) {
  const locale = (await params).locale as Locale;
  setRequestLocale(locale);
  const [totals, user, settings, meta] = await Promise.all([getCartTotals(locale), getCurrentUser(), getManySettings(["checkout", "geo"]), requestMeta()]);
  if (!totals.lines.length) redirect({ href: "/cart", locale });
  if (!user && !settings.checkout.guestCheckout) redirect({ href: "/account/login?next=/checkout", locale });

  const t = await getTranslations("checkout");
  const addresses = user ? await db.address.findMany({ where: { userId: user.id }, orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }] }) : [];
  const payments = await availablePaymentMethods(locale, totals.total);
  // Shipping countries + their cities (Settings → Countries & cities).
  const { countries, regions } = await checkoutDestinations(locale);
  const detected = settings.geo.detectFromHeaders ? meta.country : null;

  return (
    <div className="container-store py-8 md:py-10">
      <h1 className="mb-8 text-3xl font-semibold tracking-tight">{t("title")}</h1>
      <CheckoutForm
        initialTotals={totals}
        user={user ? { email: user.email, name: user.name, phone: user.phone } : null}
        addresses={addresses.map((a) => ({ ...a, createdAt: undefined, updatedAt: undefined })) as never}
        payments={payments}
        countries={countries}
        regions={regions}
        defaultCountry={(detected && countries.some((c) => c.code === detected) ? detected : settings.geo.defaultCountry).toUpperCase()}
        settings={{ requireTerms: settings.checkout.requireTerms, allowNotes: settings.checkout.allowOrderNotes, postalCode: settings.checkout.postalCode, guestCheckout: settings.checkout.guestCheckout }}
        cancelledOrder={(await searchParams).cancelled ?? null}
      />
    </div>
  );
}

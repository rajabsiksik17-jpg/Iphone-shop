import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { getCartTotals } from "@/server/commerce/cart";
import { CartPageView } from "@/components/store/cart-page";
import type { Locale } from "@/i18n/config";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const t = await getTranslations({ locale: (await params).locale, namespace: "cart" });
  return { title: t("title"), robots: { index: false, follow: false } };
}

export default async function CartPage({ params }: { params: Promise<{ locale: string }> }) {
  const locale = (await params).locale as Locale;
  setRequestLocale(locale);
  const t = await getTranslations("cart");
  const totals = await getCartTotals(locale);
  return (
    <div className="container-store py-8 md:py-12">
      <h1 className="mb-8 text-3xl font-semibold tracking-tight md:text-4xl">{t("title")}</h1>
      <CartPageView initial={totals} />
    </div>
  );
}

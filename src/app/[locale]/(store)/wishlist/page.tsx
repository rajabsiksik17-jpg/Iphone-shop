import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { WishlistView } from "@/components/store/wishlist-view";
import type { Locale } from "@/i18n/config";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const t = await getTranslations({ locale: (await params).locale, namespace: "common" });
  return { title: t("wishlist"), robots: { index: false, follow: false } };
}

export default async function WishlistPage({ params }: { params: Promise<{ locale: string }> }) {
  setRequestLocale((await params).locale as Locale);
  const t = await getTranslations("common");
  return (
    <div className="container-store py-8 md:py-12">
      <h1 className="mb-8 text-3xl font-semibold tracking-tight md:text-4xl">{t("wishlist")}</h1>
      <WishlistView />
    </div>
  );
}

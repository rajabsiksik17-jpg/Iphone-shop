import { getTranslations } from "next-intl/server";
import { ForgotForm } from "@/components/store/auth-forms";
import type { Locale } from "@/i18n/config";

export default async function AdminForgotPage({ params }: { params: Promise<{ locale: string }> }) {
  const locale = (await params).locale as Locale;
  const t = await getTranslations("auth");
  return (
    <>
      <h1 className="text-xl font-semibold">{t("forgotTitle")}</h1>
      <p className="mb-6 mt-1 text-sm text-ad-muted">{t("forgotSubtitle")}</p>
      <ForgotForm scope="ADMIN" />
      <a href={`/${locale}/admin/login`} className="mt-6 block text-center text-sm text-ad-muted hover:text-ad-fg">
        ← {t("signInCta")}
      </a>
    </>
  );
}

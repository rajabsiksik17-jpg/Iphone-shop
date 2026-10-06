import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { ForgotForm } from "@/components/store/auth-forms";
import type { Locale } from "@/i18n/config";

export default async function ForgotPasswordPage({ params }: { params: Promise<{ locale: string }> }) {
  const locale = (await params).locale as Locale;
  setRequestLocale(locale);
  const t = await getTranslations("auth");
  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight">{t("forgotTitle")}</h1>
      <p className="mb-7 mt-1.5 text-sm text-muted">{t("forgotSubtitle")}</p>
      <ForgotForm />
      <p className="mt-7 text-center text-sm">
        <Link href="/account/login" className="text-muted hover:text-fg">
          ← {t("signInCta")}
        </Link>
      </p>
    </>
  );
}

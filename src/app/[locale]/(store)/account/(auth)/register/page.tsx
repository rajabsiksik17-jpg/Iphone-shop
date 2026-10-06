import { getTranslations, setRequestLocale } from "next-intl/server";
import { redirect, Link } from "@/i18n/navigation";
import { getCurrentUser } from "@/server/auth/session";
import { getSettings } from "@/server/settings/service";
import { RegisterForm } from "@/components/store/auth-forms";
import type { Locale } from "@/i18n/config";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const t = await getTranslations({ locale: (await params).locale, namespace: "common" });
  return { title: t("register") };
}

export default async function RegisterPage({ params }: { params: Promise<{ locale: string }> }) {
  const locale = (await params).locale as Locale;
  setRequestLocale(locale);
  if (await getCurrentUser()) redirect({ href: "/account", locale });
  const t = await getTranslations("auth");
  const { passwordMinLength } = await getSettings("security");
  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight">{t("registerTitle")}</h1>
      <p className="mb-7 mt-1.5 text-sm text-muted">{t("registerSubtitle")}</p>
      <RegisterForm minPassword={passwordMinLength} />
      <p className="mt-7 text-center text-sm text-muted">
        {t("haveAccount")}{" "}
        <Link href="/account/login" className="font-medium text-fg hover:underline">
          {t("signInCta")}
        </Link>
      </p>
    </>
  );
}

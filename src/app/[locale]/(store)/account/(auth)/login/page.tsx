import { getTranslations, setRequestLocale } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { Link } from "@/i18n/navigation";
import { getCurrentUser } from "@/server/auth/session";
import { LoginForm } from "@/components/store/auth-forms";
import type { Locale } from "@/i18n/config";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const t = await getTranslations({ locale: (await params).locale, namespace: "common" });
  return { title: t("signIn") };
}

export default async function LoginPage({ params }: { params: Promise<{ locale: string }> }) {
  const locale = (await params).locale as Locale;
  setRequestLocale(locale);
  if (await getCurrentUser()) redirect({ href: "/account", locale });
  const t = await getTranslations("auth");
  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight">{t("signInTitle")}</h1>
      <p className="mb-7 mt-1.5 text-sm text-muted">{t("signInSubtitle")}</p>
      <LoginForm />
      <p className="mt-7 text-center text-sm text-muted">
        {t("noAccount")}{" "}
        <Link href="/account/register" className="font-medium text-fg hover:underline">
          {t("registerCta")}
        </Link>
      </p>
    </>
  );
}

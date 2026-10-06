import { getTranslations } from "next-intl/server";
import { getSettings } from "@/server/settings/service";
import { ResetForm } from "@/components/store/auth-forms";
import type { Locale } from "@/i18n/config";

export default async function AdminResetPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<{ token?: string }> }) {
  const locale = (await params).locale as Locale;
  const t = await getTranslations();
  const token = (await searchParams).token ?? "";
  const { passwordMinLength } = await getSettings("security");
  return (
    <>
      <h1 className="mb-6 text-xl font-semibold">{t("auth.resetTitle")}</h1>
      {token ? <ResetForm token={token} minPassword={passwordMinLength} loginHref={`/${locale}/admin/login`} /> : <p className="text-sm text-red-600">{t("errors.reset_token_invalid")}</p>}
    </>
  );
}

import { getTranslations, setRequestLocale } from "next-intl/server";
import { customerOrRedirect } from "@/server/auth/page-guards";
import { getSettings } from "@/server/settings/service";
import { PrivacyPanel } from "@/components/store/account/forms";
import type { Locale } from "@/i18n/config";

export default async function PrivacyPage({ params }: { params: Promise<{ locale: string }> }) {
  setRequestLocale((await params).locale as Locale);
  await customerOrRedirect();
  const t = await getTranslations("account");
  const privacy = await getSettings("privacy");
  return (
    <section>
      <h2 className="mb-5 text-xl font-semibold">{t("privacy")}</h2>
      <PrivacyPanel allowExport={privacy.allowDataExport} allowDelete={privacy.allowAccountDeletion} />
    </section>
  );
}

import { getTranslations, setRequestLocale } from "next-intl/server";
import { customerOrRedirect } from "@/server/auth/page-guards";
import { ProfileForm } from "@/components/store/account/forms";
import type { Locale } from "@/i18n/config";

export default async function ProfilePage({ params }: { params: Promise<{ locale: string }> }) {
  setRequestLocale((await params).locale as Locale);
  const user = await customerOrRedirect();
  const t = await getTranslations("account");
  return (
    <section>
      <h2 className="mb-5 text-xl font-semibold">{t("profile")}</h2>
      <ProfileForm user={{ name: user.name, email: user.email, phone: user.phone, locale: user.locale, marketingOptIn: user.marketingOptIn }} />
    </section>
  );
}

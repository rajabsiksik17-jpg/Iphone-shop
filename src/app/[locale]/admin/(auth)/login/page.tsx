import { redirect } from "@/i18n/navigation";
import { getCurrentStaff } from "@/server/auth/session";
import { getSettings } from "@/server/settings/service";
import { AdminLoginForm } from "@/components/admin/login-form";
import type { Locale } from "@/i18n/config";

export const metadata = { title: "Sign in" };
export const dynamic = "force-dynamic";

export default async function AdminLoginPage({ params }: { params: Promise<{ locale: string }> }) {
  const locale = (await params).locale as Locale;
  if (await getCurrentStaff()) redirect({ href: "/admin", locale });
  const { adminOtp } = await getSettings("security");
  return <AdminLoginForm locale={locale} otpLength={adminOtp.length} />;
}

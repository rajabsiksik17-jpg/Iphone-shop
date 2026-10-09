import { adminPage } from "@/server/admin/guard";
import { countryPage } from "@/server/admin/country";
import { CountryView } from "@/components/admin/settings/country";
import { Forbidden } from "@/components/admin/ui";

export const metadata = { title: "Primary store country" };

// Platform-level: only the super-admin (wildcard) holds "platform.country".
export default async function CountryPage() {
  const { allowed, locale } = await adminPage("platform.country");
  if (!allowed) return <Forbidden />;
  return <CountryView data={await countryPage(locale)} />;
}

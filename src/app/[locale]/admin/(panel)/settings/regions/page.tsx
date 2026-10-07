import { adminPage } from "@/server/admin/guard";
import { countryRegions, regionsOverview } from "@/server/admin/regions";
import { RegionsView } from "@/components/admin/settings/regions";
import { Forbidden } from "@/components/admin/ui";

export const metadata = { title: "Countries & cities" };

export default async function RegionsPage({ searchParams }: { searchParams: Promise<{ country?: string }> }) {
  const { allowed, locale } = await adminPage("settings.shipping");
  if (!allowed) return <Forbidden />;
  const overview = await regionsOverview(locale);
  const { country } = await searchParams;
  const first = (country && /^[A-Za-z]{2}$/.test(country) ? country.toUpperCase() : null) ?? (overview.shipping.some((c) => c.code === overview.defaultCountry) || !overview.shipping.length ? overview.defaultCountry : overview.shipping[0].code);
  return <RegionsView overview={overview} initial={await countryRegions(first, locale)} />;
}

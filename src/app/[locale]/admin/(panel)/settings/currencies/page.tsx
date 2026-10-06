import { adminPage } from "@/server/admin/guard";
import { currencyPage } from "@/server/admin/settings-data";
import { CurrenciesView } from "@/components/admin/settings/tables";
import { Forbidden } from "@/components/admin/ui";

export const metadata = { title: "Currencies" };

export default async function CurrenciesPage() {
  const { allowed } = await adminPage("settings.general");
  if (!allowed) return <Forbidden />;
  return <CurrenciesView data={await currencyPage()} />;
}

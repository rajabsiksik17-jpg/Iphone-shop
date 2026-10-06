import { adminPage } from "@/server/admin/guard";
import { currencyList } from "@/server/admin/settings-data";
import { db } from "@/server/db";
import { CurrenciesView } from "@/components/admin/settings/tables";
import { Forbidden } from "@/components/admin/ui";

export const metadata = { title: "Currencies" };

export default async function CurrenciesPage() {
  const { allowed } = await adminPage("settings.general");
  if (!allowed) return <Forbidden />;
  const [rows, orders] = await Promise.all([currencyList(), db.order.count()]);
  return <CurrenciesView rows={rows} hasOrders={orders > 0} />;
}

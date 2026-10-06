import { adminPage } from "@/server/admin/guard";
import { inventoryList, recentMovements } from "@/server/admin/operations";
import { InventoryView } from "@/components/admin/operations/inventory";
import { Forbidden } from "@/components/admin/ui";

export const metadata = { title: "Inventory" };

export default async function InventoryPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const { allowed, locale } = await adminPage("inventory.manage");
  if (!allowed) return <Forbidden />;
  const sp = await searchParams;
  const [data, movements] = await Promise.all([inventoryList({ q: sp.q, filter: sp.filter, page: Number(sp.page) || 1 }, locale), recentMovements(locale)]);
  return <InventoryView data={data} movements={movements} />;
}

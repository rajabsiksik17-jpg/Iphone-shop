import { adminPage } from "@/server/admin/guard";
import { orderStatusList } from "@/server/admin/settings-data";
import { OrderStatusesView } from "@/components/admin/settings/tables";
import { Forbidden } from "@/components/admin/ui";

export const metadata = { title: "Order statuses" };

export default async function OrderStatusesPage() {
  const { allowed, locale } = await adminPage("settings.general");
  if (!allowed) return <Forbidden />;
  return <OrderStatusesView data={await orderStatusList(locale)} />;
}

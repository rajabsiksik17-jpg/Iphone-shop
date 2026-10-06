import { adminPage } from "@/server/admin/guard";
import { shippingZones } from "@/server/admin/settings-data";
import { ShippingView } from "@/components/admin/settings/tables";
import { Forbidden } from "@/components/admin/ui";

export const metadata = { title: "Shipping" };

export default async function ShippingPage() {
  const { allowed } = await adminPage("settings.shipping");
  if (!allowed) return <Forbidden />;
  return <ShippingView zones={await shippingZones()} />;
}

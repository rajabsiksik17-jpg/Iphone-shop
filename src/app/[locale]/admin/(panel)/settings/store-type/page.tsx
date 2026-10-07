import { adminPage } from "@/server/admin/guard";
import { storeTypePage } from "@/server/admin/store-type";
import { StoreTypeView } from "@/components/admin/settings/store-type";
import { Forbidden } from "@/components/admin/ui";

export const metadata = { title: "Store type" };

export default async function StoreTypePage() {
  const { allowed, locale } = await adminPage("settings.general");
  if (!allowed) return <Forbidden />;
  return <StoreTypeView data={await storeTypePage(locale)} />;
}

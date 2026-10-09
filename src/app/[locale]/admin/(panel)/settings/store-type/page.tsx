import { adminPage } from "@/server/admin/guard";
import { storeTypePage } from "@/server/admin/store-type";
import { profilesOverview, storageReport } from "@/server/admin/store-profiles";
import { StoreTypeView } from "@/components/admin/settings/store-type";
import { Forbidden } from "@/components/admin/ui";

export const metadata = { title: "Store type" };

// Platform-level: only the super-admin (wildcard) holds "platform.storeType".
export default async function StoreTypePage() {
  const { allowed, locale } = await adminPage("platform.storeType");
  if (!allowed) return <Forbidden />;
  const [overview, presentation, storage] = await Promise.all([profilesOverview(locale), storeTypePage(locale), storageReport()]);
  return <StoreTypeView data={{ overview, presentation, storage }} />;
}

import { adminPage } from "@/server/admin/guard";
import { adminBrands } from "@/server/admin/catalog";
import { BrandsManager } from "@/components/admin/catalog/brands";
import { Forbidden } from "@/components/admin/ui";

export const metadata = { title: "Brands" };

export default async function BrandsPage() {
  const { allowed, locale } = await adminPage("catalog.view");
  if (!allowed) return <Forbidden />;
  return <BrandsManager rows={await adminBrands(locale)} />;
}

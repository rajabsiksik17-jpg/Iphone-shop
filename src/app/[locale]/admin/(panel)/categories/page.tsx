import { adminPage } from "@/server/admin/guard";
import { adminCategories } from "@/server/admin/catalog";
import { CategoriesManager } from "@/components/admin/catalog/categories";
import { Forbidden } from "@/components/admin/ui";

export const metadata = { title: "Categories" };

export default async function CategoriesPage() {
  const { allowed, locale } = await adminPage("catalog.view");
  if (!allowed) return <Forbidden />;
  return <CategoriesManager data={await adminCategories(locale)} />;
}

import { adminPage } from "@/server/admin/guard";
import { listAdminProducts } from "@/server/admin/products";
import { ProductsList } from "@/components/admin/products/list";
import { Forbidden } from "@/components/admin/ui";

export const metadata = { title: "Products" };

export default async function ProductsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const { allowed, locale } = await adminPage("catalog.view");
  if (!allowed) return <Forbidden />;
  const sp = await searchParams;
  const data = await listAdminProducts({ q: sp.q, status: sp.status, brand: sp.brand, category: sp.category, stock: sp.stock, sort: sp.sort, page: Number(sp.page) || 1 }, locale);
  return <ProductsList data={data} />;
}

import { notFound } from "next/navigation";
import { adminPage } from "@/server/admin/guard";
import { productEditorData } from "@/server/admin/products";
import { ProductEditor } from "@/components/admin/products/editor";
import { Forbidden } from "@/components/admin/ui";

export const metadata = { title: "Product" };

export default async function ProductEditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { allowed, locale } = await adminPage(id === "new" ? "catalog.edit" : "catalog.view");
  if (!allowed) return <Forbidden />;
  const data = await productEditorData(id === "new" ? null : id, locale);
  if (id !== "new" && !data.product) notFound();
  return <ProductEditor key={data.product?.updatedAt ?? "new"} data={data} />;
}

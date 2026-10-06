import { adminPage } from "@/server/admin/guard";
import { adminAttributes } from "@/server/admin/catalog";
import { AttributesManager } from "@/components/admin/catalog/attributes";
import { Forbidden } from "@/components/admin/ui";

export const metadata = { title: "Attributes" };

export default async function AttributesPage() {
  const { allowed, locale } = await adminPage("catalog.view");
  if (!allowed) return <Forbidden />;
  return <AttributesManager data={await adminAttributes(locale)} />;
}

import { notFound } from "next/navigation";
import { adminPage } from "@/server/admin/guard";
import { customerDetail } from "@/server/admin/operations";
import { CustomerView } from "@/components/admin/operations/customers";
import { Forbidden } from "@/components/admin/ui";

export const metadata = { title: "Customer" };

export default async function CustomerPage({ params }: { params: Promise<{ id: string }> }) {
  const { allowed, staff, locale } = await adminPage("customers.view");
  if (!allowed) return <Forbidden />;
  const c = await customerDetail((await params).id, staff, locale);
  if (!c) notFound();
  return <CustomerView c={c} />;
}

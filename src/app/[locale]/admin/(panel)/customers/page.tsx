import { adminPage } from "@/server/admin/guard";
import { customerList } from "@/server/admin/operations";
import { CustomersList } from "@/components/admin/operations/customers";
import { Forbidden } from "@/components/admin/ui";

export const metadata = { title: "Customers" };

export default async function CustomersPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const { allowed, staff } = await adminPage("customers.view");
  if (!allowed) return <Forbidden />;
  const sp = await searchParams;
  return <CustomersList data={await customerList({ q: sp.q, status: sp.status, sort: sp.sort, page: Number(sp.page) || 1 }, staff)} />;
}

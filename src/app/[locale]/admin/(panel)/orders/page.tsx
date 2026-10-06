import { adminPage } from "@/server/admin/guard";
import { listOrders } from "@/server/admin/orders";
import { OrdersList } from "@/components/admin/orders/list";
import { Forbidden } from "@/components/admin/ui";

export const metadata = { title: "Orders" };

export default async function OrdersPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const { allowed, locale } = await adminPage("orders.view");
  if (!allowed) return <Forbidden />;
  const sp = await searchParams;
  const data = await listOrders({ q: sp.q, status: sp.status, payment: sp.payment, method: sp.method, from: sp.from, to: sp.to, page: Number(sp.page) || 1 }, locale);
  return <OrdersList data={data} />;
}

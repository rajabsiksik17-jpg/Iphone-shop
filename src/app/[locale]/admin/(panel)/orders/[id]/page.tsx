import { notFound } from "next/navigation";
import { adminPage } from "@/server/admin/guard";
import { orderDetail } from "@/server/admin/orders";
import { OrderDetailView } from "@/components/admin/orders/detail";
import { Forbidden } from "@/components/admin/ui";

export const metadata = { title: "Order" };

export default async function OrderPage({ params }: { params: Promise<{ id: string }> }) {
  const { allowed, locale, staff } = await adminPage("orders.view");
  if (!allowed) return <Forbidden />;
  const order = await orderDetail((await params).id, locale, staff);
  if (!order) notFound();
  return <OrderDetailView order={order} />;
}

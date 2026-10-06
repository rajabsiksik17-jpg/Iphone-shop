import { adminPage } from "@/server/admin/guard";
import { couponList } from "@/server/admin/operations";
import { CouponsView } from "@/components/admin/operations/coupons";
import { Forbidden } from "@/components/admin/ui";

export const metadata = { title: "Coupons" };

export default async function CouponsPage() {
  const { allowed, locale } = await adminPage("marketing.manage");
  if (!allowed) return <Forbidden />;
  return <CouponsView data={await couponList(locale)} />;
}

import { adminPage } from "@/server/admin/guard";
import { staffData } from "@/server/admin/system";
import { StaffView } from "@/components/admin/system/staff";
import { Forbidden } from "@/components/admin/ui";

export const metadata = { title: "Staff & roles" };

export default async function StaffPage() {
  const { allowed, locale, staff } = await adminPage("staff.manage");
  if (!allowed) return <Forbidden />;
  return <StaffView data={await staffData(locale, staff)} />;
}

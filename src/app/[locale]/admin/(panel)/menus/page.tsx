import { adminPage } from "@/server/admin/guard";
import { menuList } from "@/server/admin/content";
import { MenusView } from "@/components/admin/cms/menus";
import { Forbidden } from "@/components/admin/ui";

export const metadata = { title: "Menus" };

export default async function MenusPage() {
  const { allowed, locale } = await adminPage("content.manage");
  if (!allowed) return <Forbidden />;
  return <MenusView data={await menuList(locale)} />;
}

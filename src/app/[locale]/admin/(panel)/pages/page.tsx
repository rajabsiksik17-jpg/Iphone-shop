import { adminPage } from "@/server/admin/guard";
import { pageList } from "@/server/admin/content";
import { PagesList } from "@/components/admin/cms/pages";
import { Forbidden } from "@/components/admin/ui";

export const metadata = { title: "Pages" };

export default async function PagesPage() {
  const { allowed, locale } = await adminPage("content.manage");
  if (!allowed) return <Forbidden />;
  return <PagesList rows={await pageList(locale)} />;
}

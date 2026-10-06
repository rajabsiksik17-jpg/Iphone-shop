import { adminPage } from "@/server/admin/guard";
import { faqList } from "@/server/admin/content";
import { FaqView } from "@/components/admin/cms/faq";
import { Forbidden } from "@/components/admin/ui";

export const metadata = { title: "FAQ" };

export default async function FaqPage() {
  const { allowed } = await adminPage("content.manage");
  if (!allowed) return <Forbidden />;
  return <FaqView data={await faqList()} />;
}

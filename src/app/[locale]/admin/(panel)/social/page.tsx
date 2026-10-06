import { adminPage } from "@/server/admin/guard";
import { socialList } from "@/server/admin/content";
import { getSettings } from "@/server/settings/service";
import { SocialView } from "@/components/admin/cms/social";
import { Forbidden } from "@/components/admin/ui";

export const metadata = { title: "Social media" };

export default async function SocialPage() {
  const { allowed } = await adminPage("content.manage");
  if (!allowed) return <Forbidden />;
  const [items, widgets] = await Promise.all([socialList(), getSettings("widgets")]);
  return <SocialView items={items} widgets={widgets} />;
}

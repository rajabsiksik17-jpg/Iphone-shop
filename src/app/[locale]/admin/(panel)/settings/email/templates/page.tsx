import { adminPage } from "@/server/admin/guard";
import { templateList } from "@/server/admin/settings-data";
import { TemplatesView } from "@/components/admin/settings/tables";
import { Forbidden } from "@/components/admin/ui";

export const metadata = { title: "Email templates" };

export default async function TemplatesPage() {
  const { allowed } = await adminPage("settings.email");
  if (!allowed) return <Forbidden />;
  return <TemplatesView templates={await templateList()} />;
}

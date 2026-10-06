import { adminPage } from "@/server/admin/guard";
import { sliderList } from "@/server/admin/content";
import { SlidersView } from "@/components/admin/cms/sliders";
import { Forbidden } from "@/components/admin/ui";

export const metadata = { title: "Sliders" };

export default async function SlidersPage() {
  const { allowed } = await adminPage("content.manage");
  if (!allowed) return <Forbidden />;
  return <SlidersView sliders={await sliderList()} />;
}

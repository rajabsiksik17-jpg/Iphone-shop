import { adminPage } from "@/server/admin/guard";
import { announcementList } from "@/server/admin/content";
import { getSettings } from "@/server/settings/service";
import { AnnouncementsView } from "@/components/admin/cms/announcements";
import { Forbidden } from "@/components/admin/ui";

export const metadata = { title: "Announcements" };

export default async function AnnouncementsPage() {
  const { allowed } = await adminPage("content.manage");
  if (!allowed) return <Forbidden />;
  const [rows, ticker] = await Promise.all([announcementList(), getSettings("ticker")]);
  return <AnnouncementsView rows={rows} ticker={ticker} />;
}

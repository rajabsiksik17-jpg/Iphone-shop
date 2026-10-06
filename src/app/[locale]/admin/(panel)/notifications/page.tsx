import { adminPage } from "@/server/admin/guard";
import { notificationsAction } from "@/actions/admin/shell";
import { NotificationsView } from "@/components/admin/system/account";

export const metadata = { title: "Notifications" };

export default async function NotificationsPage() {
  await adminPage();
  const r = await notificationsAction({ take: 100 });
  return <NotificationsView initial={r.ok ? r.data : []} />;
}

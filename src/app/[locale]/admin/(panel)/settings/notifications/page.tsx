import { adminPage } from "@/server/admin/guard";
import { getSettings } from "@/server/settings/service";
import { activeIntegration } from "@/server/integrations/service";
import { NotificationSettings } from "@/components/admin/settings/notifications";
import { Forbidden } from "@/components/admin/ui";

export const metadata = { title: "Notifications" };

export default async function NotificationSettingsPage() {
  const { allowed } = await adminPage("settings.notifications");
  if (!allowed) return <Forbidden />;
  const [value, whatsapp] = await Promise.all([getSettings("notifications"), activeIntegration("whatsapp_cloud")]);
  return <NotificationSettings initial={value as Record<string, unknown>} whatsappReady={Boolean(whatsapp)} />;
}

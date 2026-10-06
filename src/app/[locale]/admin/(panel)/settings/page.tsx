import { adminPage } from "@/server/admin/guard";
import { SettingsIndex } from "@/components/admin/settings/views";

export const metadata = { title: "Settings" };

export default async function SettingsPage() {
  await adminPage();
  // Each card is filtered by the viewer's permissions client-side; the target pages enforce them again.
  return <SettingsIndex />;
}

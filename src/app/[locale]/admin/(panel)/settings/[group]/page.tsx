import { notFound } from "next/navigation";
import { adminPage } from "@/server/admin/guard";
import { getSettingsForAdmin } from "@/server/settings/service";
import { settingsSchemas, SETTINGS_PERMISSIONS, type SettingsGroup } from "@/server/settings/schemas";
import { GenericSettings } from "@/components/admin/settings/views";
import { Forbidden } from "@/components/admin/ui";

export const metadata = { title: "Settings" };

// Groups with a declarative form (see components/admin/settings/definitions).
const GENERIC = ["store", "appearance", "localization", "seo", "checkout", "tax", "security", "chat", "contact", "loyalty", "privacy", "maintenance", "geo"] as const;

export default async function SettingsGroupPage({ params }: { params: Promise<{ group: string }> }) {
  const { group } = await params;
  if (!(GENERIC as readonly string[]).includes(group) || !(group in settingsSchemas)) notFound();
  const g = group as SettingsGroup;
  const { allowed } = await adminPage(SETTINGS_PERMISSIONS[g]);
  if (!allowed) return <Forbidden />;
  const { value, secrets } = await getSettingsForAdmin(g);
  return <GenericSettings slug={g} initial={value as Record<string, unknown>} secrets={secrets} />;
}

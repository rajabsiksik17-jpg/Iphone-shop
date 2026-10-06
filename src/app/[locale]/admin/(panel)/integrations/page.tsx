import { adminPage } from "@/server/admin/guard";
import { listIntegrations } from "@/server/integrations/service";
import { IntegrationsView } from "@/components/admin/integrations-view";
import { Forbidden } from "@/components/admin/ui";

export const metadata = { title: "Integrations" };

export default async function IntegrationsPage() {
  // Either permission opens the page; each card checks its own (payments vs other).
  const { allowed } = await adminPage(["settings.integrations", "settings.payments"], "any");
  if (!allowed) return <Forbidden />;
  return <IntegrationsView items={await listIntegrations()} appUrl={(process.env.APP_URL ?? "http://localhost:3000").replace(/\/$/, "")} />;
}

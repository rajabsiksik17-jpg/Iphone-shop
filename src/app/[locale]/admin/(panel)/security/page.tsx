import { adminPage } from "@/server/admin/guard";
import { securityData, type LogTab } from "@/server/admin/system";
import { SecurityView } from "@/components/admin/system/security";
import { Forbidden } from "@/components/admin/ui";

export const metadata = { title: "Security & logs" };

const TABS: LogTab[] = ["audit", "logins", "sessions", "system", "deliveries", "payments"];

export default async function SecurityPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const { allowed, staff } = await adminPage("audit.view");
  if (!allowed) return <Forbidden />;
  const sp = await searchParams;
  const tab = (TABS.includes(sp.tab as LogTab) ? sp.tab : "audit") as LogTab;
  return <SecurityView data={await securityData(tab, { q: sp.q, page: Number(sp.page) || 1, filter: sp.filter }, staff)} />;
}

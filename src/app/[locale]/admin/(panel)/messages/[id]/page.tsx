import { notFound } from "next/navigation";
import { adminPage } from "@/server/admin/guard";
import { contactDetail } from "@/server/admin/support";
import { getSettings } from "@/server/settings/service";
import { MessageView } from "@/components/admin/support/messages";
import { Forbidden } from "@/components/admin/ui";
import { t } from "@/lib/i18n-text";

export const metadata = { title: "Message" };

export default async function MessagePage({ params }: { params: Promise<{ id: string }> }) {
  const { allowed, staff, locale } = await adminPage("support.messages");
  if (!allowed) return <Forbidden />;
  const [m, store] = await Promise.all([contactDetail((await params).id, staff), getSettings("store")]);
  if (!m) notFound();
  return <MessageView m={m} storeName={t(store.name, locale)} />;
}

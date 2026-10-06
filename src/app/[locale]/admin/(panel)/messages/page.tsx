import { adminPage } from "@/server/admin/guard";
import { contactList } from "@/server/admin/support";
import { MessagesList } from "@/components/admin/support/messages";
import { Forbidden } from "@/components/admin/ui";

export const metadata = { title: "Messages" };

export default async function MessagesPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const { allowed } = await adminPage("support.messages");
  if (!allowed) return <Forbidden />;
  const sp = await searchParams;
  return <MessagesList data={await contactList({ status: sp.status, q: sp.q, page: Number(sp.page) || 1 })} />;
}

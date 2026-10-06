import { adminPage } from "@/server/admin/guard";
import { chatInbox } from "@/server/admin/support";
import { ChatConsole } from "@/components/admin/support/chat-console";
import { Forbidden } from "@/components/admin/ui";

export const metadata = { title: "Live chat" };

export default async function ChatPage() {
  const { allowed, staff } = await adminPage("support.chat");
  if (!allowed) return <Forbidden />;
  return <ChatConsole initial={await chatInbox(staff)} />;
}

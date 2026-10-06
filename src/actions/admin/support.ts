"use server";

import { z } from "zod";
import * as chat from "@/server/chat/service";
import { chatInbox, chatThread, setContactStatus, replyToContact } from "@/server/admin/support";
import { adminRun } from "./_base";
import { idSchema, localeSchema } from "../helpers";

// Chat mutations push their own realtime updates; skip the storefront revalidation.
const quiet = { revalidate: false } as const;

export async function chatInboxAction() {
  return adminRun("support.chat", (s) => chatInbox(s), quiet);
}

export async function chatThreadAction(id: string, locale: string) {
  return adminRun("support.chat", async (s) => {
    const thread = await chatThread(idSchema.parse(id), s, localeSchema.parse(locale));
    if (thread && ["ASSIGNED", "ACTIVE"].includes(thread.status)) await chat.markReadByAgent(thread.id);
    return thread;
  }, quiet);
}

export async function acceptChatAction(id: string) {
  return adminRun("support.chat", (s) => chat.acceptConversation(idSchema.parse(id), { id: s.id, name: s.name }), quiet);
}

export async function sendAgentMessageAction(id: string, body: string) {
  return adminRun("support.chat", (s) => chat.sendAgentMessage(idSchema.parse(id), { id: s.id }, z.string().max(chat.MAX_MESSAGE).parse(body)), quiet);
}

export async function closeChatAction(id: string) {
  return adminRun("support.chat", (s) => chat.closeConversationAsAgent(idSchema.parse(id), { id: s.id, name: s.name }), quiet);
}

export async function transferChatAction(id: string, toAgentId: string) {
  return adminRun("support.chat", (s) => chat.transferConversation(idSchema.parse(id), idSchema.parse(toAgentId), { id: s.id, name: s.name }), quiet);
}

export async function markChatReadAgentAction(id: string) {
  return adminRun("support.chat", () => chat.markReadByAgent(idSchema.parse(id)), quiet);
}

const contactStatus = z.enum(["NEW", "READ", "REPLIED", "ARCHIVED", "SPAM"]);

export async function setContactStatusAction(ids: string[], status: "NEW" | "READ" | "REPLIED" | "ARCHIVED" | "SPAM") {
  return adminRun("support.messages", (s) => setContactStatus(z.array(idSchema).max(200).parse(ids), contactStatus.parse(status), s), quiet);
}

export async function replyContactAction(id: string, input: { subject: string; body: string }) {
  return adminRun("support.messages", (s) => replyToContact(idSchema.parse(id), input, s), quiet);
}

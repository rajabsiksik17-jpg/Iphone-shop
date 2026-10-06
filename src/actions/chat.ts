"use server";

import { z } from "zod";
import { chatAvailability, currentConversation, endConversationAsCustomer, markReadByCustomer, messageDTO, sendCustomerMessage, startConversation } from "@/server/chat/service";
import { getCurrentUser } from "@/server/auth/session";
import { idSchema, localeSchema, run } from "./helpers";

export async function chatStateAction() {
  return run(async () => {
    const [availability, conv, user] = await Promise.all([chatAvailability(), currentConversation(), getCurrentUser()]);
    return {
      availability,
      user: user ? { name: user.name } : null,
      conversation: conv
        ? {
            id: conv.id,
            status: conv.status,
            subject: conv.subject,
            agent: conv.assignedAgent ? { name: conv.assignedAgent.name, avatar: conv.assignedAgent.avatar?.url ?? null } : null,
            messages: conv.messages.map(messageDTO),
            agentLastRead: conv.agentLastRead?.toISOString() ?? null,
          }
        : null,
    };
  });
}

export async function startChatAction(input: { subject: string; message: string; name?: string; email?: string; pageUrl?: string; locale: string }) {
  return run(async () => {
    const p = z
      .object({
        subject: z.string().trim().min(2).max(160),
        message: z.string().trim().min(1).max(2000),
        name: z.string().trim().min(2).max(80).optional(),
        email: z.string().trim().email().max(200).optional(),
        pageUrl: z.string().max(500).optional(),
        locale: localeSchema,
      })
      .parse(input);
    return startConversation(p);
  });
}

export async function sendChatMessageAction(conversationId: string, body: string) {
  return run(async () => sendCustomerMessage(idSchema.parse(conversationId), z.string().max(2000).parse(body)));
}

export async function endChatAction(conversationId: string, rating?: number) {
  return run(async () => endConversationAsCustomer(idSchema.parse(conversationId), rating ? z.number().int().min(1).max(5).parse(rating) : undefined));
}

export async function markChatReadAction(conversationId: string) {
  return run(async () => markReadByCustomer(idSchema.parse(conversationId)));
}

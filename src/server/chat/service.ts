import "server-only";
import { cookies } from "next/headers";
import { db } from "../db";
import { emit } from "../events";
import { AppError, Errors } from "../errors";
import { hmac, randomToken } from "../crypto";
import { limitBy } from "../rate-limit";
import { requestMeta } from "../request";
import { getSettings } from "../settings/service";
import { realtime, rooms } from "../realtime/emitter";
import { COOKIE, cookieOptions, getCurrentUser } from "../auth/session";
import type { ConversationStatus } from "@/generated/prisma/client";
import { t } from "@/lib/i18n-text";

const OPEN: ConversationStatus[] = ["WAITING", "ASSIGNED", "ACTIVE"];
export const MAX_MESSAGE = 2000;

/** Strip control characters; content is rendered as text (never HTML) on both sides. */
export function cleanMessage(body: string) {
  return body.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "").trim().slice(0, MAX_MESSAGE);
}

export function messageDTO(m: { id: string; conversationId: string; sender: string; senderId: string | null; body: string; createdAt: Date }) {
  return { id: m.id, conversationId: m.conversationId, sender: m.sender, senderId: m.senderId, body: m.body, createdAt: m.createdAt.toISOString() };
}

function withinHours(hours: { day: number; open: string; close: string; closed: boolean }[], timezone: string, now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone: timezone, weekday: "short", hour: "2-digit", minute: "2-digit", hour12: false }).formatToParts(now);
  const wd = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(parts.find((p) => p.type === "weekday")!.value);
  const hm = `${parts.find((p) => p.type === "hour")!.value}:${parts.find((p) => p.type === "minute")!.value}`;
  const today = hours.find((h) => h.day === wd);
  return Boolean(today && !today.closed && hm >= today.open && hm < today.close);
}

/**
 * Agents who set themselves Online *and* currently have the admin open
 * (socket presence). An agent who closed the tab doesn't strand customers.
 */
export async function onlineAgentIds() {
  const presence = (globalThis as unknown as { __presence?: Map<string, number> }).__presence;
  const rows = await db.user.findMany({ where: { type: "STAFF", status: "ACTIVE", agentStatus: "ONLINE" }, select: { id: true } });
  return rows.map((r) => r.id).filter((id) => !presence || presence.has(id));
}

/** Is live chat available right now? Considers settings, hours and online agents. */
export async function chatAvailability() {
  const [chat, loc] = await Promise.all([getSettings("chat"), getSettings("localization")]);
  if (!chat.enabled) return { enabled: false, online: false, reason: "disabled" as const };
  if (chat.useBusinessHours && !withinHours(chat.hours, loc.timezone)) return { enabled: true, online: false, reason: "outside_hours" as const };
  if (chat.requireAgentOnline) {
    const agents = await onlineAgentIds();
    if (agents.length === 0) return { enabled: true, online: false, reason: "no_agents" as const };
  }
  const queued = await db.conversation.count({ where: { status: "WAITING" } });
  if (queued >= chat.maxQueue) return { enabled: true, online: false, reason: "queue_full" as const };
  return { enabled: true, online: true, reason: null };
}

/** The shopper's own open conversation (signed-in customer or guest cookie). */
export async function currentConversation() {
  const user = await getCurrentUser();
  const include = { messages: { orderBy: { createdAt: "asc" as const }, take: 200 }, assignedAgent: { select: { name: true, avatar: { select: { url: true } } } } };
  if (user) {
    return db.conversation.findFirst({ where: { customerId: user.id, status: { in: OPEN } }, orderBy: { createdAt: "desc" }, include });
  }
  const token = (await cookies()).get(COOKIE.CHAT)?.value;
  if (!token) return null;
  return db.conversation.findFirst({ where: { guestTokenHash: hmac(token, "chat"), status: { in: OPEN } }, include });
}

/** Authorise a shopper's access to a specific conversation. */
async function shopperOwns(conversationId: string) {
  const conv = await db.conversation.findUnique({ where: { id: conversationId } });
  if (!conv) throw Errors.notFound();
  const user = await getCurrentUser();
  if (user && conv.customerId === user.id) return conv;
  const token = (await cookies()).get(COOKIE.CHAT)?.value;
  if (token && conv.guestTokenHash && conv.guestTokenHash === hmac(token, "chat")) return conv;
  throw Errors.forbidden();
}

async function postSystem(conversationId: string, body: string) {
  const m = await db.chatMessage.create({ data: { conversationId, sender: "SYSTEM", body } });
  realtime.toRoom(rooms.conversation(conversationId), "chat:message", messageDTO(m));
  return m;
}

export async function startConversation(input: { subject: string; message: string; name?: string; email?: string; pageUrl?: string; locale: string }) {
  const meta = await requestMeta();
  const lim = limitBy("chatStart", meta.ip ?? "unknown");
  if (!lim.ok) throw Errors.rateLimited(lim.retryAfterSec);
  const availability = await chatAvailability();
  if (!availability.online) throw new AppError("chat_offline", 503, { reason: availability.reason });

  const existing = await currentConversation();
  if (existing) return { conversationId: existing.id, resumed: true };

  const user = await getCurrentUser();
  if (!user && (!input.name || !input.email)) throw Errors.invalid({ name: input.name ? [] : ["required"], email: input.email ? [] : ["required"] });

  const guestToken = user ? null : randomToken(24);
  const chat = await getSettings("chat");
  const conv = await db.conversation.create({
    data: {
      customerId: user?.id,
      guestName: user ? null : input.name!.trim().slice(0, 80),
      guestEmail: user ? null : input.email!.trim().toLowerCase().slice(0, 200),
      guestTokenHash: guestToken ? hmac(guestToken, "chat") : null,
      subject: cleanMessage(input.subject).slice(0, 160) || "—",
      locale: input.locale,
      pageUrl: input.pageUrl?.slice(0, 500),
      messages: {
        create: [
          { sender: "CUSTOMER", senderId: user?.id, body: cleanMessage(input.message) },
          { sender: "SYSTEM", body: t(chat.waiting, input.locale) },
        ],
      },
    },
  });
  if (guestToken) (await cookies()).set(COOKIE.CHAT, guestToken, cookieOptions(7 * 86_400));

  if (chat.autoAssign) await autoAssign(conv.id);
  realtime.toPermission("support.chat", "chat:queue", { type: "new", conversationId: conv.id });
  emit("CHAT_STARTED", { conversationId: conv.id });
  return { conversationId: conv.id, resumed: false };
}

async function autoAssign(conversationId: string) {
  const online = await onlineAgentIds();
  const agents = await db.user.findMany({
    where: { id: { in: online }, role: { OR: [{ permissions: { has: "support.chat" } }, { permissions: { has: "*" } }] } },
    include: { _count: { select: { assignedChats: { where: { status: { in: ["ASSIGNED", "ACTIVE"] } } } } } },
  });
  if (!agents.length) return;
  const agent = agents.sort((a, b) => a._count.assignedChats - b._count.assignedChats)[0];
  await acceptConversation(conversationId, { id: agent.id, name: agent.name });
}

export async function sendCustomerMessage(conversationId: string, body: string) {
  const meta = await requestMeta();
  const lim = limitBy("chatMessage", `${conversationId}:${meta.ip}`);
  if (!lim.ok) throw Errors.rateLimited(lim.retryAfterSec);
  const conv = await shopperOwns(conversationId);
  if (!OPEN.includes(conv.status)) throw new AppError("chat_closed", 409);
  const text = cleanMessage(body);
  if (!text) throw Errors.invalid({ body: ["required"] });
  const m = await db.chatMessage.create({ data: { conversationId, sender: "CUSTOMER", senderId: conv.customerId, body: text } });
  await db.conversation.update({ where: { id: conversationId }, data: { lastMessageAt: m.createdAt, customerLastRead: m.createdAt } });
  realtime.toRoom(rooms.conversation(conversationId), "chat:message", messageDTO(m));
  realtime.toPermission("support.chat", "chat:activity", { conversationId });
  emit("CHAT_MESSAGE", { conversationId, messageId: m.id });
  return messageDTO(m);
}

export async function endConversationAsCustomer(conversationId: string, rating?: number) {
  const conv = await shopperOwns(conversationId);
  if (OPEN.includes(conv.status)) {
    await db.conversation.update({
      where: { id: conversationId },
      data: { status: "CLOSED_BY_CUSTOMER", closedAt: new Date(), ...(rating && rating >= 1 && rating <= 5 ? { rating } : {}) },
    });
    await postSystem(conversationId, conv.locale === "ar" ? "أنهى العميل المحادثة." : "The customer ended the conversation.");
    realtime.toRoom(rooms.conversation(conversationId), "chat:status", { conversationId, status: "CLOSED_BY_CUSTOMER" });
    realtime.toPermission("support.chat", "chat:queue", { type: "closed", conversationId });
    emit("CHAT_CLOSED", { conversationId });
  } else if (rating && rating >= 1 && rating <= 5) {
    await db.conversation.update({ where: { id: conversationId }, data: { rating } });
  }
}

export async function markReadByCustomer(conversationId: string) {
  await shopperOwns(conversationId);
  await db.conversation.update({ where: { id: conversationId }, data: { customerLastRead: new Date() } });
  realtime.toRoom(rooms.conversation(conversationId), "chat:read", { conversationId, by: "CUSTOMER", at: new Date().toISOString() });
}

// ───────────────────────────────── Agent side ───────────────────────────────

export async function acceptConversation(conversationId: string, agent: { id: string; name: string }) {
  // Conditional update: two agents clicking "Accept" at once can't both win.
  const res = await db.conversation.updateMany({
    where: { id: conversationId, status: "WAITING" },
    data: { status: "ASSIGNED", assignedAgentId: agent.id, acceptedAt: new Date() },
  });
  if (res.count !== 1) throw new AppError("chat_already_taken", 409);
  await db.conversationParticipant.upsert({
    where: { conversationId_userId: { conversationId, userId: agent.id } },
    create: { conversationId, userId: agent.id, role: "agent" },
    update: { leftAt: null },
  });
  const conv = await db.conversation.findUniqueOrThrow({ where: { id: conversationId } });
  const chat = await getSettings("chat");
  await postSystem(conversationId, conv.locale === "ar" ? `انضم ${agent.name} إلى المحادثة.` : `${agent.name} joined the conversation.`);
  const welcome = t(chat.welcome, conv.locale);
  if (welcome) {
    const m = await db.chatMessage.create({ data: { conversationId, sender: "AGENT", senderId: agent.id, body: welcome } });
    realtime.toRoom(rooms.conversation(conversationId), "chat:message", messageDTO(m));
  }
  realtime.toRoom(rooms.conversation(conversationId), "chat:status", { conversationId, status: "ASSIGNED", agent: { name: agent.name } });
  realtime.toPermission("support.chat", "chat:queue", { type: "accepted", conversationId, agentId: agent.id });
  emit("CHAT_ACCEPTED", { conversationId, agentId: agent.id });
}

export async function sendAgentMessage(conversationId: string, agent: { id: string }, body: string) {
  const conv = await db.conversation.findUnique({ where: { id: conversationId } });
  if (!conv) throw Errors.notFound();
  if (!OPEN.includes(conv.status)) throw new AppError("chat_closed", 409);
  if (conv.assignedAgentId && conv.assignedAgentId !== agent.id) throw new AppError("chat_assigned_elsewhere", 409);
  const text = cleanMessage(body);
  if (!text) throw Errors.invalid({ body: ["required"] });
  const m = await db.chatMessage.create({ data: { conversationId, sender: "AGENT", senderId: agent.id, body: text } });
  await db.conversation.update({
    where: { id: conversationId },
    data: { lastMessageAt: m.createdAt, agentLastRead: m.createdAt, ...(conv.status !== "ACTIVE" ? { status: "ACTIVE" } : {}), ...(!conv.assignedAgentId ? { assignedAgentId: agent.id, acceptedAt: new Date() } : {}) },
  });
  realtime.toRoom(rooms.conversation(conversationId), "chat:message", messageDTO(m));
  if (conv.status !== "ACTIVE") realtime.toRoom(rooms.conversation(conversationId), "chat:status", { conversationId, status: "ACTIVE" });
  if (conv.customerId) realtime.toUser(conv.customerId, "chat:unread", { conversationId });
  return messageDTO(m);
}

export async function closeConversationAsAgent(conversationId: string, agent: { id: string; name: string }) {
  const conv = await db.conversation.findUnique({ where: { id: conversationId } });
  if (!conv) throw Errors.notFound();
  if (!OPEN.includes(conv.status)) return;
  await db.conversation.update({ where: { id: conversationId }, data: { status: "CLOSED_BY_AGENT", closedAt: new Date() } });
  await db.conversationParticipant.updateMany({ where: { conversationId, userId: agent.id }, data: { leftAt: new Date() } });
  await postSystem(conversationId, conv.locale === "ar" ? "أنهى فريق الدعم المحادثة. شكراً لتواصلك معنا!" : "Support ended the conversation. Thanks for reaching out!");
  realtime.toRoom(rooms.conversation(conversationId), "chat:status", { conversationId, status: "CLOSED_BY_AGENT" });
  realtime.toPermission("support.chat", "chat:queue", { type: "closed", conversationId });
  emit("CHAT_CLOSED", { conversationId });
}

export async function transferConversation(conversationId: string, toAgentId: string, by: { id: string; name: string }) {
  const target = await db.user.findFirst({ where: { id: toAgentId, type: "STAFF", status: "ACTIVE" } });
  if (!target) throw Errors.notFound("agent");
  await db.conversation.update({ where: { id: conversationId }, data: { assignedAgentId: target.id, status: "ASSIGNED" } });
  await db.conversationParticipant.upsert({
    where: { conversationId_userId: { conversationId, userId: target.id } },
    create: { conversationId, userId: target.id, role: "agent" },
    update: { leftAt: null },
  });
  const conv = await db.conversation.findUniqueOrThrow({ where: { id: conversationId } });
  await postSystem(conversationId, conv.locale === "ar" ? `تم تحويل المحادثة إلى ${target.name}.` : `${by.name} transferred the conversation to ${target.name}.`);
  realtime.toRoom(rooms.conversation(conversationId), "chat:status", { conversationId, status: "ASSIGNED", agent: { name: target.name } });
  realtime.toPermission("support.chat", "chat:queue", { type: "transferred", conversationId, agentId: target.id });
}

export async function markReadByAgent(conversationId: string) {
  await db.conversation.update({ where: { id: conversationId }, data: { agentLastRead: new Date() } });
  realtime.toRoom(rooms.conversation(conversationId), "chat:read", { conversationId, by: "AGENT", at: new Date().toISOString() });
}

/** Scheduler: close conversations idle beyond the configured window. */
export async function autoCloseInactive() {
  const chat = await getSettings("chat");
  const cutoff = new Date(Date.now() - chat.autoCloseMinutes * 60_000);
  const idle = await db.conversation.findMany({ where: { status: { in: ["ASSIGNED", "ACTIVE"] }, lastMessageAt: { lt: cutoff } }, select: { id: true, locale: true } });
  for (const c of idle) {
    await db.conversation.update({ where: { id: c.id }, data: { status: "CLOSED_INACTIVE", closedAt: new Date() } });
    await postSystem(c.id, c.locale === "ar" ? "تم إغلاق المحادثة لعدم النشاط." : "This conversation was closed due to inactivity.");
    realtime.toRoom(rooms.conversation(c.id), "chat:status", { conversationId: c.id, status: "CLOSED_INACTIVE" });
    emit("CHAT_CLOSED", { conversationId: c.id });
  }
  return idle.length;
}

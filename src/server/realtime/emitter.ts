import "server-only";
import type { Server } from "socket.io";
import type { Permission } from "@/config/permissions";

/**
 * Server → client realtime pushes. The Socket.IO server is created by
 * server.ts and shared via globalThis; when it isn't running (tests, scripts)
 * every call is a harmless no-op.
 */
const io = () => (globalThis as unknown as { __io?: Server }).__io;

export const rooms = {
  staff: "staff",
  permission: (p: Permission) => `perm:${p}`,
  user: (id: string) => `user:${id}`,
  conversation: (id: string) => `conv:${id}`,
  guest: (conversationId: string) => `guest:${conversationId}`,
};

export type CounterKey = "orders" | "reviews" | "chats" | "messages" | "customers" | "notifications" | "inventory";

export const realtime = {
  toRoom(room: string, event: string, payload: unknown) {
    io()?.to(room).emit(event, payload);
  },
  toPermission(permission: Permission, event: string, payload: unknown) {
    // Super-admins join every permission room on connect, so this reaches them too.
    io()?.to(rooms.permission(permission)).emit(event, payload);
  },
  toUser(userId: string, event: string, payload: unknown) {
    io()?.to(rooms.user(userId)).emit(event, payload);
  },
  /** Tell admin clients which badge counters to refetch (counts are per-user). */
  invalidateCounters(keys: CounterKey[]) {
    io()?.to(rooms.staff).emit("counters:invalidate", { keys });
  },
  connectedCount(room: string) {
    return io()?.sockets.adapter.rooms.get(room)?.size ?? 0;
  },
};

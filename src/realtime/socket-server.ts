/**
 * Socket.IO server (runs inside the custom Node server, outside Next's module
 * graph — so it uses a tiny dedicated pg pool instead of the app services).
 *
 * Responsibilities: authenticate sockets from the same HttpOnly session
 * cookies the app uses, place them in authorised rooms, relay ephemeral typing
 * indicators and track staff presence. All *mutations* (sending messages,
 * accepting chats…) go through validated HTTP endpoints, which then push
 * events to these rooms.
 */
import type { Server as HttpServer, IncomingMessage } from "node:http";
import { createHmac } from "node:crypto";
import { Server, type Socket } from "socket.io";
import pg from "pg";

type Identity =
  | { kind: "staff"; userId: string; name: string; permissions: string[] }
  | { kind: "customer"; userId: string; name: string }
  | { kind: "guest" };

type SocketData = { identity: Identity; guestConversationId: string | null };

const hmac = (value: string, purpose: string) =>
  createHmac("sha256", process.env.APP_SECRET!).update(`${purpose}:${value}`).digest("base64url");

function parseCookies(header: string | undefined) {
  const out: Record<string, string> = {};
  for (const part of (header ?? "").split(";")) {
    const i = part.indexOf("=");
    if (i > 0) out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  }
  return out;
}

export type Presence = Map<string, number>;

export function createSocketServer(http: HttpServer, opts: { appUrl: string; allowedOrigins: string[] }) {
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 4 });
  const presence: Presence = new Map();
  (globalThis as unknown as { __presence?: Presence }).__presence = presence;

  const origins = new Set([new URL(opts.appUrl).origin, ...opts.allowedOrigins]);
  const io = new Server(http, {
    path: "/realtime",
    serveClient: false,
    cors: { origin: (origin, cb) => cb(null, !origin || origins.has(origin)), credentials: true },
    pingInterval: 25_000,
    pingTimeout: 20_000,
    maxHttpBufferSize: 16_000,
    connectionStateRecovery: { maxDisconnectionDuration: 60_000 },
  });

  async function sessionUser(token: string | undefined, scope: "ADMIN" | "STOREFRONT") {
    if (!token) return null;
    const { rows } = await pool.query(
      `SELECT u.id, u.name, u.type, u.status, r.permissions
         FROM "Session" s JOIN "User" u ON u.id = s."userId" LEFT JOIN "Role" r ON r.id = u."roleId"
        WHERE s."tokenHash" = $1 AND s.scope = $2 AND s."revokedAt" IS NULL AND s."expiresAt" > now()`,
      [hmac(token, "session"), scope],
    );
    const u = rows[0];
    return u && u.status === "ACTIVE" ? (u as { id: string; name: string; type: string; permissions: string[] | null }) : null;
  }

  async function authenticate(req: IncomingMessage, wantsAdmin: boolean): Promise<SocketData> {
    const cookies = parseCookies(req.headers.cookie);
    if (wantsAdmin) {
      const staff = await sessionUser(cookies.nq_admin, "ADMIN");
      if (staff && staff.type === "STAFF") return { identity: { kind: "staff", userId: staff.id, name: staff.name, permissions: staff.permissions ?? [] }, guestConversationId: null };
    }
    const customer = await sessionUser(cookies.nq_session, "STOREFRONT");
    let guestConversationId: string | null = null;
    if (cookies.nq_chat) {
      const { rows } = await pool.query(`SELECT id FROM "Conversation" WHERE "guestTokenHash" = $1`, [hmac(cookies.nq_chat, "chat")]);
      guestConversationId = rows[0]?.id ?? null;
    }
    if (customer) return { identity: { kind: "customer", userId: customer.id, name: customer.name }, guestConversationId };
    return { identity: { kind: "guest" }, guestConversationId };
  }

  const can = (id: Identity, permission: string) => id.kind === "staff" && (id.permissions.includes("*") || id.permissions.includes(permission));

  io.use(async (socket, next) => {
    try {
      const wantsAdmin = socket.handshake.auth?.scope === "admin";
      socket.data = await authenticate(socket.request, wantsAdmin);
      if (wantsAdmin && socket.data.identity.kind !== "staff") return next(new Error("unauthorized"));
      next();
    } catch {
      next(new Error("auth_error"));
    }
  });

  io.on("connection", (socket: Socket) => {
    const data = socket.data as SocketData;
    const id = data.identity;

    if (id.kind === "staff") {
      socket.join(["staff", `user:${id.userId}`]);
      // Permission rooms let the app target broadcasts precisely (e.g. only staff
      // allowed to see orders get order notifications).
      const all = id.permissions.includes("*");
      for (const p of PERMISSION_ROOMS) if (all || id.permissions.includes(p)) socket.join(`perm:${p}`);
      presence.set(id.userId, (presence.get(id.userId) ?? 0) + 1);
    } else if (id.kind === "customer") {
      socket.join(`user:${id.userId}`);
    }

    socket.on("chat:join", async (payload: { conversationId?: string }, ack?: (r: { ok: boolean }) => void) => {
      const cid = typeof payload?.conversationId === "string" ? payload.conversationId : "";
      let allowed = false;
      if (cid) {
        if (can(id, "support.chat")) allowed = true;
        else if (data.guestConversationId === cid) allowed = true;
        else if (id.kind === "customer") {
          const { rows } = await pool.query(`SELECT 1 FROM "Conversation" WHERE id = $1 AND "customerId" = $2`, [cid, id.userId]);
          allowed = rows.length === 1;
        }
      }
      if (allowed) socket.join(`conv:${cid}`);
      ack?.({ ok: allowed });
    });

    socket.on("chat:leave", (payload: { conversationId?: string }) => {
      if (typeof payload?.conversationId === "string") socket.leave(`conv:${payload.conversationId}`);
    });

    // Ephemeral, throttled typing indicator. Only relayed within rooms the socket joined.
    let lastTyping = 0;
    socket.on("chat:typing", (payload: { conversationId?: string; typing?: boolean }) => {
      const cid = payload?.conversationId;
      if (typeof cid !== "string" || !socket.rooms.has(`conv:${cid}`)) return;
      const now = Date.now();
      if (now - lastTyping < 1500 && payload.typing) return;
      lastTyping = now;
      socket.to(`conv:${cid}`).emit("chat:typing", { conversationId: cid, by: id.kind === "staff" ? "AGENT" : "CUSTOMER", typing: Boolean(payload.typing) });
    });

    socket.on("disconnect", () => {
      if (id.kind === "staff") {
        const n = (presence.get(id.userId) ?? 1) - 1;
        if (n <= 0) presence.delete(id.userId);
        else presence.set(id.userId, n);
      }
    });
  });

  (globalThis as unknown as { __io?: Server }).__io = io;
  return io;
}

// Keep in sync with src/config/permissions.ts (rooms used for targeted broadcasts).
const PERMISSION_ROOMS = [
  "dashboard.view", "analytics.view", "catalog.view", "catalog.edit", "inventory.manage", "reviews.moderate",
  "orders.view", "orders.manage", "customers.view", "marketing.manage", "content.manage", "support.chat",
  "support.messages", "settings.integrations", "settings.security", "audit.view",
];

"use client";

import { io, type Socket } from "socket.io-client";
import { useEffect, useState } from "react";

/**
 * One lazily-created socket per scope. Created only by features that need
 * realtime (chat widget when opened, admin shell) — regular page views never
 * open a connection. Auth is the HttpOnly session cookie, checked server-side.
 */
const sockets: Partial<Record<"store" | "admin", Socket>> = {};

export function getSocket(scope: "store" | "admin") {
  if (!sockets[scope]) {
    sockets[scope] = io({
      path: "/realtime",
      withCredentials: true,
      auth: { scope },
      transports: ["websocket", "polling"],
      reconnectionDelay: 1000,
      reconnectionDelayMax: 10_000,
    });
  }
  return sockets[scope]!;
}

export function closeSocket(scope: "store" | "admin") {
  sockets[scope]?.disconnect();
  delete sockets[scope];
}

export type ConnectionState = "connecting" | "connected" | "reconnecting" | "offline";

export function useSocketState(socket: Socket | null): ConnectionState {
  const [state, setState] = useState<ConnectionState>(socket?.connected ? "connected" : "connecting");
  useEffect(() => {
    if (!socket) return;
    const on = () => setState("connected");
    const off = () => setState("reconnecting");
    const err = () => setState(navigator.onLine ? "reconnecting" : "offline");
    socket.on("connect", on);
    socket.on("disconnect", off);
    socket.on("connect_error", err);
    if (socket.connected) setState("connected");
    return () => {
      socket.off("connect", on);
      socket.off("disconnect", off);
      socket.off("connect_error", err);
    };
  }, [socket]);
  return state;
}

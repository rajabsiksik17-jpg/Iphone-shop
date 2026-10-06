"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { adminT, type AdminT } from "@/admin/i18n";
import { hasPermission, type Permission } from "@/config/permissions";
import { getSocket, useSocketState, type ConnectionState } from "@/lib/socket";
import { countersAction } from "@/actions/admin/shell";
import { formatMoney, type MoneyContext } from "@/lib/money";
import { t as tr } from "@/lib/i18n-text";
import type { Socket } from "socket.io-client";
import type { CounterKey } from "@/server/realtime/emitter";

export type AdminUser = { id: string; name: string; email: string; avatar: string | null; role: string; permissions: string[]; agentStatus: "ONLINE" | "AWAY" | "OFFLINE" };

type Ctx = {
  locale: "ar" | "en";
  t: AdminT;
  user: AdminUser;
  can: (p: Permission | Permission[]) => boolean;
  counters: Record<CounterKey, number>;
  refreshCounters: () => void;
  socket: Socket | null;
  connection: ConnectionState;
  money: MoneyContext;
  fmt: (minor: number) => string;
  sound: boolean;
  setSound: (on: boolean) => void;
  storeName: string;
};

const AdminCtx = createContext<Ctx | null>(null);

/** Short, pleasant notification chime synthesised with WebAudio (no asset to load). */
function chime() {
  try {
    const ctx = new AudioContext();
    const now = ctx.currentTime;
    [880, 1318.5].forEach((f, i) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = "sine";
      o.frequency.value = f;
      g.gain.setValueAtTime(0.0001, now + i * 0.12);
      g.gain.exponentialRampToValueAtTime(0.12, now + i * 0.12 + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, now + i * 0.12 + 0.35);
      o.connect(g).connect(ctx.destination);
      o.start(now + i * 0.12);
      o.stop(now + i * 0.12 + 0.4);
    });
    setTimeout(() => ctx.close(), 1000);
  } catch {
    /* autoplay policies may block audio until interaction */
  }
}

export function AdminProvider({ locale, user, initialCounters, money, storeName, soundDefault, children }: { locale: "ar" | "en"; user: AdminUser; initialCounters: Record<CounterKey, number>; money: MoneyContext; storeName: string; soundDefault: boolean; children: ReactNode }) {
  const t = useMemo(() => adminT(locale), [locale]);
  const [counters, setCounters] = useState(initialCounters);
  const [socket, setSocket] = useState<Socket | null>(null);
  const [sound, setSoundState] = useState(soundDefault);
  const connection = useSocketState(socket);
  const pending = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    try {
      const v = localStorage.getItem("nq:admin-sound");
      if (v !== null) setSoundState(v === "1");
    } catch {
      /* ignore */
    }
  }, []);
  const setSound = (on: boolean) => {
    setSoundState(on);
    try {
      localStorage.setItem("nq:admin-sound", on ? "1" : "0");
    } catch {
      /* ignore */
    }
  };

  // Debounced refetch: bursts of events collapse into one request.
  const refreshCounters = useCallback(() => {
    clearTimeout(pending.current);
    pending.current = setTimeout(async () => {
      const r = await countersAction();
      if (r.ok) setCounters(r.data);
    }, 250);
  }, []);

  useEffect(() => {
    const s = getSocket("admin");
    setSocket(s);
    const onInvalidate = () => refreshCounters();
    const onNotification = (n: { title: Record<string, string>; body: Record<string, string>; link?: string; severity: string }) => {
      const title = tr(n.title, locale);
      const body = tr(n.body, locale);
      const opts = { description: body, action: n.link ? { label: locale === "ar" ? "فتح" : "Open", onClick: () => (window.location.href = `/${locale}${n.link}`) } : undefined };
      if (n.severity === "CRITICAL") toast.error(title, opts);
      else if (n.severity === "WARNING") toast.warning(title, opts);
      else toast.success(title, opts);
      if (soundRef.current) chime();
      refreshCounters();
      // Browser notification when the tab is in the background.
      if (document.hidden && "Notification" in window && Notification.permission === "granted") new Notification(title, { body });
    };
    s.on("counters:invalidate", onInvalidate);
    s.on("notification:new", onNotification);
    s.on("connect", onInvalidate);
    return () => {
      s.off("counters:invalidate", onInvalidate);
      s.off("notification:new", onNotification);
      s.off("connect", onInvalidate);
    };
  }, [locale, refreshCounters]);

  const soundRef = useRef(sound);
  useEffect(() => {
    soundRef.current = sound;
  }, [sound]);

  const value = useMemo<Ctx>(
    () => ({
      locale,
      t,
      user,
      can: (p) => hasPermission(user.permissions, p),
      counters,
      refreshCounters,
      socket,
      connection,
      money,
      fmt: (minor) => formatMoney(minor, money, { trimZeros: true }),
      sound,
      setSound,
      storeName,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [locale, t, user, counters, refreshCounters, socket, connection, money, sound, storeName],
  );
  return <AdminCtx.Provider value={value}>{children}</AdminCtx.Provider>;
}

export function useAdmin() {
  const v = useContext(AdminCtx);
  if (!v) throw new Error("useAdmin must be used within AdminProvider");
  return v;
}

"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "@/i18n/navigation";
import { useAdmin } from "./admin-context";

type Key = "orders" | "reviews" | "chats" | "messages" | "customers" | "notifications" | "inventory";

/**
 * Re-fetch the current admin page when the server reports changes to any of
 * `keys` (another admin, a customer order, a stock movement…). Bursts are
 * coalesced into one refresh; `onChange` lets a page also reload an open drawer.
 */
export function useLiveRefresh(keys: Key[], onChange?: () => void) {
  const { socket } = useAdmin();
  const router = useRouter();
  const cb = useRef(onChange);
  cb.current = onChange;
  const keyList = keys.join(",");
  useEffect(() => {
    if (!socket) return;
    const wanted = new Set(keyList.split(","));
    let timer: ReturnType<typeof setTimeout> | undefined;
    const on = (p: { keys: string[] }) => {
      if (!p.keys.some((k) => wanted.has(k))) return;
      clearTimeout(timer);
      timer = setTimeout(() => {
        router.refresh();
        cb.current?.();
      }, 500);
    };
    socket.on("counters:invalidate", on);
    return () => {
      clearTimeout(timer);
      socket.off("counters:invalidate", on);
    };
  }, [socket, router, keyList]);
}

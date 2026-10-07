"use client";

import { useEffect, useState } from "react";
import { Bell, CheckCheck, AlertTriangle, CircleCheck, Info, OctagonAlert } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/menu";
import { Spinner } from "@/components/ui/spinner";
import { notificationsAction, markNotificationsAction } from "@/actions/admin/shell";
import { useAdmin } from "./admin-context";
import { t as tr } from "@/lib/i18n-text";
import { cn } from "@/lib/utils";
import { timeAgo } from "@/lib/time";
import { TimeAgo } from "@/components/ui/time-ago";

type N = { id: string; title: Record<string, string>; body: Record<string, string>; link: string | null; severity: string; createdAt: string; read: boolean };

export const SEVERITY_ICON: Record<string, { icon: typeof Info; cls: string }> = {
  INFO: { icon: Info, cls: "text-sky-500 bg-sky-500/10" },
  SUCCESS: { icon: CircleCheck, cls: "text-emerald-500 bg-emerald-500/10" },
  WARNING: { icon: AlertTriangle, cls: "text-amber-500 bg-amber-500/10" },
  CRITICAL: { icon: OctagonAlert, cls: "text-red-500 bg-red-500/10" },
};

export function NotificationBell() {
  const { t, counters, locale, refreshCounters, socket } = useAdmin();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<N[] | null>(null);
  const count = counters.notifications;

  const load = async () => {
    const r = await notificationsAction({ take: 15 });
    if (r.ok) setItems(r.data);
  };

  useEffect(() => {
    if (open) void load();
  }, [open]);

  // Prepend live notifications while the panel is open.
  useEffect(() => {
    if (!socket || !open) return;
    const onNew = () => void load();
    socket.on("notification:new", onNew);
    return () => void socket.off("notification:new", onNew);
  }, [socket, open]);

  useEffect(() => {
    if ("Notification" in window && Notification.permission === "default") {
      const ask = () => Notification.requestPermission().catch(() => {});
      window.addEventListener("click", ask, { once: true });
    }
  }, []);

  const markAll = async () => {
    await markNotificationsAction("all");
    setItems((list) => list?.map((n) => ({ ...n, read: true })) ?? null);
    refreshCounters();
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger className="relative grid size-9 place-items-center rounded-lg text-ad-muted transition hover:bg-ad-hover hover:text-ad-fg" aria-label={`${t("notif.title")} (${count})`}>
        <Bell className="size-[18px]" />
        {count > 0 && <span className="absolute end-1 top-1 grid min-w-4 place-items-center rounded-full bg-red-500 px-1 text-[9.5px] font-bold leading-4 text-white animate-scale-in">{count > 99 ? "99+" : count}</span>}
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[min(380px,calc(100vw-24px))] p-0">
        <div className="flex items-center justify-between border-b border-ad-border px-4 py-3">
          <p className="text-sm font-semibold">{t("notif.title")}</p>
          {count > 0 && (
            <button type="button" onClick={markAll} className="flex items-center gap-1.5 text-xs text-ad-muted hover:text-ad-fg">
              <CheckCheck className="size-3.5" /> {t("notif.markAll")}
            </button>
          )}
        </div>
        <div className="max-h-[420px] overflow-y-auto">
          {!items ? (
            <div className="grid place-items-center py-10">
              <Spinner className="size-5 text-ad-muted" />
            </div>
          ) : !items.length ? (
            <p className="py-10 text-center text-sm text-ad-muted">{t("notif.empty")}</p>
          ) : (
            <ul className="divide-y divide-ad-border">
              {items.map((n) => {
                const S = SEVERITY_ICON[n.severity] ?? SEVERITY_ICON.INFO;
                const body = (
                  <div className={cn("flex gap-3 px-4 py-3 transition hover:bg-ad-hover", !n.read && "bg-ad-accent/5")}>
                    <span className={cn("grid size-8 shrink-0 place-items-center rounded-full", S.cls)}>
                      <S.icon className="size-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-[13px] font-medium leading-snug">{tr(n.title, locale)}</p>
                      {tr(n.body, locale) && <p className="mt-0.5 line-clamp-2 text-xs text-ad-muted">{tr(n.body, locale)}</p>}
                      <p className="mt-1 text-[11px] text-ad-muted"><TimeAgo date={n.createdAt} /></p>
                    </div>
                    {!n.read && <span className="mt-1.5 size-2 shrink-0 rounded-full bg-ad-accent" />}
                  </div>
                );
                return (
                  <li key={n.id}>
                    {n.link ? (
                      <Link href={n.link} onClick={() => (setOpen(false), markNotificationsAction([n.id]).then(refreshCounters))}>
                        {body}
                      </Link>
                    ) : (
                      body
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
        <Link href="/admin/notifications" onClick={() => setOpen(false)} className="block border-t border-ad-border py-2.5 text-center text-xs font-medium text-ad-muted hover:text-ad-fg">
          {t("notif.viewAll")}
        </Link>
      </PopoverContent>
    </Popover>
  );
}

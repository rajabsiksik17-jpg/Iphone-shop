"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { ArrowLeft, Check, CheckCheck, ExternalLink, Info, MessageSquareText, Send, ShoppingCart, Star, UserRound, X, ArrowRightLeft, Zap } from "lucide-react";
import { toast } from "sonner";
import { Link } from "@/i18n/navigation";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Dropdown, DropdownContent, DropdownItem, DropdownTrigger } from "@/components/ui/menu";
import { useAdmin } from "../admin-context";
import { Pill, ColorPill, ConfirmDialog } from "../ui";
import { chatInboxAction, chatThreadAction, acceptChatAction, sendAgentMessageAction, closeChatAction, transferChatAction, markChatReadAgentAction } from "@/actions/admin/support";
import { setAgentStatusAction } from "@/actions/admin/shell";
import { timeAgo, elapsed } from "@/lib/time";
import { cn } from "@/lib/utils";
import type { ChatInbox, ChatThread } from "@/server/admin/support";

type Tab = "waiting" | "mine" | "active" | "closed";
type Message = ChatThread["messages"][number];
const OPEN = ["WAITING", "ASSIGNED", "ACTIVE"];

export function ChatConsole({ initial }: { initial: ChatInbox }) {
  const { t, locale, socket, user, fmt, refreshCounters } = useAdmin();
  const sp = useSearchParams();
  const [inbox, setInbox] = useState(initial);
  const [tab, setTab] = useState<Tab>(initial.waiting.length ? "waiting" : "mine");
  const [selectedId, setSelectedId] = useState<string | null>(sp.get("c"));
  const [thread, setThread] = useState<ChatThread | null>(null);
  const [loadingThread, setLoadingThread] = useState(false);
  const [draft, setDraft] = useState("");
  const [typing, setTyping] = useState(false);
  const [showInfo, setShowInfo] = useState(false);
  const [confirmEnd, setConfirmEnd] = useState(false);
  const [myStatus, setMyStatus] = useState(initial.me.status);
  const [, setTick] = useState(0);
  const [pending, start] = useTransition();
  const listRef = useRef<HTMLDivElement>(null);
  const selectedRef = useRef(selectedId);
  selectedRef.current = selectedId;

  const reloadInbox = useCallback(async () => {
    const r = await chatInboxAction();
    if (r.ok) setInbox(r.data);
  }, []);

  const loadThread = useCallback(
    async (id: string) => {
      setLoadingThread(true);
      const r = await chatThreadAction(id, locale);
      setLoadingThread(false);
      if (r.ok && r.data && selectedRef.current === id) {
        setThread(r.data);
        // Opening a thread marks it read server-side; mirror that in the inbox.
        setInbox((ib) => {
          const clear = (list: ChatInbox["mine"]) => list.map((c) => (c.id === id ? { ...c, unread: false } : c));
          return { ...ib, mine: clear(ib.mine), active: clear(ib.active), closed: clear(ib.closed) };
        });
        refreshCounters();
      }
    },
    [locale, refreshCounters],
  );

  // Elapsed timers ("waiting 3m") tick every 30s.
  useEffect(() => {
    const i = setInterval(() => setTick((n) => n + 1), 30_000);
    return () => clearInterval(i);
  }, []);

  useEffect(() => {
    if (!selectedId) return void setThread(null);
    setThread(null);
    void loadThread(selectedId);
    const url = new URL(window.location.href);
    url.searchParams.set("c", selectedId);
    window.history.replaceState(null, "", url);
  }, [selectedId, loadThread]);

  // Realtime: queue changes, activity in other conversations, and the open thread.
  useEffect(() => {
    if (!socket) return;
    const onQueue = () => void reloadInbox();
    const onActivity = (p: { conversationId: string }) => {
      // The open thread is read as messages arrive; mark it before refreshing the list.
      if (p.conversationId === selectedRef.current) void markChatReadAgentAction(p.conversationId).then(reloadInbox);
      else void reloadInbox();
    };
    socket.on("chat:queue", onQueue);
    socket.on("chat:activity", onActivity);
    socket.on("connect", onQueue);
    return () => {
      socket.off("chat:queue", onQueue);
      socket.off("chat:activity", onActivity);
      socket.off("connect", onQueue);
    };
  }, [socket, reloadInbox]);

  useEffect(() => {
    if (!socket || !selectedId) return;
    const join = () => socket.emit("chat:join", { conversationId: selectedId });
    join();
    socket.on("connect", join);
    const onMessage = (m: Message) => {
      if (m.conversationId !== selectedId) return;
      setThread((th) => (th && !th.messages.some((x) => x.id === m.id) ? { ...th, messages: [...th.messages, m] } : th));
      if (m.sender === "CUSTOMER") setTyping(false);
    };
    // Status changes (accepted, transferred, closed) can change the assignee too: refetch.
    const onStatus = (p: { conversationId: string }) => {
      if (p.conversationId !== selectedId) return;
      void loadThread(selectedId);
      void reloadInbox();
    };
    const onTyping = (p: { conversationId: string; by: string; typing: boolean }) => p.conversationId === selectedId && p.by === "CUSTOMER" && setTyping(p.typing);
    const onRead = (p: { conversationId: string; by: string; at: string }) => p.conversationId === selectedId && p.by === "CUSTOMER" && setThread((th) => (th ? { ...th, customerLastRead: p.at } : th));
    socket.on("chat:message", onMessage);
    socket.on("chat:status", onStatus);
    socket.on("chat:typing", onTyping);
    socket.on("chat:read", onRead);
    return () => {
      socket.emit("chat:leave", { conversationId: selectedId });
      socket.off("connect", join);
      socket.off("chat:message", onMessage);
      socket.off("chat:status", onStatus);
      socket.off("chat:typing", onTyping);
      socket.off("chat:read", onRead);
      setTyping(false);
    };
  }, [socket, selectedId, reloadInbox, loadThread]);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [thread?.messages.length, typing]);

  const lists = { waiting: inbox.waiting, mine: inbox.mine, active: inbox.active, closed: inbox.closed };
  const isMine = thread?.agent?.id === user.id;
  const canReply = thread && ["ASSIGNED", "ACTIVE"].includes(thread.status) && (isMine || !thread.agent);
  const canned = useMemo(() => [t("chat.cannedHello"), t("chat.cannedCheck"), t("chat.cannedThanks")], [t]);

  const errorText = (code: string) =>
    code === "chat_already_taken" ? t("chat.taken") : code === "chat_assigned_elsewhere" ? (locale === "ar" ? "المحادثة مسندة لوكيل آخر" : "This chat is assigned to another agent") : code === "chat_closed" ? (locale === "ar" ? "المحادثة مغلقة" : "This conversation is closed") : t("c.error");

  const accept = (id: string) =>
    start(async () => {
      const r = await acceptChatAction(id);
      if (!r.ok) return void toast.error(errorText(r.error));
      setTab("mine");
      setSelectedId(id);
      await Promise.all([reloadInbox(), loadThread(id)]);
    });

  const send = (text = draft) => {
    const body = text.trim();
    if (!body || !thread) return;
    setDraft("");
    socket?.emit("chat:typing", { conversationId: thread.id, typing: false });
    start(async () => {
      const r = await sendAgentMessageAction(thread.id, body);
      if (!r.ok) {
        setDraft(body);
        toast.error(errorText(r.error));
      } else setThread((th) => (th && !th.messages.some((x) => x.id === r.data.id) ? { ...th, messages: [...th.messages, r.data] } : th));
    });
  };

  const onDraft = (v: string) => {
    setDraft(v);
    if (thread) socket?.emit("chat:typing", { conversationId: thread.id, typing: v.length > 0 });
  };

  const changeStatus = (s: "ONLINE" | "AWAY" | "OFFLINE") =>
    start(async () => {
      const r = await setAgentStatusAction(s);
      if (r.ok) setMyStatus(s);
    });

  const lastAgentMsg = thread?.messages.filter((m) => m.sender === "AGENT").at(-1);
  const seen = Boolean(lastAgentMsg && thread?.customerLastRead && new Date(thread.customerLastRead) >= new Date(lastAgentMsg.createdAt));

  return (
    <div className="flex h-[calc(100dvh-12rem)] min-h-[28rem] overflow-hidden rounded-2xl border border-ad-border bg-ad-panel lg:h-[calc(100dvh-8.5rem)]">
      {/* Inbox */}
      <aside className={cn("flex w-full shrink-0 flex-col border-ad-border md:w-80 md:border-e", selectedId && "max-md:hidden")}>
        <div className="flex items-center justify-between gap-2 border-b border-ad-border px-4 py-3">
          <h1 className="text-base font-semibold">{t("chat.title")}</h1>
          <Dropdown>
            <DropdownTrigger asChild>
              <button type="button" className="flex items-center gap-1.5 rounded-full border border-ad-border px-2.5 py-1 text-xs">
                <span className={cn("size-2 rounded-full", myStatus === "ONLINE" ? "bg-emerald-500" : myStatus === "AWAY" ? "bg-amber-500" : "bg-neutral-400")} />
                {t(`c.${myStatus.toLowerCase()}` as "c.online")}
              </button>
            </DropdownTrigger>
            <DropdownContent align="end">
              {(["ONLINE", "AWAY", "OFFLINE"] as const).map((s) => (
                <DropdownItem key={s} onSelect={() => changeStatus(s)}>
                  <span className={cn("size-2 rounded-full", s === "ONLINE" ? "bg-emerald-500" : s === "AWAY" ? "bg-amber-500" : "bg-neutral-400")} /> {t(`c.${s.toLowerCase()}` as "c.online")}
                </DropdownItem>
              ))}
            </DropdownContent>
          </Dropdown>
        </div>
        {myStatus !== "ONLINE" && <p className="border-b border-ad-border bg-amber-50 px-4 py-2 text-xs text-amber-800 dark:bg-amber-950/40 dark:text-amber-300">{t("chat.offlineWarning")}</p>}
        <div className="flex gap-1 border-b border-ad-border p-2" role="tablist">
          {(["waiting", "mine", "active", "closed"] as const).map((k) => (
            <button
              key={k}
              type="button"
              role="tab"
              aria-selected={tab === k}
              onClick={() => setTab(k)}
              className={cn("flex flex-1 items-center justify-center gap-1 whitespace-nowrap rounded-lg px-1 py-1.5 text-xs font-medium transition", tab === k ? "bg-ad-fg text-ad-panel" : "text-ad-muted hover:bg-ad-hover")}
            >
              {t(`chat.${k}` as "chat.waiting")}
              {k !== "closed" && lists[k].length > 0 && <span className={cn("tabular rounded-full px-1.5 text-[10px]", k === "waiting" ? "bg-red-500 text-white" : "bg-ad-sunken text-ad-fg")}>{lists[k].length}</span>}
            </button>
          ))}
        </div>
        <ul className="flex-1 overflow-y-auto">
          {lists[tab].map((c) => (
            <li key={c.id}>
              <button
                type="button"
                onClick={() => setSelectedId(c.id)}
                className={cn("flex w-full gap-3 border-b border-ad-border/60 px-4 py-3 text-start transition hover:bg-ad-hover", selectedId === c.id && "bg-ad-accent/5")}
              >
                <span className={cn("grid size-9 shrink-0 place-items-center rounded-full text-sm font-semibold", c.isGuest ? "bg-ad-sunken text-ad-muted" : "bg-ad-accent/10 text-ad-accent")}>{(c.name ?? "?").slice(0, 1).toUpperCase()}</span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1.5">
                    <span className={cn("truncate text-sm", c.unread && c.status !== "WAITING" ? "font-semibold" : "font-medium")}>{c.name ?? t("chat.guest")}</span>
                    {c.isGuest && <Pill className="!px-1.5 !py-0 text-[10px]">{t("chat.guest")}</Pill>}
                    <span className="ms-auto shrink-0 text-[11px] text-ad-muted">{c.status === "WAITING" ? t("chat.waitingFor", { t: elapsed(c.createdAt) }) : timeAgo(c.lastMessageAt, locale)}</span>
                  </span>
                  <span className="block truncate text-xs text-ad-muted">{c.subject}</span>
                  {c.preview && <span className={cn("mt-0.5 block truncate text-xs", c.unread && c.status !== "WAITING" ? "text-ad-fg" : "text-ad-muted")}>{c.preview.sender === "AGENT" ? `↩ ${c.preview.body}` : c.preview.body}</span>}
                  {tab === "active" && c.agent && <span className="mt-0.5 block text-[11px] text-ad-muted">{t("chat.assignedTo", { name: c.agent })}</span>}
                  {tab === "closed" && c.rating != null && (
                    <span className="mt-0.5 flex items-center gap-0.5 text-[11px] text-amber-600">
                      <Star className="size-3 fill-current" /> {c.rating}/5
                    </span>
                  )}
                </span>
                {c.unread && c.status !== "WAITING" && c.status !== "CLOSED_BY_AGENT" && <span className="mt-1.5 size-2 shrink-0 rounded-full bg-ad-accent" aria-label="unread" />}
              </button>
              {tab === "waiting" && (
                <div className="border-b border-ad-border/60 px-4 pb-3">
                  <Button size="xs" block loading={pending} leftIcon={<Check />} onClick={() => accept(c.id)}>
                    {t("chat.accept")}
                  </Button>
                </div>
              )}
            </li>
          ))}
          {!lists[tab].length && <li className="px-6 py-16 text-center text-sm text-ad-muted">{t("chat.empty")}</li>}
        </ul>
      </aside>

      {/* Thread */}
      <section className={cn("flex min-w-0 flex-1 flex-col", !selectedId && "max-md:hidden")}>
        {!selectedId ? (
          <div className="grid flex-1 place-items-center p-8 text-center text-sm text-ad-muted">
            <div>
              <MessageSquareText className="mx-auto mb-3 size-10 opacity-40" />
              {t("chat.select")}
            </div>
          </div>
        ) : !thread ? (
          <div className="grid flex-1 place-items-center text-sm text-ad-muted">{loadingThread ? "…" : t("c.empty")}</div>
        ) : (
          <>
            <header className="flex items-center gap-2 border-b border-ad-border px-3 py-2.5 sm:px-4">
              <Button size="icon-sm" variant="ghost" className="md:hidden" aria-label={t("c.back")} onClick={() => setSelectedId(null)}>
                <ArrowLeft className="rtl:rotate-180" />
              </Button>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{thread.customer.name ?? t("chat.guest")}</p>
                <p className="truncate text-xs text-ad-muted">
                  {thread.subject}
                  {thread.agent && ` · ${t("chat.assignedTo", { name: thread.agent.id === user.id ? (locale === "ar" ? "أنت" : "you") : thread.agent.name })}`}
                </p>
              </div>
              {thread.status === "WAITING" && (
                <Button size="sm" loading={pending} leftIcon={<Check />} onClick={() => accept(thread.id)}>
                  {t("chat.accept")}
                </Button>
              )}
              {OPEN.includes(thread.status) && thread.status !== "WAITING" && (
                <>
                  <Dropdown>
                    <DropdownTrigger asChild>
                      <Button size="sm" variant="outline" leftIcon={<ArrowRightLeft />} className="max-sm:hidden">
                        {t("chat.transfer")}
                      </Button>
                    </DropdownTrigger>
                    <DropdownContent align="end">
                      {inbox.agents
                        .filter((a) => a.id !== thread.agent?.id)
                        .map((a) => (
                          <DropdownItem
                            key={a.id}
                            onSelect={() =>
                              start(async () => {
                                const r = await transferChatAction(thread.id, a.id);
                                if (r.ok) {
                                  toast.success(t("c.saved"));
                                  await reloadInbox();
                                } else toast.error(errorText(r.error));
                              })
                            }
                          >
                            <span className={cn("size-2 rounded-full", a.status === "ONLINE" ? "bg-emerald-500" : a.status === "AWAY" ? "bg-amber-500" : "bg-neutral-400")} />
                            {a.name}
                          </DropdownItem>
                        ))}
                    </DropdownContent>
                  </Dropdown>
                  <Button size="sm" variant="outline" className="text-red-600" leftIcon={<X />} onClick={() => setConfirmEnd(true)}>
                    <span className="max-sm:hidden">{t("chat.end")}</span>
                  </Button>
                </>
              )}
              <Button size="icon-sm" variant="ghost" className="xl:hidden" aria-label={t("chat.customerInfo")} onClick={() => setShowInfo((v) => !v)}>
                <Info />
              </Button>
            </header>

            <div ref={listRef} className="flex-1 space-y-2 overflow-y-auto bg-ad-sunken/40 px-3 py-4 sm:px-6" aria-live="polite">
              {thread.messages.map((m, i) => {
                if (m.sender === "SYSTEM")
                  return (
                    <p key={m.id} className="mx-auto max-w-md py-1 text-center text-[11px] text-ad-muted">
                      {m.body}
                    </p>
                  );
                const mine = m.sender === "AGENT";
                const prev = thread.messages[i - 1];
                const grouped = prev && prev.sender === m.sender && new Date(m.createdAt).getTime() - new Date(prev.createdAt).getTime() < 120_000;
                return (
                  <div key={m.id} className={cn("flex", mine ? "justify-end" : "justify-start", !grouped && "pt-1.5")}>
                    <div className={cn("max-w-[78%] rounded-2xl px-3.5 py-2 text-sm leading-relaxed shadow-sm", mine ? "rounded-ee-md bg-ad-accent text-white" : "rounded-es-md bg-ad-panel")}>
                      <p className="whitespace-pre-wrap break-words" dir="auto">
                        {m.body}
                      </p>
                      <p className={cn("mt-0.5 flex items-center justify-end gap-1 text-[10px]", mine ? "text-white/70" : "text-ad-muted")}>
                        {new Date(m.createdAt).toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" })}
                        {mine && m.id === lastAgentMsg?.id && (seen ? <CheckCheck className="size-3" aria-label="seen" /> : <Check className="size-3" />)}
                      </p>
                    </div>
                  </div>
                );
              })}
              {typing && <p className="animate-pulse text-xs text-ad-muted">{t("chat.typing")}</p>}
              {!OPEN.includes(thread.status) && (
                <p className="py-3 text-center text-xs text-ad-muted">
                  {t("chat.closed")}
                  {thread.rating != null && ` · ${t("chat.rating", { n: thread.rating })}`}
                </p>
              )}
            </div>

            {canReply ? (
              <div className="border-t border-ad-border p-2.5 sm:p-3">
                <div className="mb-2 flex gap-1.5 overflow-x-auto">
                  {canned.map((c) => (
                    <button key={c} type="button" onClick={() => send(c)} className="flex shrink-0 items-center gap-1 rounded-full border border-ad-border px-2.5 py-1 text-xs text-ad-muted transition hover:border-ad-accent hover:text-ad-fg">
                      <Zap className="size-3" /> {c.length > 34 ? `${c.slice(0, 34)}…` : c}
                    </button>
                  ))}
                </div>
                <form
                  className="flex items-end gap-2"
                  onSubmit={(e) => {
                    e.preventDefault();
                    send();
                  }}
                >
                  <textarea
                    value={draft}
                    onChange={(e) => onDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                        e.preventDefault();
                        send();
                      }
                    }}
                    rows={1}
                    maxLength={2000}
                    placeholder={t("chat.placeholder")}
                    className="max-h-40 min-h-11 flex-1 resize-none rounded-xl border border-ad-border bg-ad-panel px-3.5 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ad-accent/30 [field-sizing:content]"
                    aria-label={t("chat.placeholder")}
                  />
                  <Button type="submit" size="icon" disabled={!draft.trim()} aria-label="Send">
                    <Send className="rtl:-scale-x-100" />
                  </Button>
                </form>
              </div>
            ) : thread.status === "WAITING" ? (
              <div className="border-t border-ad-border p-3 text-center text-xs text-ad-muted">{t("chat.waiting")}…</div>
            ) : null}
          </>
        )}
      </section>

      {/* Customer context */}
      {thread && (
        <aside className={cn("w-80 shrink-0 overflow-y-auto border-s border-ad-border p-4 text-sm max-xl:fixed max-xl:inset-y-0 max-xl:end-0 max-xl:z-40 max-xl:bg-ad-panel max-xl:shadow-pop", !showInfo && "max-xl:hidden")}>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-semibold">{t("chat.customerInfo")}</h2>
            <Button size="icon-sm" variant="ghost" className="xl:hidden" aria-label={t("c.close")} onClick={() => setShowInfo(false)}>
              <X />
            </Button>
          </div>
          <div className="flex items-center gap-3">
            <span className="grid size-11 place-items-center rounded-full bg-ad-sunken">
              <UserRound className="size-5 text-ad-muted" />
            </span>
            <div className="min-w-0">
              <p className="truncate font-medium">{thread.customer.name ?? t("chat.guest")}</p>
              {thread.customer.email && (
                <a href={`mailto:${thread.customer.email}`} className="block truncate text-xs text-ad-muted hover:underline" dir="ltr">
                  {thread.customer.email}
                </a>
              )}
              {thread.customer.phone && (
                <a href={`tel:${thread.customer.phone}`} className="block text-xs text-ad-muted" dir="ltr">
                  {thread.customer.phone}
                </a>
              )}
            </div>
          </div>
          {thread.customer.id ? (
            <Link href={`/admin/customers/${thread.customer.id}`} className="mt-3 inline-flex items-center gap-1 text-xs text-ad-accent hover:underline">
              {t("c.view")} <ExternalLink className="size-3" />
            </Link>
          ) : (
            <p className="mt-3 text-xs text-ad-muted">{locale === "ar" ? "زائر غير مسجّل" : "Not signed in"}</p>
          )}
          {thread.pageUrl && (
            <div className="mt-5">
              <p className="mb-1 text-xs font-medium text-ad-muted">{t("chat.page")}</p>
              <a href={thread.pageUrl} target="_blank" rel="noopener noreferrer" className="block truncate text-xs hover:underline" dir="ltr">
                {thread.pageUrl.replace(/^https?:\/\/[^/]+/, "")}
              </a>
            </div>
          )}
          <div className="mt-5">
            <p className="mb-2 text-xs font-medium text-ad-muted">{t("chat.recentOrders")}</p>
            {thread.orders.length ? (
              <ul className="space-y-2">
                {thread.orders.map((o) => (
                  <li key={o.id}>
                    <Link href={`/admin/orders/${o.id}`} className="flex items-center justify-between gap-2 rounded-lg border border-ad-border px-2.5 py-2 text-xs hover:bg-ad-hover">
                      <span className="font-medium">{o.number}</span>
                      <ColorPill label={o.status.label} color={o.status.color} />
                      <span className="tabular">{fmt(o.total)}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-ad-muted">{t("c.empty")}</p>
            )}
          </div>
          <div className="mt-5">
            <p className="mb-2 text-xs font-medium text-ad-muted">{t("chat.currentCart")}</p>
            {thread.cart.length ? (
              <ul className="space-y-1 text-xs">
                {thread.cart.map((i, k) => (
                  <li key={k} className="flex items-center gap-2">
                    <ShoppingCart className="size-3 text-ad-muted" /> {i.name} × {i.quantity}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-ad-muted">{t("c.empty")}</p>
            )}
          </div>
        </aside>
      )}

      <ConfirmDialog
        open={confirmEnd}
        onOpenChange={setConfirmEnd}
        title={t("chat.end")}
        confirmLabel={t("chat.end")}
        onConfirm={async () => {
          if (!thread) return;
          const r = await closeChatAction(thread.id);
          setConfirmEnd(false);
          if (r.ok) {
            await Promise.all([reloadInbox(), loadThread(thread.id)]);
          } else toast.error(t("c.error"));
        }}
      />
    </div>
  );
}

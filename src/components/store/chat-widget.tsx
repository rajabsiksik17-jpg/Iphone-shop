"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { ArrowUp, Headset, Mail, Star, X, WifiOff } from "lucide-react";
import { toast } from "sonner";
import { useStore } from "@/components/providers/store-context";
import { chatStateAction, endChatAction, markChatReadAction, sendChatMessageAction, startChatAction } from "@/actions/chat";
import { getSocket, useSocketState } from "@/lib/socket";
import { useErrorMessage } from "@/lib/use-action";
import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { SocialIcon } from "@/components/ui/social-icon";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import type { Socket } from "socket.io-client";

type Msg = { id: string; conversationId: string; sender: string; senderId: string | null; body: string; createdAt: string };
type State = Awaited<ReturnType<typeof chatStateAction>> extends infer R ? (R extends { ok: true; data: infer D } ? D : never) : never;

const OPEN = ["WAITING", "ASSIGNED", "ACTIVE"];

export function ChatWidget({ whatsappHref, offlineText }: { whatsappHref: string | null; offlineText: string }) {
  const t = useTranslations("chat");
  const locale = useLocale();
  const errorMessage = useErrorMessage();
  const { chatOpen, setChatOpen, user } = useStore();
  const [state, setState] = useState<State | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [status, setStatus] = useState<string | null>(null);
  const [agent, setAgent] = useState<string | null>(null);
  const [typing, setTyping] = useState(false);
  const [socket, setSocket] = useState<Socket | null>(null);
  const [text, setText] = useState("");
  const [form, setForm] = useState({ name: "", email: "", subject: "", message: "" });
  const [rated, setRated] = useState(false);
  const [pending, start] = useTransition();
  const listRef = useRef<HTMLDivElement>(null);
  const typingTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const connection = useSocketState(socket);

  const conversationId = state?.conversation?.id ?? null;

  const load = useCallback(async () => {
    const res = await chatStateAction();
    if (!res.ok) return;
    setState(res.data);
    if (res.data.conversation) {
      setMessages(res.data.conversation.messages);
      setStatus(res.data.conversation.status);
      setAgent(res.data.conversation.agent?.name ?? null);
    }
  }, []);

  useEffect(() => {
    if (chatOpen && !state) void load();
  }, [chatOpen, state, load]);

  // Connect only once a conversation exists.
  useEffect(() => {
    if (!conversationId) return;
    const s = getSocket("store");
    setSocket(s);
    const join = () => s.emit("chat:join", { conversationId });
    if (s.connected) join();
    s.on("connect", join);
    const onMessage = (m: Msg) => {
      if (m.conversationId !== conversationId) return;
      setMessages((prev) => (prev.some((x) => x.id === m.id) ? prev : [...prev, m]));
      if (m.sender === "AGENT") setTyping(false);
    };
    const onStatus = (p: { conversationId: string; status: string; agent?: { name: string } }) => {
      if (p.conversationId !== conversationId) return;
      setStatus(p.status);
      if (p.agent) setAgent(p.agent.name);
    };
    const onTyping = (p: { conversationId: string; by: string; typing: boolean }) => {
      if (p.conversationId === conversationId && p.by === "AGENT") {
        setTyping(p.typing);
        clearTimeout(typingTimer.current);
        typingTimer.current = setTimeout(() => setTyping(false), 5000);
      }
    };
    s.on("chat:message", onMessage);
    s.on("chat:status", onStatus);
    s.on("chat:typing", onTyping);
    return () => {
      s.off("connect", join);
      s.off("chat:message", onMessage);
      s.off("chat:status", onStatus);
      s.off("chat:typing", onTyping);
      s.emit("chat:leave", { conversationId });
    };
  }, [conversationId]);

  // After a reconnect, refetch to cover anything missed while offline.
  useEffect(() => {
    if (connection === "connected" && conversationId) void load();
  }, [connection, conversationId, load]);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
    if (chatOpen && conversationId && messages.length) markChatReadAction(conversationId).catch(() => {});
  }, [messages, typing, chatOpen, conversationId]);

  if (!chatOpen) return null;

  const isOpenConv = status && OPEN.includes(status);
  const ended = status && !OPEN.includes(status);

  const startChat = () =>
    start(async () => {
      const res = await startChatAction({
        subject: form.subject,
        message: form.message,
        name: user ? undefined : form.name,
        email: user ? undefined : form.email,
        pageUrl: window.location.pathname,
        locale,
      });
      if (!res.ok) {
        toast.error(errorMessage(res));
        if (res.error === "chat_offline") await load();
        return;
      }
      setForm({ name: "", email: "", subject: "", message: "" });
      setState(null);
      await load();
    });

  const send = () => {
    const body = text.trim();
    if (!body || !conversationId) return;
    setText("");
    socket?.emit("chat:typing", { conversationId, typing: false });
    start(async () => {
      const res = await sendChatMessageAction(conversationId, body);
      if (res.ok) setMessages((prev) => (prev.some((x) => x.id === res.data.id) ? prev : [...prev, res.data]));
      else {
        toast.error(errorMessage(res));
        setText(body);
      }
    });
  };

  const onType = (v: string) => {
    setText(v);
    if (conversationId) socket?.emit("chat:typing", { conversationId, typing: v.length > 0 });
  };

  const header = (
    <div className="flex items-center gap-3 bg-primary px-4 py-3.5 text-primary-fg">
      <span className="grid size-10 place-items-center rounded-full bg-white/15">
        <Headset className="size-5" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="font-semibold leading-tight">{agent && isOpenConv && status !== "WAITING" ? t("connected", { name: agent }) : t("title")}</p>
        <p className="flex items-center gap-1.5 text-xs opacity-80">
          {connection === "reconnecting" && conversationId ? (
            <>
              <WifiOff className="size-3" /> {t("reconnecting")}
            </>
          ) : status === "WAITING" ? (
            <>
              <span className="size-1.5 animate-pulse rounded-full bg-amber-300" /> {t("waiting")}
            </>
          ) : (
            t("subtitle")
          )}
        </p>
      </div>
      <button type="button" onClick={() => setChatOpen(false)} className="grid size-9 place-items-center rounded-full hover:bg-white/10" aria-label={t("title")}>
        <X className="size-5" />
      </button>
    </div>
  );

  return (
    <div role="dialog" aria-label={t("title")} className="animate-fade-up fixed inset-0 z-[75] flex flex-col overflow-hidden bg-bg shadow-pop sm:inset-auto sm:bottom-6 sm:end-6 sm:h-[600px] sm:max-h-[calc(100dvh-48px)] sm:w-[390px] sm:rounded-3xl sm:border sm:border-border">
      {header}
      {!state ? (
        <div className="grid flex-1 place-items-center">
          <Spinner />
        </div>
      ) : !conversationId || (ended && !messages.length) ? (
        !state.availability.online ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-4 p-6 text-center">
            <div className="grid size-14 place-items-center rounded-2xl bg-surface">
              <Headset className="size-6 text-muted" />
            </div>
            <h3 className="font-semibold">{t("offlineTitle")}</h3>
            <p className="text-sm text-muted">{offlineText}</p>
            <div className="grid w-full gap-2">
              <Button asChild onClick={() => setChatOpen(false)}>
                <Link href="/contact">
                  <Mail /> {t("leaveMessage")}
                </Link>
              </Button>
              {whatsappHref && (
                <Button asChild variant="outline">
                  <a href={whatsappHref} target="_blank" rel="noopener noreferrer">
                    <SocialIcon platform="whatsapp" brandColor className="size-4" /> {t("whatsappUs")}
                  </a>
                </Button>
              )}
            </div>
          </div>
        ) : (
          <form
            className="flex-1 space-y-3 overflow-y-auto p-5"
            onSubmit={(e) => {
              e.preventDefault();
              startChat();
            }}
          >
            <p className="text-sm text-muted">{user ? t("signedInAs", { name: user.name }) : t("subtitle")}</p>
            {!user && (
              <>
                <Field label={t("name")}>{(p) => <Input {...p} required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} autoComplete="name" />}</Field>
                <Field label={t("email")}>{(p) => <Input {...p} type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} autoComplete="email" />}</Field>
              </>
            )}
            <Field label={t("subject")}>{(p) => <Input {...p} required minLength={2} value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} />}</Field>
            <Field label={t("message")}>{(p) => <Textarea {...p} required rows={3} value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} />}</Field>
            <Button type="submit" block loading={pending}>
              {t("start")}
            </Button>
          </form>
        )
      ) : (
        <>
          <div ref={listRef} className="flex-1 space-y-2 overflow-y-auto bg-surface/50 p-4" aria-live="polite">
            {messages.map((m) =>
              m.sender === "SYSTEM" ? (
                <p key={m.id} className="mx-auto max-w-[85%] py-1 text-center text-xs text-muted">
                  {m.body}
                </p>
              ) : (
                <div key={m.id} className={cn("flex", m.sender === "CUSTOMER" ? "justify-end" : "justify-start")}>
                  <div className={cn("max-w-[80%] rounded-2xl px-3.5 py-2 text-[14.5px] leading-relaxed whitespace-pre-wrap break-words", m.sender === "CUSTOMER" ? "rounded-ee-md bg-primary text-primary-fg" : "rounded-es-md bg-bg ring-1 ring-border")}>
                    {m.body}
                    <span className={cn("mt-0.5 block text-[10px]", m.sender === "CUSTOMER" ? "text-primary-fg/60" : "text-muted")}>
                      {new Date(m.createdAt).toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>
                </div>
              ),
            )}
            {typing && (
              <div className="flex items-center gap-1 ps-2 text-xs text-muted">
                <span className="flex gap-0.5">
                  {[0, 1, 2].map((i) => (
                    <span key={i} className="size-1.5 animate-bounce rounded-full bg-muted" style={{ animationDelay: `${i * 120}ms` }} />
                  ))}
                </span>
                {t("typing")}
              </div>
            )}
          </div>
          {isOpenConv ? (
            <div className="border-t border-border bg-bg p-3">
              <div className="flex items-end gap-2">
                <textarea
                  value={text}
                  onChange={(e) => onType(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      send();
                    }
                  }}
                  rows={1}
                  maxLength={2000}
                  placeholder={t("placeholder")}
                  aria-label={t("placeholder")}
                  className="max-h-32 min-h-11 flex-1 resize-none rounded-2xl border border-border bg-surface/60 px-3.5 py-2.5 text-[15px] outline-none focus:border-accent"
                />
                <button type="button" onClick={send} disabled={!text.trim()} className="grid size-11 shrink-0 place-items-center rounded-full bg-primary text-primary-fg transition disabled:opacity-40" aria-label={t("send")}>
                  <ArrowUp className="size-5" />
                </button>
              </div>
              <button
                type="button"
                className="mt-2 text-xs text-muted hover:text-red-600"
                onClick={() => {
                  if (window.confirm(t("endConfirm"))) start(async () => (await endChatAction(conversationId!), setStatus("CLOSED_BY_CUSTOMER")));
                }}
              >
                {t("end")}
              </button>
            </div>
          ) : (
            <div className="space-y-3 border-t border-border bg-bg p-4 text-center">
              <p className="text-sm font-medium">{t("ended")}</p>
              {!rated ? (
                <div>
                  <p className="mb-2 text-xs text-muted">{t("rate")}</p>
                  <div className="flex justify-center gap-1">
                    {[1, 2, 3, 4, 5].map((r) => (
                      <button key={r} type="button" aria-label={`${r}`} onClick={() => start(async () => (await endChatAction(conversationId!, r), setRated(true)))} className="text-border transition hover:scale-110 hover:text-amber-400">
                        <Star className="size-7 fill-current" />
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <p className="text-xs text-muted">{t("thanksRating")}</p>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setMessages([]);
                  setStatus(null);
                  setAgent(null);
                  setRated(false);
                  setState((s) => (s ? { ...s, conversation: null } : s));
                }}
              >
                {t("newChat")}
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

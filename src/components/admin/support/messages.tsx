"use client";

import { useEffect, useState, useTransition } from "react";
import { Archive, Inbox, Mail, MailOpen, Phone, Reply, ShieldAlert, AlertTriangle, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { Link, useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { useAdmin } from "../admin-context";
import { PageHeader, Panel, FilterTabs, SearchBox, Pager, Pill, BulkBar, AdminEmpty } from "../ui";
import { Label, TextInput, TextArea } from "../fields";
import { setContactStatusAction, replyContactAction } from "@/actions/admin/support";
import { timeAgo, fmtDate } from "@/lib/time";
import { cn } from "@/lib/utils";
import type { contactList, ContactDetail } from "@/server/admin/support";

type List = Awaited<ReturnType<typeof contactList>>;
type Status = "NEW" | "READ" | "REPLIED" | "ARCHIVED" | "SPAM";
const TONE = { NEW: "blue", READ: "neutral", REPLIED: "green", ARCHIVED: "neutral", SPAM: "red" } as const;

function useStatusLabel() {
  const { locale } = useAdmin();
  const ar = locale === "ar";
  return (s: string) => ({ NEW: ar ? "جديدة" : "New", READ: ar ? "مقروءة" : "Read", REPLIED: ar ? "تم الرد" : "Replied", ARCHIVED: ar ? "مؤرشفة" : "Archived", SPAM: ar ? "مزعجة" : "Spam" })[s] ?? s;
}

export function MessagesList({ data }: { data: List }) {
  const { t, locale, socket } = useAdmin();
  const router = useRouter();
  const label = useStatusLabel();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [pending, start] = useTransition();

  useEffect(() => {
    if (!socket) return;
    const on = (p: { keys: string[] }) => p.keys.includes("messages") && router.refresh();
    socket.on("counters:invalidate", on);
    return () => void socket.off("counters:invalidate", on);
  }, [socket, router]);

  const bulk = (status: Status) =>
    start(async () => {
      const r = await setContactStatusAction([...selected], status);
      if (r.ok) {
        setSelected(new Set());
        router.refresh();
      }
    });

  const inboxCount = (data.counts.NEW ?? 0) + (data.counts.READ ?? 0) + (data.counts.REPLIED ?? 0);
  return (
    <>
      <PageHeader title={t("nav.messages")} description={locale === "ar" ? "رسائل نموذج «تواصل معنا» — الرد يُرسل بالبريد من إعدادات SMTP" : "Contact form submissions — replies are emailed through your SMTP settings"} />
      <div className="mb-4">
        <FilterTabs
          param="status"
          options={[
            { value: "", label: locale === "ar" ? "الوارد" : "Inbox", count: inboxCount },
            { value: "NEW", label: label("NEW"), count: data.counts.NEW ?? 0 },
            { value: "REPLIED", label: label("REPLIED"), count: data.counts.REPLIED ?? 0 },
            { value: "ARCHIVED", label: label("ARCHIVED"), count: data.counts.ARCHIVED ?? 0 },
            { value: "SPAM", label: label("SPAM"), count: data.counts.SPAM ?? 0 },
          ]}
        />
      </div>
      <Panel padded={false}>
        <div className="border-b border-ad-border p-3">
          <SearchBox />
        </div>
        {data.rows.length ? (
          <ul className="divide-y divide-ad-border">
            {data.rows.map((m) => (
              <li key={m.id} className={cn("flex items-start gap-3 px-4 py-3.5 transition hover:bg-ad-hover/60", selected.has(m.id) && "bg-ad-accent/5")}>
                <input
                  type="checkbox"
                  aria-label="Select"
                  checked={selected.has(m.id)}
                  onChange={() =>
                    setSelected((s) => {
                      const n = new Set(s);
                      if (n.has(m.id)) n.delete(m.id);
                      else n.add(m.id);
                      return n;
                    })
                  }
                  className="mt-1 size-4 shrink-0 accent-[var(--ad-accent)]"
                />
                <Link href={`/admin/messages/${m.id}`} className="flex min-w-0 flex-1 gap-3">
                  <span className={cn("mt-0.5 grid size-8 shrink-0 place-items-center rounded-full", m.status === "NEW" ? "bg-ad-accent/10 text-ad-accent" : "bg-ad-sunken text-ad-muted")}>{m.status === "NEW" ? <Mail className="size-4" /> : <MailOpen className="size-4" />}</span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                      <span className={cn("truncate text-sm", m.status === "NEW" ? "font-semibold" : "font-medium")}>{m.name}</span>
                      {m.status !== "NEW" && m.status !== "READ" && <Pill tone={TONE[m.status]}>{label(m.status)}</Pill>}
                      <span className="ms-auto shrink-0 text-xs text-ad-muted">{timeAgo(m.createdAt, locale)}</span>
                    </span>
                    {m.subject && <span className={cn("block truncate text-[13px]", m.status === "NEW" && "font-medium")}>{m.subject}</span>}
                    <span className="block truncate text-xs text-ad-muted" dir="auto">
                      {m.preview}
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <AdminEmpty icon={<Inbox />} />
        )}
        <Pager page={data.page} pageCount={data.pageCount} total={data.total} />
      </Panel>
      <BulkBar count={selected.size} onClear={() => setSelected(new Set())}>
        <Button size="xs" variant="outline" loading={pending} leftIcon={<MailOpen />} onClick={() => bulk("READ")}>
          {label("READ")}
        </Button>
        <Button size="xs" variant="outline" loading={pending} leftIcon={<Archive />} onClick={() => bulk("ARCHIVED")}>
          {locale === "ar" ? "أرشفة" : "Archive"}
        </Button>
        <Button size="xs" variant="outline" loading={pending} leftIcon={<ShieldAlert />} onClick={() => bulk("SPAM")}>
          {label("SPAM")}
        </Button>
      </BulkBar>
    </>
  );
}

export function MessageView({ m, storeName }: { m: ContactDetail; storeName: string }) {
  const { t, locale, refreshCounters } = useAdmin();
  const router = useRouter();
  const label = useStatusLabel();
  const [subject, setSubject] = useState(`Re: ${m.subject || storeName}`);
  const [body, setBody] = useState("");
  const [pending, start] = useTransition();
  const ar = locale === "ar";
  useEffect(() => refreshCounters(), [refreshCounters]);

  const setStatus = (s: Status) =>
    start(async () => {
      const r = await setContactStatusAction([m.id], s);
      if (r.ok) {
        toast.success(t("c.saved"));
        router.refresh();
      }
    });

  const mailError = (code: string) =>
    code === "mail_not_configured"
      ? ar
        ? "البريد غير مُعد. أكمل إعدادات SMTP أولاً."
        : "Email isn't configured yet. Set up SMTP in Settings → Email."
      : code.startsWith("mail_")
        ? ar
          ? "تعذّر إرسال البريد. راجع سجلات البريد."
          : "The email couldn't be sent. Check the email logs."
        : t("c.error");

  return (
    <>
      <PageHeader
        back={{ href: "/admin/messages", label: t("nav.messages") }}
        title={m.subject || (ar ? "بدون موضوع" : "No subject")}
        description={`${fmtDate(m.createdAt, locale, true)}`}
        actions={
          <>
            <Pill tone={TONE[m.status as Status]}>{label(m.status)}</Pill>
            {m.status !== "ARCHIVED" && (
              <Button size="sm" variant="outline" leftIcon={<Archive />} loading={pending} onClick={() => setStatus("ARCHIVED")}>
                {ar ? "أرشفة" : "Archive"}
              </Button>
            )}
            {m.status !== "SPAM" && (
              <Button size="sm" variant="ghost" leftIcon={<ShieldAlert />} onClick={() => setStatus("SPAM")}>
                {label("SPAM")}
              </Button>
            )}
            {(m.status === "ARCHIVED" || m.status === "SPAM") && (
              <Button size="sm" variant="ghost" leftIcon={<Inbox />} onClick={() => setStatus("READ")}>
                {ar ? "إعادة للوارد" : "Move to inbox"}
              </Button>
            )}
          </>
        }
      />
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-4">
          <Panel>
            <p className="whitespace-pre-wrap text-[15px] leading-relaxed" dir="auto">
              {m.message}
            </p>
          </Panel>
          {m.replies.map((r, i) => (
            <Panel key={i} className="border-s-4 border-s-ad-accent/50">
              <p className="mb-2 flex items-center gap-2 text-xs text-ad-muted">
                {r.ok ? <CheckCircle2 className="size-3.5 text-emerald-600" /> : <AlertTriangle className="size-3.5 text-red-600" />}
                {r.by} · {fmtDate(r.at, locale, true)} {!r.ok && `· ${ar ? "لم يُرسل" : "not sent"}`}
              </p>
              <p className="whitespace-pre-wrap text-sm leading-relaxed" dir="auto">
                {r.body}
              </p>
            </Panel>
          ))}
          {m.pii ? (
            <Panel title={ar ? "الرد بالبريد" : "Reply by email"}>
              <form
                className="space-y-3"
                onSubmit={(e) => {
                  e.preventDefault();
                  start(async () => {
                    const r = await replyContactAction(m.id, { subject, body });
                    if (r.ok) {
                      toast.success(ar ? "تم إرسال الرد" : "Reply sent");
                      setBody("");
                      router.refresh();
                    } else {
                      toast.error(mailError(r.error));
                      router.refresh();
                    }
                  });
                }}
              >
                <div>
                  <Label>{ar ? "الموضوع" : "Subject"}</Label>
                  <TextInput value={subject} onChange={(e) => setSubject(e.target.value)} maxLength={200} />
                </div>
                <div>
                  <Label>{ar ? "الرسالة" : "Message"}</Label>
                  <TextArea rows={7} value={body} onChange={(e) => setBody(e.target.value)} maxLength={10_000} dir="auto" />
                </div>
                <Button type="submit" loading={pending} disabled={!body.trim() || !subject.trim()} leftIcon={<Reply />}>
                  {ar ? "إرسال الرد" : "Send reply"}
                </Button>
              </form>
            </Panel>
          ) : (
            <p className="text-sm text-ad-muted">{t("cu.piiHidden")}</p>
          )}
        </div>
        <Panel title={ar ? "المرسل" : "From"}>
          <div className="space-y-2 text-sm">
            <p className="font-medium">{m.name}</p>
            {m.pii ? (
              <a href={`mailto:${m.email}`} className="flex items-center gap-2 hover:underline" dir="ltr">
                <Mail className="size-4 text-ad-muted" /> {m.email}
              </a>
            ) : (
              <p className="flex items-center gap-2 text-ad-muted" dir="ltr">
                <Mail className="size-4" /> {m.email}
              </p>
            )}
            {m.phone && (
              <a href={`tel:${m.phone}`} className="flex items-center gap-2 hover:underline" dir="ltr">
                <Phone className="size-4 text-ad-muted" /> {m.phone}
              </a>
            )}
            {m.orderNumber && (
              <p className="text-xs text-ad-muted">
                {ar ? "رقم الطلب" : "Order"}: <b className="text-ad-fg">{m.orderNumber}</b>
              </p>
            )}
            {m.customer && (
              <Link href={`/admin/customers/${m.customer.id}`} className="inline-block text-xs text-ad-accent hover:underline">
                {ar ? "عرض ملف العميل" : "View customer profile"}
              </Link>
            )}
          </div>
        </Panel>
      </div>
    </>
  );
}

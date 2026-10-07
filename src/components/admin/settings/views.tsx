"use client";

import { useMemo, useState, useTransition } from "react";
import { CheckCircle2, ChevronRight, Mail, Search, Send, XCircle, Plug, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Link, useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { useAdmin } from "../admin-context";
import { PageHeader, Panel, Pill, AdminEmpty } from "../ui";
import { TextInput } from "../fields";
import { SettingsForm } from "./form";
import { SETTINGS_DEFS } from "./definitions";
import { SETTINGS_INDEX } from "@/admin/settings-index";
import { testSmtpAction, testImapAction, sendTestEmailAction } from "@/actions/admin/settings";
import { timeAgo } from "@/lib/time";
import { cn } from "@/lib/utils";
import { TimeAgo } from "@/components/ui/time-ago";

export function SettingsIndex() {
  const { t, can, locale } = useAdmin();
  const [q, setQ] = useState("");
  const entries = useMemo(() => {
    const visible = SETTINGS_INDEX.filter((e) => can(e.permission));
    const needle = q.trim().toLowerCase();
    if (!needle) return visible.filter((e) => e.section === "nav.settings" && e.title !== "s.otpTitle");
    return visible.filter((e) => [t(e.title), ...e.keywords].some((k) => k.toLowerCase().includes(needle)));
  }, [q, can, t]);

  return (
    <>
      <PageHeader title={t("s.title")} />
      <div className="relative mb-5 max-w-xl">
        <Search className="pointer-events-none absolute start-3.5 top-1/2 size-4 -translate-y-1/2 text-ad-muted" />
        <TextInput autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("s.search")} className="h-12 ps-10 text-[15px]" aria-label={t("s.search")} />
      </div>
      {entries.length ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {entries.map((e) => (
            <Link key={`${e.href}-${e.title}`} href={e.href} className="group flex items-center gap-3 rounded-2xl border border-ad-border bg-ad-panel p-4 transition hover:border-ad-fg/20 hover:shadow-sm">
              <div className="min-w-0 flex-1">
                <p className="font-medium">{t(e.title)}</p>
                <p className="mt-0.5 truncate text-xs text-ad-muted">{e.keywords.filter((k) => /[a-z]/i.test(k) === (locale !== "ar")).slice(0, 4).join(" · ") || e.keywords.slice(0, 4).join(" · ")}</p>
              </div>
              <ChevronRight className="size-4 text-ad-muted transition group-hover:translate-x-0.5 rtl:rotate-180 rtl:group-hover:-translate-x-0.5" />
            </Link>
          ))}
        </div>
      ) : (
        <AdminEmpty icon={<Search />} />
      )}
    </>
  );
}

export function GenericSettings({ slug, initial, secrets }: { slug: string; initial: Record<string, unknown>; secrets: Record<string, boolean> }) {
  const { t, locale } = useAdmin();
  const def = SETTINGS_DEFS[slug];
  if (!def) return <AdminEmpty />;
  return <SettingsForm group={def.group} title={t(def.title)} description={def.description?.[locale === "ar" ? 1 : 0]} initial={initial} secrets={secrets} sections={def.sections} />;
}

type Status = { ok: boolean; at: string; message: string; code?: string } | null;
type Log = { id: string; recipient: string; subject: string | null; status: string; error: string | null; createdAt: string; template: string | null };

export function EmailSettings({ initial, secrets, smtpStatus, imapStatus, logs, myEmail }: { initial: Record<string, unknown>; secrets: Record<string, boolean>; smtpStatus: Status; imapStatus: Status; logs: Log[]; myEmail: string }) {
  const { t, locale } = useAdmin();
  const router = useRouter();
  const [to, setTo] = useState(myEmail);
  const [pending, start] = useTransition();
  const def = SETTINGS_DEFS.email;
  const errLabel = (code?: string) => (code ? t(`s.mailErr.${code}` as "s.mailErr.unknown") : t("s.failed"));

  const StatusLine = ({ s }: { s: Status }) =>
    s ? (
      <p className={cn("flex items-start gap-2 text-[13px]", s.ok ? "text-emerald-700 dark:text-emerald-400" : "text-red-700 dark:text-red-400")}>
        {s.ok ? <CheckCircle2 className="mt-0.5 size-4 shrink-0" /> : <XCircle className="mt-0.5 size-4 shrink-0" />}
        <span>
          {s.ok ? t("s.connected") : `${errLabel(s.code)} — ${s.message}`}
          <span className="block text-xs text-ad-muted"><TimeAgo date={s.at} /></span>
        </span>
      </p>
    ) : (
      <p className="text-[13px] text-ad-muted">{locale === "ar" ? "لم يُختبر بعد" : "Not tested yet"}</p>
    );

  const tools = (
    <Panel title={locale === "ar" ? "اختبار الاتصال" : "Connection tests"} description={locale === "ar" ? "احفظ التغييرات أولاً ثم اختبر." : "Save your changes first, then test."}>
      <div className="grid gap-5 md:grid-cols-3">
        <div className="space-y-3">
          <p className="text-sm font-medium">SMTP</p>
          <StatusLine s={smtpStatus} />
          <Button size="sm" variant="outline" leftIcon={<Plug />} loading={pending} onClick={() => start(async () => void ((await testSmtpAction()).ok, router.refresh()))}>
            {t("s.testSmtp")}
          </Button>
        </div>
        <div className="space-y-3">
          <p className="text-sm font-medium">IMAP</p>
          <StatusLine s={imapStatus} />
          <Button size="sm" variant="outline" leftIcon={<RefreshCw />} loading={pending} disabled={!(initial.imap as { enabled?: boolean })?.enabled} onClick={() => start(async () => void ((await testImapAction()).ok, router.refresh()))}>
            {t("s.testImap")}
          </Button>
        </div>
        <div className="space-y-3">
          <p className="text-sm font-medium">{t("s.sendTestTo")}</p>
          <TextInput type="email" value={to} onChange={(e) => setTo(e.target.value)} dir="ltr" />
          <Button
            size="sm"
            leftIcon={<Send />}
            loading={pending}
            disabled={!to}
            onClick={() =>
              start(async () => {
                const r = await sendTestEmailAction(to, locale);
                if (r.ok && r.data.ok) toast.success(locale === "ar" ? "تم الإرسال" : "Sent");
                else toast.error(r.ok && !r.data.ok ? `${errLabel(r.data.code)} — ${r.data.message}` : t("c.error"));
                router.refresh();
              })
            }
          >
            {t("s.sendTest")}
          </Button>
        </div>
      </div>
    </Panel>
  );

  const log = (
    <Panel title={t("s.emailLogs")} padded={false} className="mt-4">
      {logs.length ? (
        <ul className="divide-y divide-ad-border">
          {logs.map((l) => (
            <li key={l.id} className="flex items-start gap-3 px-5 py-2.5 text-[13px]">
              <Mail className="mt-0.5 size-4 shrink-0 text-ad-muted" />
              <div className="min-w-0 flex-1">
                <p className="truncate">
                  <span className="font-medium" dir="ltr">
                    {l.recipient}
                  </span>
                  {l.subject && <span className="text-ad-muted"> · {l.subject}</span>}
                </p>
                {l.error && <p className="truncate text-xs text-red-600">{l.error}</p>}
              </div>
              <Pill tone={l.status === "SENT" ? "green" : l.status === "FAILED" ? "red" : "neutral"}>{l.status}</Pill>
              <span className="shrink-0 text-xs text-ad-muted"><TimeAgo date={l.createdAt} /></span>
            </li>
          ))}
        </ul>
      ) : (
        <AdminEmpty icon={<Mail />} />
      )}
    </Panel>
  );

  return (
    <SettingsForm
      group="email"
      title={t(def.title)}
      initial={initial}
      secrets={secrets}
      sections={def.sections}
      before={<div className="mb-4">{tools}</div>}
      after={
        <>
          {log}
          <p className="mt-4 text-sm">
            <Link href="/admin/settings/email/templates" className="text-ad-accent hover:underline">
              {t("s.templates")} →
            </Link>
          </p>
        </>
      }
    />
  );
}

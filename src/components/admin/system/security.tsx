"use client";

import { useState, useTransition } from "react";
import { ChevronDown, LogOut, ScrollText } from "lucide-react";
import { toast } from "sonner";
import { Link, useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { useAdmin } from "../admin-context";
import { PageHeader, Panel, Pill, FilterTabs, SearchBox, Pager, AdminEmpty } from "../ui";
import { revokeSessionAction } from "@/actions/admin/system";
import { fmtDate, timeAgo } from "@/lib/time";
import { cn } from "@/lib/utils";
import type { securityData, LogTab } from "@/server/admin/system";
import { TimeAgo } from "@/components/ui/time-ago";

type Data = Awaited<ReturnType<typeof securityData>>;
const TABS: LogTab[] = ["audit", "logins", "sessions", "system", "deliveries", "payments"];

/** Shorten a user agent to something readable ("Chrome · Windows"). */
function device(ua: string | null | undefined) {
  if (!ua) return "—";
  const browser = /Edg\//.test(ua) ? "Edge" : /Chrome\//.test(ua) ? "Chrome" : /Firefox\//.test(ua) ? "Firefox" : /Safari\//.test(ua) ? "Safari" : "Browser";
  const os = /Windows/.test(ua) ? "Windows" : /Android/.test(ua) ? "Android" : /iPhone|iPad/.test(ua) ? "iOS" : /Mac OS/.test(ua) ? "macOS" : /Linux/.test(ua) ? "Linux" : "";
  return [browser, os].filter(Boolean).join(" · ");
}

export function SecurityView({ data }: { data: Data }) {
  const { t, locale, can, fmt } = useAdmin();
  const router = useRouter();
  const ar = locale === "ar";
  const [open, setOpen] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const tabLabel: Record<LogTab, string> = { audit: t("sec.audit"), logins: t("sec.logins"), sessions: t("sec.sessions"), system: t("sec.system"), deliveries: t("sec.emails"), payments: t("sec.payments") };
  const filters: Partial<Record<LogTab, { value: string; label: string }[]>> = {
    logins: [{ value: "", label: t("c.all") }, { value: "failed", label: t("sec.failed") }, { value: "admin", label: ar ? "لوحة التحكم" : "Admin only" }],
    system: [{ value: "", label: t("c.all") }, { value: "error", label: "Error" }, { value: "warn", label: "Warning" }, { value: "info", label: "Info" }],
    deliveries: [{ value: "", label: t("c.all") }, { value: "SENT", label: "Sent" }, { value: "FAILED", label: "Failed" }, { value: "SKIPPED", label: "Skipped" }],
    payments: [{ value: "", label: t("c.all") }, { value: "CAPTURED", label: "Captured" }, { value: "FAILED", label: "Failed" }, { value: "PENDING", label: "Pending" }],
  };
  const rows = data.rows as Record<string, unknown>[];

  const row = (r: Record<string, unknown>): React.ReactNode => {
    const at = <span className="shrink-0 text-xs text-ad-muted" title={fmtDate(String(r.at ?? r.lastSeenAt), locale, true)}><TimeAgo date={String(r.at ?? r.lastSeenAt)} /></span>;
    switch (data.tab) {
      case "audit":
        return (
          <div>
            <button type="button" onClick={() => setOpen(open === r.id ? null : String(r.id))} className="flex w-full items-start gap-3 text-start">
              <div className="min-w-0 flex-1">
                <p className="text-[13px]">
                  <span className="font-medium">{String(r.actor)}</span> <code className="rounded bg-ad-sunken px-1.5 py-0.5 text-[11px]">{String(r.action)}</code>
                </p>
                {Boolean(r.summary) && <p className="mt-0.5 truncate text-xs text-ad-muted">{String(r.summary)}</p>}
              </div>
              {at}
              <ChevronDown className={cn("size-4 shrink-0 text-ad-muted transition", open === r.id && "rotate-180")} />
            </button>
            {open === r.id && (
              <pre className="mt-2 max-h-72 overflow-auto rounded-lg bg-ad-sunken p-3 text-[11px] leading-relaxed" dir="ltr">
                {JSON.stringify({ entity: r.entity, ip: r.ip, changes: r.changes }, null, 2)}
              </pre>
            )}
          </div>
        );
      case "logins":
        return (
          <div className="flex items-center gap-3 text-[13px]">
            <Pill tone={r.success ? "green" : "red"}>{r.success ? t("sec.success") : t("sec.failed")}</Pill>
            <div className="min-w-0 flex-1">
              <p className="truncate" dir="ltr">
                {String(r.email)} <span className="text-xs text-ad-muted">· {String(r.scope)}</span>
              </p>
              <p className="truncate text-xs text-ad-muted">
                {[r.reason, r.ip, device(r.device as string)].filter(Boolean).join(" · ")}
              </p>
            </div>
            {at}
          </div>
        );
      case "sessions":
        return (
          <div className="flex items-center gap-3 text-[13px]">
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium">
                {String(r.user)} {Boolean(r.current) && <Pill tone="green">{t("sec.current")}</Pill>}
              </p>
              <p className="truncate text-xs text-ad-muted">
                {device(r.device as string)} · {String(r.ip ?? "—")} · {ar ? "منذ" : "since"} {fmtDate(String(r.createdAt), locale)}
              </p>
            </div>
            {at}
            {can("staff.manage") && !r.current && (
              <Button
                size="xs"
                variant="outline"
                leftIcon={<LogOut />}
                loading={pending}
                onClick={() =>
                  start(async () => {
                    const res = await revokeSessionAction(String(r.id));
                    if (res.ok) {
                      toast.success(t("c.saved"));
                      router.refresh();
                    }
                  })
                }
              >
                {t("sec.revoke")}
              </Button>
            )}
          </div>
        );
      case "system":
        return (
          <div>
            <button type="button" onClick={() => setOpen(open === r.id ? null : String(r.id))} className="flex w-full items-start gap-3 text-start text-[13px]">
              <Pill tone={r.level === "error" ? "red" : r.level === "warn" ? "amber" : "neutral"}>{String(r.level)}</Pill>
              <span className="min-w-0 flex-1">
                <code className="text-[11px] text-ad-muted">{String(r.source)}</code> <span className="break-words">{String(r.message)}</span>
              </span>
              {at}
            </button>
            {open === r.id && (
              <pre className="mt-2 max-h-72 overflow-auto rounded-lg bg-ad-sunken p-3 text-[11px]" dir="ltr">
                {JSON.stringify(r.context, null, 2)}
              </pre>
            )}
          </div>
        );
      case "deliveries":
        return (
          <div className="flex items-start gap-3 text-[13px]">
            <Pill tone={r.status === "SENT" ? "green" : r.status === "FAILED" ? "red" : "neutral"}>{String(r.status)}</Pill>
            <div className="min-w-0 flex-1">
              <p className="truncate">
                <span className="text-xs text-ad-muted">{String(r.channel)} · </span>
                <span dir="ltr">{String(r.recipient)}</span>
                {Boolean(r.subject) && <span className="text-ad-muted"> · {String(r.subject)}</span>}
              </p>
              {Boolean(r.error) && <p className="truncate text-xs text-red-600">{String(r.error)}</p>}
            </div>
            {at}
          </div>
        );
      case "payments": {
        const order = r.order as { id: string; number: string } | null;
        return (
          <div className="flex items-center gap-3 text-[13px]">
            <Pill tone={r.status === "CAPTURED" || r.status === "AUTHORIZED" ? "green" : r.status === "FAILED" ? "red" : "amber"}>{String(r.status)}</Pill>
            <div className="min-w-0 flex-1">
              <p className="truncate">
                {order ? (
                  <Link href={`/admin/orders/${order.id}`} className="font-medium hover:underline">
                    {order.number}
                  </Link>
                ) : (
                  "—"
                )}{" "}
                · {String(r.provider)} <span className="text-xs text-ad-muted">({String(r.mode)})</span>
              </p>
              {Boolean(r.error) && <p className="truncate text-xs text-red-600">{String(r.error)}</p>}
            </div>
            <span className="tabular">{fmt(Number(r.amount))}</span>
            {at}
          </div>
        );
      }
    }
  };

  return (
    <>
      <PageHeader title={t("sec.title")} />
      {/* Switching log type starts a fresh query (filters differ per log). */}
      <div className="no-scrollbar -mx-3 mb-3 flex gap-1 overflow-x-auto px-3 sm:mx-0 sm:px-0">
        {TABS.map((x) => (
          <Link
            key={x}
            href={x === "audit" ? "/admin/security" : `/admin/security?tab=${x}`}
            className={cn("shrink-0 rounded-lg px-3 py-1.5 text-[13px] font-medium transition", data.tab === x ? "bg-ad-fg text-ad-panel" : "text-ad-muted hover:bg-ad-hover hover:text-ad-fg")}
          >
            {tabLabel[x]}
          </Link>
        ))}
      </div>
      {filters[data.tab] && (
        <div className="mb-3">
          <FilterTabs param="filter" options={filters[data.tab]!} />
        </div>
      )}
      <Panel padded={false}>
        {data.tab !== "sessions" && (
          <div className="border-b border-ad-border p-3">
            <SearchBox />
          </div>
        )}
        {rows.length ? (
          <ul className="divide-y divide-ad-border">
            {rows.map((r) => (
              <li key={String(r.id)} className="px-4 py-3">
                {row(r)}
              </li>
            ))}
          </ul>
        ) : (
          <AdminEmpty icon={<ScrollText />} />
        )}
        {data.tab !== "sessions" && <Pager page={data.page} pageCount={data.pageCount} total={data.total} />}
      </Panel>
    </>
  );
}

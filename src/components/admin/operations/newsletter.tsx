"use client";

import { useTransition } from "react";
import { Download, Mail, UserMinus } from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { useAdmin } from "../admin-context";
import { PageHeader, Panel, DataTable, FilterTabs, SearchBox, Pager, Pill, AdminEmpty } from "../ui";
import { unsubscribeAction } from "@/actions/admin/operations";
import { fmtDate } from "@/lib/time";
import type { subscriberList } from "@/server/admin/operations";

type Data = Awaited<ReturnType<typeof subscriberList>>;

export function NewsletterView({ data }: { data: Data }) {
  const { t, locale } = useAdmin();
  const router = useRouter();
  const [pending, start] = useTransition();
  const ar = locale === "ar";
  const statusLabel = (s: string) => (s === "subscribed" ? t("cu.subscribed") : ar ? "ألغى الاشتراك" : "Unsubscribed");

  return (
    <>
      <PageHeader
        title={t("nl.title")}
        description={ar ? "المشتركون عبر نموذج التذييل والدفع والحساب" : "People who opted in via the footer, checkout or their account"}
        actions={
          <Button variant="outline" leftIcon={<Download />} onClick={() => (window.location.href = "/api/admin/newsletter/export")}>
            {t("c.export")}
          </Button>
        }
      />
      <div className="mb-4">
        <FilterTabs
          param="status"
          options={[
            { value: "", label: t("c.all"), count: Object.values(data.counts).reduce((a, b) => a + b, 0) },
            { value: "subscribed", label: statusLabel("subscribed"), count: data.counts.subscribed ?? 0 },
            { value: "unsubscribed", label: statusLabel("unsubscribed"), count: data.counts.unsubscribed ?? 0 },
          ]}
        />
      </div>
      <Panel padded={false}>
        <div className="border-b border-ad-border p-3">
          <SearchBox placeholder={ar ? "البريد الإلكتروني…" : "Email…"} />
        </div>
        <DataTable
          rows={data.rows}
          empty={<AdminEmpty icon={<Mail />} />}
          columns={[
            { key: "e", header: t("c.email"), cell: (r) => <span dir="ltr" className="font-medium">{r.email}</span> },
            { key: "s", header: t("nl.source"), cell: (r) => <span className="text-ad-muted">{r.source ?? "—"}</span> },
            { key: "l", header: ar ? "اللغة" : "Language", cell: (r) => <span className="text-ad-muted uppercase">{r.locale}</span> },
            { key: "d", header: ar ? "تاريخ الاشتراك" : "Joined", cell: (r) => <span className="text-ad-muted">{fmtDate(r.createdAt, locale)}</span> },
            { key: "st", header: t("c.status"), cell: (r) => <Pill tone={r.status === "subscribed" ? "green" : "neutral"}>{statusLabel(r.status)}</Pill> },
            {
              key: "a",
              header: "",
              align: "end",
              cell: (r) =>
                r.status === "subscribed" && (
                  <Button
                    size="xs"
                    variant="ghost"
                    leftIcon={<UserMinus />}
                    loading={pending}
                    onClick={() =>
                      window.confirm(ar ? "إلغاء اشتراك هذا البريد؟" : "Unsubscribe this email?") &&
                      start(async () => {
                        const res = await unsubscribeAction(r.id);
                        if (res.ok) {
                          toast.success(t("c.saved"));
                          router.refresh();
                        }
                      })
                    }
                  >
                    {ar ? "إلغاء" : "Unsubscribe"}
                  </Button>
                ),
            },
          ]}
          mobile={(r) => (
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate font-medium" dir="ltr">
                  {r.email}
                </p>
                <p className="text-xs text-ad-muted">{fmtDate(r.createdAt, locale)}</p>
              </div>
              <Pill tone={r.status === "subscribed" ? "green" : "neutral"}>{statusLabel(r.status)}</Pill>
            </div>
          )}
        />
        <Pager page={data.page} pageCount={data.pageCount} total={data.total} />
      </Panel>
    </>
  );
}

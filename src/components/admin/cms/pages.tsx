"use client";

import { useState, useTransition } from "react";
import { Copy, ExternalLink, FileText, Home, Lock, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Link, useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { useAdmin } from "../admin-context";
import { PageHeader, Panel, DataTable, Pill, ConfirmDialog, AdminEmpty } from "../ui";
import { deletePageAction, duplicatePageAction } from "@/actions/admin/content";
import { timeAgo } from "@/lib/time";
import type { pageList } from "@/server/admin/content";
import { TimeAgo } from "@/components/ui/time-ago";

type Row = Awaited<ReturnType<typeof pageList>>[number];
const STATUS_TONE = { PUBLISHED: "green", DRAFT: "amber" } as const;

export function PagesList({ rows }: { rows: Row[] }) {
  const { t, locale } = useAdmin();
  const router = useRouter();
  const [confirm, setConfirm] = useState<Row | null>(null);
  const [pending, start] = useTransition();
  const statusLabel = (s: string) => t(s === "PUBLISHED" ? "c.published" : "c.draft");
  const publicPath = (slug: string) => `/${locale}${slug === "home" ? "" : `/${slug}`}`;

  return (
    <>
      <PageHeader
        title={t("cms.pages")}
        description={locale === "ar" ? "صفحات مبنية من أقسام قابلة لإعادة الترتيب" : "Pages built from reorderable sections"}
        actions={
          <Button asChild>
            <Link href="/admin/pages/new">
              <Plus /> {t("cms.newPage")}
            </Link>
          </Button>
        }
      />
      <Panel padded={false}>
        <DataTable
          rows={rows}
          href={(r) => `/admin/pages/${r.slug}`}
          empty={<AdminEmpty icon={<FileText />} />}
          columns={[
            {
              key: "t",
              header: t("c.title"),
              cell: (r) => (
                <div className="flex items-center gap-3">
                  <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-ad-sunken text-ad-muted">{r.slug === "home" ? <Home className="size-4" /> : <FileText className="size-4" />}</span>
                  <div className="min-w-0">
                    <p className="flex items-center gap-1.5 truncate font-medium">
                      {r.title}
                      {r.isSystem && <Lock className="size-3 text-ad-muted" aria-label={t("cms.system")} />}
                    </p>
                    <p className="truncate text-xs text-ad-muted" dir="ltr">
                      /{r.slug === "home" ? "" : r.slug}
                    </p>
                  </div>
                </div>
              ),
            },
            { key: "tp", header: t("cms.template"), cell: (r) => <span className="text-ad-muted">{t(`cms.tpl.${r.template}` as "cms.tpl.standard")}</span> },
            { key: "s", header: t("cms.sections"), align: "center", cell: (r) => <span className="tabular text-ad-muted">{r.sections}</span> },
            { key: "u", header: locale === "ar" ? "آخر تعديل" : "Updated", cell: (r) => <span className="text-ad-muted"><TimeAgo date={r.updatedAt} /></span> },
            { key: "st", header: t("c.status"), cell: (r) => <Pill tone={STATUS_TONE[r.status]}>{statusLabel(r.status)}</Pill> },
            {
              key: "a",
              header: "",
              align: "end",
              cell: (r) => (
                <div className="flex justify-end gap-1">
                  <Button asChild size="icon-sm" variant="ghost" aria-label={t("c.view")}>
                    <a href={`${publicPath(r.slug)}${r.status !== "PUBLISHED" ? "?preview=1" : ""}`} target="_blank" rel="noopener">
                      <ExternalLink />
                    </a>
                  </Button>
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    aria-label={t("c.duplicate")}
                    disabled={pending}
                    onClick={() =>
                      start(async () => {
                        const res = await duplicatePageAction(r.id);
                        if (res.ok) {
                          toast.success(t("c.saved"));
                          router.push(`/admin/pages/${res.data.slug}`);
                        }
                      })
                    }
                  >
                    <Copy />
                  </Button>
                  {!r.isSystem && (
                    <Button size="icon-sm" variant="ghost" className="text-red-600" aria-label={t("c.delete")} onClick={() => setConfirm(r)}>
                      <Trash2 />
                    </Button>
                  )}
                </div>
              ),
            },
          ]}
          mobile={(r) => (
            <div className="flex items-center gap-3">
              <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-ad-sunken text-ad-muted">{r.slug === "home" ? <Home className="size-4" /> : <FileText className="size-4" />}</span>
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{r.title}</p>
                <p className="truncate text-xs text-ad-muted" dir="ltr">
                  /{r.slug === "home" ? "" : r.slug} · {r.sections}
                </p>
              </div>
              <Pill tone={STATUS_TONE[r.status]}>{statusLabel(r.status)}</Pill>
            </div>
          )}
        />
      </Panel>
      <ConfirmDialog
        open={Boolean(confirm)}
        onOpenChange={(o) => !o && setConfirm(null)}
        title={t("c.confirmDelete")}
        text={confirm?.title}
        confirmLabel={t("c.delete")}
        onConfirm={async () => {
          if (!confirm) return;
          const r = await deletePageAction(confirm.id);
          if (r.ok) {
            toast.success(t("c.deleted"));
            setConfirm(null);
            router.refresh();
          } else toast.error(t("c.error"));
        }}
      />
    </>
  );
}

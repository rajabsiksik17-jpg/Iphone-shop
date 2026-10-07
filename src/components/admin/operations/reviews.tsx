"use client";

import { useEffect, useState, useTransition } from "react";
import { Check, X, ShieldAlert, Trash2, MessageSquareReply, BadgeCheck, Flag, ExternalLink, Star } from "lucide-react";
import { toast } from "sonner";
import { Link, useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Stars } from "@/components/ui/rating";
import { useAdmin } from "../admin-context";
import { PageHeader, Panel, FilterTabs, SearchBox, Pager, Pill, BulkBar, AdminEmpty } from "../ui";
import { TextArea } from "../fields";
import { moderateReviewAction, bulkModerateAction } from "@/actions/admin/operations";
import { timeAgo } from "@/lib/time";
import { cn } from "@/lib/utils";
import type { reviewList } from "@/server/admin/operations";
import { TimeAgo } from "@/components/ui/time-ago";

type Data = Awaited<ReturnType<typeof reviewList>>;
const TONE = { PENDING: "amber", APPROVED: "green", REJECTED: "neutral", SPAM: "red" } as const;

export function ReviewsView({ data }: { data: Data }) {
  const { t, locale, socket } = useAdmin();
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [replying, setReplying] = useState<string | null>(null);
  const [reply, setReply] = useState("");
  const [pending, start] = useTransition();

  useEffect(() => {
    if (!socket) return;
    const on = (p: { keys: string[] }) => p.keys.includes("reviews") && router.refresh();
    socket.on("counters:invalidate", on);
    return () => void socket.off("counters:invalidate", on);
  }, [socket, router]);

  const act = (id: string, input: Parameters<typeof moderateReviewAction>[1]) =>
    start(async () => {
      const r = await moderateReviewAction(id, input);
      if (r.ok) {
        toast.success(t("c.saved"));
        setReplying(null);
        router.refresh();
      } else toast.error(t("c.error"));
    });

  return (
    <>
      <PageHeader title={t("rev.title")} description={locale === "ar" ? "يُحتسب التقييم في متوسط المنتج فقط بعد الاعتماد" : "Only approved reviews count towards product ratings"} />
      <div className="mb-4">
        <FilterTabs
          param="status"
          options={[
            { value: "", label: t("c.all"), count: Object.values(data.counts).reduce((a, b) => a + b, 0) },
            ...(["PENDING", "APPROVED", "REJECTED", "SPAM"] as const).map((s) => ({ value: s, label: t(`rev.status.${s}`), count: data.counts[s] ?? 0 })),
          ]}
        />
      </div>
      <Panel padded={false}>
        <div className="border-b border-ad-border p-3">
          <SearchBox />
        </div>
        {!data.rows.length ? (
          <AdminEmpty icon={<Star />} />
        ) : (
          <ul className="divide-y divide-ad-border">
            {data.rows.map((r) => (
              <li key={r.id} className={cn("flex gap-3 p-4 sm:p-5", selected.has(r.id) && "bg-ad-accent/5")}>
                <input type="checkbox" checked={selected.has(r.id)} onChange={() => setSelected((s) => { const n = new Set(s); if (n.has(r.id)) n.delete(r.id); else n.add(r.id); return n; })} className="mt-1 size-4 shrink-0 accent-[var(--ad-accent)]" aria-label="Select" />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Stars value={r.rating} size={14} />
                    {r.title && <span className="font-medium">{r.title}</span>}
                    <Pill tone={TONE[r.status as keyof typeof TONE]}>{t(`rev.status.${r.status}` as "rev.status.PENDING")}</Pill>
                    {r.verified && (
                      <Pill tone="green">
                        <BadgeCheck className="size-3" /> {t("rev.verified")}
                      </Pill>
                    )}
                    {r.reports > 0 && (
                      <Pill tone="red">
                        <Flag className="size-3" /> {t("rev.reports", { n: r.reports })}
                      </Pill>
                    )}
                  </div>
                  <p className="mt-2 text-sm leading-relaxed" dir="auto">
                    {r.body}
                  </p>
                  <p className="mt-2 flex flex-wrap items-center gap-x-2 text-xs text-ad-muted">
                    <span className="font-medium text-ad-fg/80">{r.author}</span>·<span><TimeAgo date={r.createdAt} /></span>·
                    <Link href={`/admin/products/${r.product.id}`} className="hover:underline">
                      {r.product.name}
                    </Link>
                    <a href={`/${locale}/product/${r.product.slug}#reviews`} target="_blank" rel="noopener" aria-label={t("c.view")}>
                      <ExternalLink className="size-3" />
                    </a>
                  </p>
                  {r.reply && replying !== r.id && (
                    <div className="mt-3 rounded-lg bg-ad-sunken p-3 text-[13px]">
                      <p className="mb-0.5 text-xs font-medium text-ad-muted">{t("rev.reply")}</p>
                      {r.reply}
                    </div>
                  )}
                  {replying === r.id && (
                    <div className="mt-3 space-y-2">
                      <TextArea rows={3} value={reply} onChange={(e) => setReply(e.target.value)} placeholder={t("rev.replyPlaceholder")} autoFocus />
                      <div className="flex gap-2">
                        <Button size="xs" loading={pending} onClick={() => act(r.id, { reply })}>
                          {t("c.save")}
                        </Button>
                        <Button size="xs" variant="ghost" onClick={() => setReplying(null)}>
                          {t("c.cancel")}
                        </Button>
                      </div>
                    </div>
                  )}
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {r.status !== "APPROVED" && (
                      <Button size="xs" leftIcon={<Check />} onClick={() => act(r.id, { status: "APPROVED" })}>
                        {t("rev.approve")}
                      </Button>
                    )}
                    {r.status !== "REJECTED" && (
                      <Button size="xs" variant="outline" leftIcon={<X />} onClick={() => act(r.id, { status: "REJECTED" })}>
                        {t("rev.reject")}
                      </Button>
                    )}
                    {r.status !== "SPAM" && (
                      <Button size="xs" variant="outline" leftIcon={<ShieldAlert />} onClick={() => act(r.id, { status: "SPAM" })}>
                        {t("rev.spam")}
                      </Button>
                    )}
                    <Button size="xs" variant="ghost" leftIcon={<MessageSquareReply />} onClick={() => (setReplying(r.id), setReply(r.reply ?? ""))}>
                      {t("rev.reply")}
                    </Button>
                    <Button size="xs" variant="ghost" className="text-red-600" leftIcon={<Trash2 />} onClick={() => window.confirm(t("c.confirmDelete")) && act(r.id, { delete: true })}>
                      {t("c.delete")}
                    </Button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
        <Pager page={data.page} pageCount={data.pageCount} total={data.total} />
      </Panel>
      <BulkBar count={selected.size} onClear={() => setSelected(new Set())}>
        {(["APPROVED", "REJECTED", "SPAM"] as const).map((s) => (
          <Button
            key={s}
            size="xs"
            variant={s === "APPROVED" ? "primary" : "outline"}
            loading={pending}
            onClick={() =>
              start(async () => {
                await bulkModerateAction([...selected], s);
                setSelected(new Set());
                router.refresh();
              })
            }
          >
            {t(s === "APPROVED" ? "rev.approve" : s === "REJECTED" ? "rev.reject" : "rev.spam")}
          </Button>
        ))}
      </BulkBar>
    </>
  );
}

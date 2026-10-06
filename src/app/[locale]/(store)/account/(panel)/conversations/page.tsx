import { getTranslations, setRequestLocale } from "next-intl/server";
import { MessagesSquare } from "lucide-react";
import { db } from "@/server/db";
import { customerOrRedirect } from "@/server/auth/page-guards";
import { EmptyState } from "@/components/ui/misc";
import { cn } from "@/lib/utils";
import type { Locale } from "@/i18n/config";

/** Customers see only their own conversations (scoped by customerId). */
export default async function ConversationsPage({ params }: { params: Promise<{ locale: string }> }) {
  const locale = (await params).locale as Locale;
  setRequestLocale(locale);
  const user = await customerOrRedirect();
  const t = await getTranslations();
  const convs = await db.conversation.findMany({ where: { customerId: user.id }, orderBy: { lastMessageAt: "desc" }, take: 50, include: { messages: { orderBy: { createdAt: "asc" } }, assignedAgent: { select: { name: true } } } });
  if (!convs.length) return <EmptyState icon={<MessagesSquare />} title={t("account.noConversations")} className="rounded-card border border-dashed border-border" />;
  return (
    <section className="space-y-4">
      <h2 className="text-xl font-semibold">{t("account.conversations")}</h2>
      {convs.map((c) => (
        <details key={c.id} className="group rounded-card border border-border">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 p-4">
            <div className="min-w-0">
              <p className="truncate font-medium">{c.subject}</p>
              <p className="text-xs text-muted">
                {c.createdAt.toLocaleString(locale === "ar" ? "ar-JO" : "en-GB", { dateStyle: "medium", timeStyle: "short" })}
                {c.assignedAgent ? ` · ${c.assignedAgent.name}` : ""}
              </p>
            </div>
            <span className={cn("rounded-full px-2.5 py-1 text-xs font-medium", c.status.startsWith("CLOSED") ? "bg-surface text-muted" : "bg-success/10 text-success")}>{c.status.startsWith("CLOSED") ? t("chat.ended") : t("chat.waiting")}</span>
          </summary>
          <div className="space-y-2 border-t border-border bg-surface/40 p-4">
            {c.messages.map((m) =>
              m.sender === "SYSTEM" ? (
                <p key={m.id} className="text-center text-xs text-muted">
                  {m.body}
                </p>
              ) : (
                <div key={m.id} className={cn("flex", m.sender === "CUSTOMER" ? "justify-end" : "justify-start")}>
                  <p className={cn("max-w-[80%] rounded-2xl px-3.5 py-2 text-sm whitespace-pre-wrap", m.sender === "CUSTOMER" ? "bg-primary text-primary-fg" : "bg-bg ring-1 ring-border")}>{m.body}</p>
                </div>
              ),
            )}
          </div>
        </details>
      ))}
    </section>
  );
}

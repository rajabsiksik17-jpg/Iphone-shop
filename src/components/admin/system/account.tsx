"use client";

import { useEffect, useState, useTransition } from "react";
import { AlertTriangle, Bell, CheckCheck, Info, LogOut, OctagonAlert } from "lucide-react";
import { toast } from "sonner";
import { Link, useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { useAdmin } from "../admin-context";
import { PageHeader, Panel, Pill, Segmented, AdminEmpty } from "../ui";
import { Label, TextInput, ImageField, FieldError, type MediaRef } from "../fields";
import { notificationsAction, markNotificationsAction } from "@/actions/admin/shell";
import { updateProfileAction, changePasswordAction, revokeOwnSessionAction } from "@/actions/admin/system";
import { t as tr } from "@/lib/i18n-text";
import { timeAgo } from "@/lib/time";
import { cn } from "@/lib/utils";
import type { profileData } from "@/server/admin/system";
import { TimeAgo } from "@/components/ui/time-ago";

type Notification = { id: string; event: string; title: Record<string, string>; body: Record<string, string>; link: string | null; severity: string; createdAt: string; read: boolean };

export function NotificationsView({ initial }: { initial: Notification[] }) {
  const { t, locale, socket, refreshCounters } = useAdmin();
  const [items, setItems] = useState(initial);
  const [filter, setFilter] = useState<"all" | "unread">("all");
  const [, start] = useTransition();

  useEffect(() => {
    if (!socket) return;
    const reload = async () => {
      const r = await notificationsAction({ take: 100 });
      if (r.ok) setItems(r.data);
    };
    socket.on("notification:new", reload);
    return () => void socket.off("notification:new", reload);
  }, [socket]);

  const markAll = () =>
    start(async () => {
      await markNotificationsAction("all");
      setItems((l) => l.map((n) => ({ ...n, read: true })));
      refreshCounters();
    });
  const markOne = (id: string) => {
    setItems((l) => l.map((n) => (n.id === id ? { ...n, read: true } : n)));
    void markNotificationsAction([id]).then(refreshCounters);
  };
  const visible = filter === "unread" ? items.filter((n) => !n.read) : items;
  const unread = items.filter((n) => !n.read).length;
  const icon = (s: string) => (s === "CRITICAL" || s === "ERROR" ? <OctagonAlert className="size-4 text-red-600" /> : s === "WARNING" ? <AlertTriangle className="size-4 text-amber-600" /> : <Info className="size-4 text-ad-accent" />);

  return (
    <>
      <PageHeader
        title={t("notif.title")}
        actions={
          <Button variant="outline" leftIcon={<CheckCheck />} disabled={!unread} onClick={markAll}>
            {t("notif.markAll")}
          </Button>
        }
      />
      <div className="mb-4">
        <Segmented value={filter} onChange={setFilter} options={[{ value: "all", label: t("c.all") }, { value: "unread", label: `${t("notif.unread")} · ${unread}` }]} />
      </div>
      <Panel padded={false}>
        {visible.length ? (
          <ul className="divide-y divide-ad-border">
            {visible.map((n) => {
              const content = (
                <>
                  <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-full bg-ad-sunken">{icon(n.severity)}</span>
                  <span className="min-w-0 flex-1">
                    <span className={cn("block text-sm", !n.read && "font-semibold")}>{tr(n.title, locale)}</span>
                    {tr(n.body, locale) && <span className="block text-[13px] text-ad-muted">{tr(n.body, locale)}</span>}
                    <span className="mt-0.5 block text-xs text-ad-muted"><TimeAgo date={n.createdAt} /></span>
                  </span>
                  {!n.read && <span className="mt-2 size-2 shrink-0 rounded-full bg-ad-accent" aria-label={t("notif.unread")} />}
                </>
              );
              return (
                <li key={n.id}>
                  {n.link ? (
                    <Link href={n.link} onClick={() => markOne(n.id)} className={cn("flex gap-3 px-4 py-3 transition hover:bg-ad-hover", !n.read && "bg-ad-accent/[0.03]")}>
                      {content}
                    </Link>
                  ) : (
                    <button type="button" onClick={() => markOne(n.id)} className={cn("flex w-full gap-3 px-4 py-3 text-start transition hover:bg-ad-hover", !n.read && "bg-ad-accent/[0.03]")}>
                      {content}
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        ) : (
          <AdminEmpty icon={<Bell />} title={t("notif.empty")} />
        )}
      </Panel>
    </>
  );
}

type Profile = Awaited<ReturnType<typeof profileData>>;

export function ProfileView({ p }: { p: Profile }) {
  const { t, locale } = useAdmin();
  const router = useRouter();
  const ar = locale === "ar";
  const [form, setForm] = useState({ name: p.name, phone: p.phone, locale: p.locale === "en" ? "en" : "ar", avatar: p.avatar as MediaRef });
  const [pw, setPw] = useState({ current: "", next: "", confirm: "" });
  const [pwErrors, setPwErrors] = useState<Record<string, string[]>>({});
  const [pending, start] = useTransition();

  const pwIssue = (code?: string) =>
    code
      ? ({
          wrong_password: ar ? "كلمة المرور الحالية غير صحيحة" : "Current password is incorrect",
          tooShort: ar ? `على الأقل ${p.passwordMinLength} أحرف` : `At least ${p.passwordMinLength} characters`,
          tooSimple: ar ? "استخدم مزيجاً من الأحرف والأرقام أو الرموز" : "Mix letters with numbers or symbols",
          tooLong: ar ? "طويلة جداً" : "Too long",
        }[code] ?? t("c.required"))
      : null;

  return (
    <>
      <PageHeader title={t("pf.title")} description={tr(p.role, locale)} />
      <div className="grid gap-4 xl:grid-cols-2">
        <Panel title={ar ? "البيانات الشخصية" : "Personal details"}>
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              start(async () => {
                const r = await updateProfileAction({ name: form.name, phone: form.phone || null, locale: form.locale, avatarId: form.avatar?.id ?? null });
                if (r.ok) {
                  toast.success(t("c.saved"));
                  // Switch the admin UI language if it changed.
                  if (form.locale !== locale) window.location.href = `/${form.locale}/admin/profile`;
                  else router.refresh();
                } else toast.error(t("c.fixErrors"));
              });
            }}
          >
            <div className="max-w-[10rem]">
              <ImageField label={t("pf.avatar")} value={form.avatar} onChange={(v) => setForm({ ...form, avatar: v })} folder="avatars" aspect="aspect-square" />
            </div>
            <div>
              <Label>{t("c.name")}</Label>
              <TextInput value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required minLength={2} />
            </div>
            <div>
              <Label hint={ar ? "لا يمكن تغييره من هنا" : "Ask an owner to change it"}>{t("c.email")}</Label>
              <TextInput value={p.email} readOnly disabled dir="ltr" />
            </div>
            <div>
              <Label optional>{ar ? "الهاتف" : "Phone"}</Label>
              <TextInput value={form.phone ?? ""} onChange={(e) => setForm({ ...form, phone: e.target.value })} dir="ltr" />
            </div>
            <div>
              <Label>{t("c.language")}</Label>
              <Segmented value={form.locale} onChange={(v) => setForm({ ...form, locale: v })} options={[{ value: "ar", label: "العربية" }, { value: "en", label: "English" }]} />
            </div>
            <Button type="submit" loading={pending}>
              {t("c.save")}
            </Button>
          </form>
        </Panel>

        <div className="space-y-4">
          <Panel title={t("pf.changePassword")} className={cn(p.mustChangePassword && "ring-2 ring-amber-400")}>
            <form
              id="password"
              className="scroll-mt-24 space-y-4"
              onSubmit={(e) => {
                e.preventDefault();
                if (pw.next !== pw.confirm) return setPwErrors({ confirm: ["mismatch"] });
                start(async () => {
                  const r = await changePasswordAction(pw.current, pw.next);
                  if (r.ok) {
                    toast.success(t("pf.passwordChanged"));
                    setPw({ current: "", next: "", confirm: "" });
                    setPwErrors({});
                    router.refresh();
                  } else setPwErrors(r.fieldErrors ?? {});
                });
              }}
            >
              <div>
                <Label>{t("pf.current")}</Label>
                <TextInput type="password" autoComplete="current-password" value={pw.current} onChange={(e) => setPw({ ...pw, current: e.target.value })} invalid={Boolean(pwErrors.current)} required />
                <FieldError message={pwIssue(pwErrors.current?.[0])} />
              </div>
              <div>
                <Label hint={ar ? `${p.passwordMinLength} أحرف على الأقل` : `At least ${p.passwordMinLength} characters`}>{t("pf.new")}</Label>
                <TextInput type="password" autoComplete="new-password" value={pw.next} onChange={(e) => setPw({ ...pw, next: e.target.value })} invalid={Boolean(pwErrors.next)} required />
                <FieldError message={pwIssue(pwErrors.next?.[0])} />
              </div>
              <div>
                <Label>{ar ? "تأكيد كلمة المرور" : "Confirm new password"}</Label>
                <TextInput type="password" autoComplete="new-password" value={pw.confirm} onChange={(e) => setPw({ ...pw, confirm: e.target.value })} invalid={Boolean(pwErrors.confirm)} required />
                <FieldError message={pwErrors.confirm ? (ar ? "كلمتا المرور غير متطابقتين" : "Passwords don't match") : null} />
              </div>
              <Button type="submit" loading={pending} disabled={!pw.current || !pw.next}>
                {t("pf.changePassword")}
              </Button>
            </form>
          </Panel>

          <Panel title={ar ? "أجهزتك المسجلة" : "Your signed-in devices"} padded={false}>
            <ul className="divide-y divide-ad-border">
              {p.sessions.map((s) => (
                <li key={s.id} className="flex items-center gap-3 px-5 py-3 text-[13px]">
                  <div className="min-w-0 flex-1">
                    <p className="truncate">
                      {s.scope === "ADMIN" ? (ar ? "لوحة التحكم" : "Admin") : ar ? "المتجر" : "Store"} · {s.ip ?? "—"} {s.current && <Pill tone="green">{t("sec.current")}</Pill>}
                    </p>
                    <p className="truncate text-xs text-ad-muted">{s.device ?? "—"}</p>
                  </div>
                  <span className="shrink-0 text-xs text-ad-muted"><TimeAgo date={s.lastSeenAt} /></span>
                  {!s.current && (
                    <Button
                      size="icon-sm"
                      variant="ghost"
                      aria-label={t("sec.revoke")}
                      onClick={() =>
                        start(async () => {
                          const r = await revokeOwnSessionAction(s.id);
                          if (r.ok) router.refresh();
                        })
                      }
                    >
                      <LogOut />
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          </Panel>
        </div>
      </div>
    </>
  );
}

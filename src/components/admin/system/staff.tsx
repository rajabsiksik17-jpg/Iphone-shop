"use client";

import { useState, useTransition } from "react";
import { Copy, KeyRound, Lock, Plus, ShieldCheck, Trash2, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/overlay";
import { useAdmin } from "../admin-context";
import { PageHeader, Panel, Pill, Segmented, DataTable, ConfirmDialog } from "../ui";
import { Label, TextInput, Select, LocalizedField, TextArea, FieldError } from "../fields";
import { EditSheet } from "../entity";
import { saveStaffAction, resetStaffPasswordAction, saveRoleAction, deleteRoleAction } from "@/actions/admin/system";
import { PERMISSIONS, PERMISSION_GROUPS, type Permission } from "@/config/permissions";
import { timeAgo } from "@/lib/time";
import { cn } from "@/lib/utils";
import type { StaffData } from "@/server/admin/system";
import { TimeAgo } from "@/components/ui/time-ago";

type User = StaffData["users"][number];
type Role = StaffData["roles"][number];

const PERMISSION_AR: Record<Permission, string> = {
  "dashboard.view": "عرض لوحة المعلومات",
  "analytics.view": "عرض التحليلات والتقارير",
  "catalog.view": "عرض الكتالوج",
  "catalog.edit": "إنشاء وتعديل المنتجات والتصنيفات والعلامات والخصائص",
  "catalog.delete": "حذف عناصر الكتالوج",
  "inventory.manage": "تعديل المخزون",
  "reviews.moderate": "إدارة التقييمات",
  "orders.view": "عرض الطلبات",
  "orders.manage": "تحديث الطلبات وحالاتها",
  "orders.refund": "إصدار المبالغ المستردة",
  "customers.view": "عرض العملاء",
  "customers.pii": "رؤية بيانات تواصل العملاء وعناوينهم",
  "customers.manage": "تعديل العملاء وإيقافهم وتعديل نقاطهم",
  "marketing.manage": "الكوبونات والعروض والنشرة البريدية",
  "content.manage": "الصفحات والرئيسية والقوائم والسلايدر والإعلانات والأسئلة",
  "support.chat": "الرد على المحادثات المباشرة",
  "support.messages": "قراءة رسائل التواصل",
  "settings.general": "إعدادات المتجر والمظهر واللغة وSEO",
  "settings.shipping": "إعدادات الشحن",
  "settings.payments": "بوابات الدفع وبياناتها",
  "settings.email": "البريد (SMTP/IMAP) والقوالب",
  "settings.notifications": "قواعد الإشعارات",
  "settings.security": "إعدادات الأمان (OTP والجلسات)",
  "settings.integrations": "التكاملات الخارجية",
  "staff.manage": "إدارة الموظفين والأدوار",
  "audit.view": "عرض سجلات التدقيق والنظام",
};

export function StaffView({ data }: { data: StaffData }) {
  const { t, locale, user: me } = useAdmin();
  const router = useRouter();
  const ar = locale === "ar";
  const [tab, setTab] = useState<"users" | "roles">("users");
  const [editUser, setEditUser] = useState<{ id: string | null; form: { name: string; email: string; phone: string | null; roleId: string; status: "ACTIVE" | "SUSPENDED"; locale: "ar" | "en" } } | null>(null);
  const [editRole, setEditRole] = useState<{ id: string | null; isSystem: boolean; form: { key: string; name: Record<string, string>; description: string | null; permissions: string[] } } | null>(null);
  const [secret, setSecret] = useState<{ email: string; password: string } | null>(null);
  const [confirmRole, setConfirmRole] = useState<Role | null>(null);
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [pending, start] = useTransition();

  const errText = (code: string) =>
    ({
      cant_edit_self: t("st.cantEditSelf"),
      last_super_admin: ar ? "يجب أن يبقى مدير عام واحد نشط على الأقل." : "At least one active Super Admin must remain.",
      super_admin_locked: ar ? "صلاحيات المدير العام ثابتة." : "The Super Admin role always has every permission.",
      system_role: ar ? "لا يمكن حذف أدوار النظام." : "System roles can't be deleted.",
      role_in_use: ar ? "انقل الأعضاء إلى دور آخر قبل الحذف." : "Move its members to another role first.",
      forbidden: ar ? "لا تملك صلاحية تنفيذ هذا الإجراء." : "You don't have permission to do that.",
    })[code] ?? t("c.fixErrors");

  const saveUser = () =>
    editUser &&
    start(async () => {
      const r = await saveStaffAction(editUser.id, editUser.form);
      if (r.ok) {
        setEditUser(null);
        setErrors({});
        if (r.data.tempPassword) setSecret({ email: editUser.form.email, password: r.data.tempPassword });
        else toast.success(t("c.saved"));
        router.refresh();
      } else {
        setErrors(r.fieldErrors ?? {});
        toast.error(errText(r.error));
      }
    });

  const saveRole = () =>
    editRole &&
    start(async () => {
      const r = await saveRoleAction(editRole.id, editRole.form);
      if (r.ok) {
        setEditRole(null);
        setErrors({});
        toast.success(t("c.saved"));
        router.refresh();
      } else {
        setErrors(r.fieldErrors ?? {});
        toast.error(errText(r.error));
      }
    });

  const togglePerm = (p: string) => editRole && setEditRole({ ...editRole, form: { ...editRole.form, permissions: editRole.form.permissions.includes(p) ? editRole.form.permissions.filter((x) => x !== p) : [...editRole.form.permissions, p] } });
  const isSuper = (r: Role | undefined) => Boolean(r?.permissions.includes("*"));

  return (
    <>
      <PageHeader
        title={t("st.title")}
        actions={
          tab === "users" ? (
            <Button leftIcon={<UserPlus />} onClick={() => (setErrors({}), setEditUser({ id: null, form: { name: "", email: "", phone: null, roleId: data.roles.find((r) => r.key === "support")?.id ?? data.roles.at(-1)?.id ?? "", status: "ACTIVE", locale } }))}>
              {t("st.invite")}
            </Button>
          ) : (
            <Button leftIcon={<Plus />} onClick={() => (setErrors({}), setEditRole({ id: null, isSystem: false, form: { key: "", name: {}, description: null, permissions: ["dashboard.view"] } }))}>
              {t("st.newRole")}
            </Button>
          )
        }
      />
      <div className="mb-4">
        <Segmented value={tab} onChange={setTab} options={[{ value: "users", label: `${t("st.users")} · ${data.users.length}` }, { value: "roles", label: `${t("st.roles")} · ${data.roles.length}` }]} />
      </div>

      {tab === "users" ? (
        <Panel padded={false}>
          <DataTable
            rows={data.users}
            onRowClick={(u) => (setErrors({}), setEditUser({ id: u.id, form: { name: u.name, email: u.email, phone: u.phone, roleId: u.roleId ?? "", status: u.status === "SUSPENDED" ? "SUSPENDED" : "ACTIVE", locale: u.locale === "en" ? "en" : "ar" } }))}
            columns={[
              {
                key: "n",
                header: t("c.name"),
                cell: (u: User) => (
                  <div className="flex items-center gap-3">
                    {u.avatar ? <img src={u.avatar} alt="" className="size-9 rounded-full object-cover" /> : <span className="grid size-9 place-items-center rounded-full bg-ad-sunken text-sm font-semibold">{u.name.slice(0, 1)}</span>}
                    <div className="min-w-0">
                      <p className="truncate font-medium">
                        {u.name} {u.id === me.id && <span className="text-xs text-ad-muted">({ar ? "أنت" : "you"})</span>}
                      </p>
                      <p className="truncate text-xs text-ad-muted" dir="ltr">
                        {u.email}
                      </p>
                    </div>
                  </div>
                ),
              },
              { key: "r", header: t("st.role"), cell: (u: User) => <Pill tone={isSuper(data.roles.find((r) => r.id === u.roleId)) ? "violet" : "neutral"}>{u.role ?? "—"}</Pill> },
              { key: "l", header: t("st.lastLogin"), cell: (u: User) => <span className="text-ad-muted">{u.lastLoginAt ? <TimeAgo date={u.lastLoginAt} /> : "—"}</span> },
              { key: "s", header: t("c.status"), cell: (u: User) => <Pill tone={u.status === "ACTIVE" ? "green" : "red"}>{u.status === "ACTIVE" ? t("c.active") : t("cu.suspended")}</Pill> },
            ]}
            mobile={(u: User) => (
              <div className="flex items-center gap-3">
                <span className="grid size-10 place-items-center rounded-full bg-ad-sunken font-semibold">{u.name.slice(0, 1)}</span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{u.name}</p>
                  <p className="truncate text-xs text-ad-muted">{u.role}</p>
                </div>
                <Pill tone={u.status === "ACTIVE" ? "green" : "red"}>{u.status === "ACTIVE" ? t("c.active") : t("cu.suspended")}</Pill>
              </div>
            )}
          />
        </Panel>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {data.roles.map((r) => (
            <button
              key={r.id}
              type="button"
              onClick={() => (setErrors({}), setEditRole({ id: r.id, isSystem: r.isSystem, form: { key: r.key, name: r.name, description: r.description, permissions: r.permissions } }))}
              className="flex flex-col rounded-2xl border border-ad-border bg-ad-panel p-4 text-start transition hover:border-ad-fg/20 hover:shadow-sm"
            >
              <div className="flex items-center gap-2">
                <ShieldCheck className={cn("size-4", isSuper(r) ? "text-violet-600" : "text-ad-muted")} />
                <span className="font-semibold">{r.label}</span>
                {r.isSystem && <Pill>{t("st.system")}</Pill>}
                <span className="ms-auto text-xs text-ad-muted">
                  {r.users} {ar ? "عضو" : r.users === 1 ? "member" : "members"}
                </span>
              </div>
              <p className="mt-2 text-xs text-ad-muted">{isSuper(r) ? (ar ? "كل الصلاحيات" : "Every permission") : `${r.permissions.length} / ${Object.keys(PERMISSIONS).length} ${t("st.permissions").toLowerCase()}`}</p>
              {r.description && <p className="mt-1 line-clamp-2 text-[13px] text-ad-fg/80">{r.description}</p>}
            </button>
          ))}
        </div>
      )}

      <EditSheet
        open={Boolean(editUser)}
        onOpenChange={(o) => !o && setEditUser(null)}
        title={editUser?.id ? editUser.form.name : t("st.invite")}
        onSave={saveUser}
        saving={pending}
        footerExtra={
          editUser?.id && editUser.id !== me.id ? (
            <Button
              variant="ghost"
              leftIcon={<KeyRound />}
              onClick={() =>
                window.confirm(ar ? "إنشاء كلمة مرور مؤقتة جديدة وتسجيل خروج العضو من كل الأجهزة؟" : "Generate a new temporary password and sign this member out everywhere?") &&
                start(async () => {
                  const r = await resetStaffPasswordAction(editUser.id!);
                  if (r.ok) {
                    setSecret({ email: editUser.form.email, password: r.data.tempPassword });
                    setEditUser(null);
                  } else toast.error(errText(r.error));
                })
              }
            >
              {ar ? "إعادة تعيين كلمة المرور" : "Reset password"}
            </Button>
          ) : null
        }
      >
        {editUser && (
          <div className="space-y-4">
            {editUser.id === me.id && <p className="rounded-lg bg-ad-sunken px-3 py-2 text-xs text-ad-muted">{t("st.cantEditSelf")}</p>}
            <div>
              <Label>{t("c.name")}</Label>
              <TextInput value={editUser.form.name} onChange={(e) => setEditUser({ ...editUser, form: { ...editUser.form, name: e.target.value } })} invalid={Boolean(errors.name)} />
            </div>
            <div>
              <Label>{t("c.email")}</Label>
              <TextInput type="email" dir="ltr" value={editUser.form.email} onChange={(e) => setEditUser({ ...editUser, form: { ...editUser.form, email: e.target.value } })} invalid={Boolean(errors.email)} />
              <FieldError message={errors.email ? (errors.email[0] === "taken" ? (ar ? "هذا البريد مستخدم" : "This email is already in use") : t("c.required")) : null} />
            </div>
            <div>
              <Label optional>{ar ? "الهاتف" : "Phone"}</Label>
              <TextInput dir="ltr" value={editUser.form.phone ?? ""} onChange={(e) => setEditUser({ ...editUser, form: { ...editUser.form, phone: e.target.value || null } })} />
            </div>
            <div>
              <Label>{t("st.role")}</Label>
              <Select value={editUser.form.roleId} disabled={editUser.id === me.id} onChange={(e) => setEditUser({ ...editUser, form: { ...editUser.form, roleId: e.target.value } })}>
                {data.roles.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.label}
                  </option>
                ))}
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>{t("c.status")}</Label>
                <Segmented size="sm" value={editUser.form.status} onChange={(v) => editUser.id !== me.id && setEditUser({ ...editUser, form: { ...editUser.form, status: v } })} options={[{ value: "ACTIVE", label: t("c.active") }, { value: "SUSPENDED", label: t("cu.suspended") }]} />
              </div>
              <div>
                <Label>{t("c.language")}</Label>
                <Segmented size="sm" value={editUser.form.locale} onChange={(v) => setEditUser({ ...editUser, form: { ...editUser.form, locale: v } })} options={[{ value: "ar", label: "العربية" }, { value: "en", label: "English" }]} />
              </div>
            </div>
            {!editUser.id && <p className="text-xs text-ad-muted">{ar ? "ستظهر كلمة مرور مؤقتة مرة واحدة بعد الحفظ؛ شاركها مع العضو بأمان وسيُطلب منه تغييرها." : "A temporary password is shown once after saving — share it securely; they'll be asked to change it."}</p>}
          </div>
        )}
      </EditSheet>

      <EditSheet
        open={Boolean(editRole)}
        onOpenChange={(o) => !o && setEditRole(null)}
        title={editRole?.id ? (editRole.form.name[locale] ?? editRole.form.key) : t("st.newRole")}
        onSave={saveRole}
        saving={pending}
        wide
        footerExtra={
          editRole?.id && !editRole.isSystem ? (
            <Button variant="ghost" className="text-red-600" leftIcon={<Trash2 />} onClick={() => setConfirmRole(data.roles.find((r) => r.id === editRole.id) ?? null)}>
              {t("c.delete")}
            </Button>
          ) : null
        }
      >
        {editRole && (
          <div className="space-y-5">
            <LocalizedField label={t("c.name")} value={editRole.form.name} onChange={(v) => setEditRole({ ...editRole, form: { ...editRole.form, name: v as Record<string, string> } })} required error={errors.name ? t("c.required") : null} />
            <div>
              <Label hint="a-z, 0-9, _">Key</Label>
              <TextInput dir="ltr" className="font-mono" disabled={editRole.isSystem} value={editRole.form.key} onChange={(e) => setEditRole({ ...editRole, form: { ...editRole.form, key: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "") } })} invalid={Boolean(errors.key)} />
              <FieldError message={errors.key ? (errors.key[0] === "taken" ? (ar ? "المفتاح مستخدم" : "Key already used") : t("c.required")) : null} />
            </div>
            <div>
              <Label optional>{t("c.description")}</Label>
              <TextArea rows={2} value={editRole.form.description ?? ""} onChange={(e) => setEditRole({ ...editRole, form: { ...editRole.form, description: e.target.value || null } })} />
            </div>
            <div>
              <Label>{t("st.permissions")}</Label>
              {editRole.form.permissions.includes("*") ? (
                <p className="flex items-center gap-2 rounded-lg bg-violet-50 px-3 py-2 text-sm text-violet-800 dark:bg-violet-950/40 dark:text-violet-300">
                  <Lock className="size-4" /> {ar ? "المدير العام يملك كل الصلاحيات دائماً." : "Super Admin always has every permission."}
                </p>
              ) : (
                <div className="space-y-4">
                  {PERMISSION_GROUPS.map((g) => {
                    const all = g.permissions.every((p) => editRole.form.permissions.includes(p));
                    return (
                      <div key={g.key} className="rounded-xl border border-ad-border">
                        <label className="flex cursor-pointer items-center gap-2 border-b border-ad-border px-3 py-2 text-sm font-medium">
                          <input
                            type="checkbox"
                            className="size-4 accent-[var(--ad-accent)]"
                            checked={all}
                            onChange={() => setEditRole({ ...editRole, form: { ...editRole.form, permissions: all ? editRole.form.permissions.filter((p) => !g.permissions.includes(p as Permission)) : [...new Set([...editRole.form.permissions, ...g.permissions])] } })}
                          />
                          {t(`st.grp.${g.key}` as "st.grp.overview")}
                        </label>
                        <div className="grid gap-1 p-2 sm:grid-cols-2">
                          {g.permissions.map((p) => (
                            <label key={p} className="flex cursor-pointer items-start gap-2 rounded-lg px-2 py-1.5 text-[13px] hover:bg-ad-hover">
                              <input type="checkbox" className="mt-0.5 size-4 accent-[var(--ad-accent)]" checked={editRole.form.permissions.includes(p)} onChange={() => togglePerm(p)} />
                              <span>
                                {ar ? PERMISSION_AR[p] : PERMISSIONS[p]}
                                <span className="block font-mono text-[10px] text-ad-muted">{p}</span>
                              </span>
                            </label>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}
      </EditSheet>

      <Modal open={Boolean(secret)} onOpenChange={(o) => !o && setSecret(null)} title={t("st.tempPassword")} description={ar ? "لن تظهر مرة أخرى. انسخها وشاركها بأمان." : "It won't be shown again. Copy it and share it securely."}>
        {secret && (
          <div className="space-y-3">
            <p className="text-sm" dir="ltr">
              {secret.email}
            </p>
            <div className="flex gap-2">
              <TextInput readOnly value={secret.password} dir="ltr" className="font-mono" onFocus={(e) => e.target.select()} />
              <Button variant="outline" size="icon" aria-label="Copy" onClick={() => navigator.clipboard.writeText(secret.password).then(() => toast.success(t("c.copied")))}>
                <Copy />
              </Button>
            </div>
            <Button block onClick={() => setSecret(null)}>
              {ar ? "تم" : "Done"}
            </Button>
          </div>
        )}
      </Modal>

      <ConfirmDialog
        open={Boolean(confirmRole)}
        onOpenChange={(o) => !o && setConfirmRole(null)}
        title={t("c.confirmDelete")}
        text={confirmRole?.label}
        confirmLabel={t("c.delete")}
        onConfirm={async () => {
          if (!confirmRole) return;
          const r = await deleteRoleAction(confirmRole.id);
          if (r.ok) {
            toast.success(t("c.deleted"));
            setConfirmRole(null);
            setEditRole(null);
            router.refresh();
          } else toast.error(errText(r.error));
        }}
      />
    </>
  );
}

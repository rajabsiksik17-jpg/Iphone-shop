"use client";

import { useState, useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { MapPin, Pencil, Trash2, Plus, Star, Download, AlertTriangle, RotateCcw, Bell, CheckCheck } from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Field, Input, NativeSelect, PasswordInput, Checkbox } from "@/components/ui/input";
import { PhoneInput } from "@/components/ui/phone-input";
import { Modal } from "@/components/ui/overlay";
import { EmptyState } from "@/components/ui/misc";
import { useCart } from "@/components/store/cart-provider";
import { saveAddressAction, deleteAddressAction, updateProfileAction, changePasswordAction, signOutOthersAction, deleteAccountAction, markNotificationsReadAction } from "@/actions/account";
import { useErrorMessage, useFieldError } from "@/lib/use-action";
import { cn } from "@/lib/utils";
import type { FieldErrors } from "@/server/errors";

type Address = { id: string; label: string | null; fullName: string; phone: string; country: string; city: string; area: string | null; line1: string; line2: string | null; postalCode: string | null; isDefault: boolean };

export function AddressBook({ addresses, countries, defaultCountry }: { addresses: Address[]; countries: { code: string; name: string }[]; defaultCountry: string }) {
  const t = useTranslations();
  const router = useRouter();
  const errorMessage = useErrorMessage();
  const fieldError = useFieldError();
  const [editing, setEditing] = useState<Partial<Address> | null>(null);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [pending, start] = useTransition();
  const set = (k: keyof Address) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setEditing((a) => ({ ...a, [k]: e.target.value }));
  const country = (code: string) => countries.find((c) => c.code === code)?.name ?? code;

  return (
    <>
      <div className="mb-5 flex items-center justify-between">
        <h2 className="text-xl font-semibold">{t("account.addresses")}</h2>
        <Button size="sm" leftIcon={<Plus />} onClick={() => (setErrors({}), setEditing({ country: defaultCountry }))}>
          {t("account.addAddress")}
        </Button>
      </div>
      {addresses.length ? (
        <div className="grid gap-4 sm:grid-cols-2">
          {addresses.map((a) => (
            <div key={a.id} className={cn("relative rounded-card border p-5", a.isDefault ? "border-fg" : "border-border")}>
              <div className="flex items-start justify-between gap-3">
                <p className="flex items-center gap-2 font-semibold">
                  <MapPin className="size-4 text-muted" /> {a.label || a.fullName}
                </p>
                {a.isDefault && <span className="rounded-full bg-primary px-2 py-0.5 text-[10px] font-semibold uppercase text-primary-fg">{t("account.default")}</span>}
              </div>
              <p className="mt-2 text-sm leading-relaxed text-fg/75">
                {a.fullName}
                <br />
                {a.line1}
                {a.line2 && `, ${a.line2}`}
                <br />
                {[a.area, a.city, country(a.country)].filter(Boolean).join(", ")}
                <br />
                <span dir="ltr">{a.phone}</span>
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <Button size="xs" variant="outline" leftIcon={<Pencil />} onClick={() => (setErrors({}), setEditing(a))}>
                  {t("common.edit")}
                </Button>
                {!a.isDefault && (
                  <Button size="xs" variant="ghost" leftIcon={<Star />} onClick={() => start(async () => (await saveAddressAction({ ...a, area: a.area ?? "", line2: a.line2 ?? "", postalCode: a.postalCode ?? "", label: a.label ?? "", isDefault: true }), router.refresh()))}>
                    {t("account.makeDefault")}
                  </Button>
                )}
                <Button size="xs" variant="ghost" className="text-red-600" leftIcon={<Trash2 />} onClick={() => start(async () => (await deleteAddressAction(a.id), router.refresh()))}>
                  {t("common.delete")}
                </Button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <EmptyState icon={<MapPin />} title={t("account.noAddresses")} text={t("account.noAddressesHint")} className="rounded-card border border-dashed border-border" />
      )}
      <Modal open={Boolean(editing)} onOpenChange={(o) => !o && setEditing(null)} title={editing?.id ? t("account.editAddress") : t("account.addAddress")}>
        {editing && (
          <form
            className="grid gap-4 sm:grid-cols-2"
            noValidate
            onSubmit={(e) => {
              e.preventDefault();
              start(async () => {
                const res = await saveAddressAction({
                  id: editing.id,
                  label: editing.label ?? "",
                  fullName: editing.fullName ?? "",
                  phone: editing.phone ?? "",
                  country: editing.country ?? defaultCountry,
                  city: editing.city ?? "",
                  area: editing.area ?? "",
                  line1: editing.line1 ?? "",
                  line2: editing.line2 ?? "",
                  postalCode: editing.postalCode ?? "",
                  isDefault: editing.isDefault ?? false,
                });
                if (res.ok) {
                  setEditing(null);
                  router.refresh();
                } else {
                  setErrors(res.fieldErrors ?? {});
                  if (res.error !== "validation") toast.error(errorMessage(res));
                }
              });
            }}
          >
            <Field label={t("checkout.fullName")} error={fieldError(errors.fullName)}>
              {(p) => <Input {...p} value={editing.fullName ?? ""} onChange={set("fullName")} autoComplete="name" />}
            </Field>
            <Field label={t("checkout.phone")} error={fieldError(errors.phone)}>
              {(p) => <PhoneInput {...p} value={editing.phone ?? ""} onChange={(v) => setEditing((a) => ({ ...a, phone: v }))} defaultCountry={editing.country} />}
            </Field>
            <Field label={t("checkout.country")}>
              {(p) => (
                <NativeSelect {...p} value={editing.country ?? defaultCountry} onChange={set("country")}>
                  {countries.map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.name}
                    </option>
                  ))}
                </NativeSelect>
              )}
            </Field>
            <Field label={t("checkout.city")} error={fieldError(errors.city)}>
              {(p) => <Input {...p} value={editing.city ?? ""} onChange={set("city")} />}
            </Field>
            <Field label={t("checkout.address")} error={fieldError(errors.line1)} className="sm:col-span-2">
              {(p) => <Input {...p} value={editing.line1 ?? ""} onChange={set("line1")} />}
            </Field>
            <Field label={t("checkout.area")} optional={t("common.optional")}>
              {(p) => <Input {...p} value={editing.area ?? ""} onChange={set("area")} />}
            </Field>
            <Field label={t("checkout.address2")} optional={t("common.optional")}>
              {(p) => <Input {...p} value={editing.line2 ?? ""} onChange={set("line2")} />}
            </Field>
            <Checkbox className="sm:col-span-2" label={t("account.makeDefault")} checked={Boolean(editing.isDefault)} onChange={(e) => setEditing((a) => ({ ...a, isDefault: e.target.checked }))} />
            <Button type="submit" loading={pending} className="sm:col-span-2">
              {t("common.save")}
            </Button>
          </form>
        )}
      </Modal>
    </>
  );
}

export function ProfileForm({ user }: { user: { name: string; email: string; phone: string | null; locale: string; marketingOptIn: boolean } }) {
  const t = useTranslations();
  const errorMessage = useErrorMessage();
  const fieldError = useFieldError();
  const [v, setV] = useState({ name: user.name, phone: user.phone ?? "", locale: user.locale, marketing: user.marketingOptIn });
  const [errors, setErrors] = useState<FieldErrors>({});
  const [pending, start] = useTransition();
  return (
    <form
      className="max-w-xl space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const res = await updateProfileAction({ name: v.name, phone: v.phone, locale: v.locale, marketingOptIn: v.marketing });
          if (res.ok) toast.success(t("account.profileSaved"));
          else {
            setErrors(res.fieldErrors ?? {});
            toast.error(errorMessage(res));
          }
        });
      }}
    >
      <Field label={t("account.name")} error={fieldError(errors.name)}>
        {(p) => <Input {...p} value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} />}
      </Field>
      <Field label={t("account.email")}>{(p) => <Input {...p} value={user.email} disabled />}</Field>
      <Field label={t("account.phone")} error={fieldError(errors.phone)}>
        {(p) => <PhoneInput {...p} value={v.phone} onChange={(phone) => setV({ ...v, phone })} />}
      </Field>
      <Field label={t("account.language")}>
        {(p) => (
          <NativeSelect {...p} value={v.locale} onChange={(e) => setV({ ...v, locale: e.target.value })}>
            <option value="ar">العربية</option>
            <option value="en">English</option>
          </NativeSelect>
        )}
      </Field>
      <Checkbox label={t("account.marketing")} checked={v.marketing} onChange={(e) => setV({ ...v, marketing: e.target.checked })} />
      <Button type="submit" loading={pending}>
        {t("common.save")}
      </Button>
    </form>
  );
}

export function SecurityPanel({ sessions }: { sessions: { id: string; userAgent: string | null; lastSeenAt: string; current: boolean }[] }) {
  const t = useTranslations();
  const locale = useLocale();
  const errorMessage = useErrorMessage();
  const fieldError = useFieldError();
  const router = useRouter();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [pending, start] = useTransition();
  return (
    <div className="space-y-10">
      <section>
        <h2 className="mb-4 text-xl font-semibold">{t("account.changePassword")}</h2>
        <form
          className="max-w-md space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            start(async () => {
              const res = await changePasswordAction({ current, next });
              if (res.ok) {
                toast.success(t("account.passwordChanged"));
                setCurrent("");
                setNext("");
                setErrors({});
                router.refresh();
              } else {
                setErrors(res.fieldErrors ?? {});
                if (res.error !== "validation") toast.error(errorMessage(res));
              }
            });
          }}
        >
          <Field label={t("account.currentPassword")} error={fieldError(errors.currentPassword)}>
            {(p) => <PasswordInput {...p} autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} showLabel={t("auth.showPassword")} hideLabel={t("auth.hidePassword")} />}
          </Field>
          <Field label={t("account.newPassword")} error={fieldError(errors.newPassword)}>
            {(p) => <PasswordInput {...p} autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} showLabel={t("auth.showPassword")} hideLabel={t("auth.hidePassword")} />}
          </Field>
          <Button type="submit" loading={pending}>
            {t("common.save")}
          </Button>
        </form>
      </section>
      <section>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-semibold">{t("account.sessions")}</h2>
          {sessions.length > 1 && (
            <Button size="sm" variant="outline" onClick={() => start(async () => (await signOutOthersAction(), router.refresh()))}>
              {t("account.signOutOthers")}
            </Button>
          )}
        </div>
        <ul className="divide-y divide-border rounded-card border border-border">
          {sessions.map((s) => (
            <li key={s.id} className="flex items-center justify-between gap-3 p-4 text-sm">
              <span className="min-w-0 truncate text-fg/80">{s.userAgent?.replace(/\(.*?\)/g, "").slice(0, 70) ?? "—"}</span>
              <span className="shrink-0 text-xs text-muted">{s.current ? <span className="font-semibold text-success">{t("account.thisDevice")}</span> : new Date(s.lastSeenAt).toLocaleString(locale)}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

export function PrivacyPanel({ allowExport, allowDelete }: { allowExport: boolean; allowDelete: boolean }) {
  const t = useTranslations();
  const errorMessage = useErrorMessage();
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [pending, start] = useTransition();
  return (
    <div className="space-y-6">
      {allowExport && (
        <section className="rounded-card border border-border p-6">
          <h2 className="font-semibold">{t("account.exportData")}</h2>
          <p className="mt-1 text-sm text-muted">{t("account.exportHint")}</p>
          <Button asChild variant="outline" className="mt-4" leftIcon={<Download />}>
            <a href="/api/account/export">{t("account.exportData")}</a>
          </Button>
        </section>
      )}
      {allowDelete && (
        <section className="rounded-card border border-red-200 p-6">
          <h2 className="font-semibold text-red-700">{t("account.deleteAccount")}</h2>
          <p className="mt-1 text-sm text-muted">{t("account.deleteHint")}</p>
          <Button variant="danger" className="mt-4" leftIcon={<AlertTriangle />} onClick={() => setOpen(true)}>
            {t("account.deleteAccount")}
          </Button>
          <Modal open={open} onOpenChange={setOpen} title={t("account.deleteAccount")} description={t("account.deleteHint")}>
            <form
              className="space-y-4"
              onSubmit={(e) => {
                e.preventDefault();
                start(async () => {
                  const res = await deleteAccountAction({ password, confirm });
                  if (res.ok) {
                    toast.success(t("account.deleteRequested"));
                    window.location.assign(`/${document.documentElement.lang}`);
                  } else toast.error(errorMessage(res));
                });
              }}
            >
              <Field label={t("auth.password")}>{(p) => <PasswordInput {...p} value={password} onChange={(e) => setPassword(e.target.value)} showLabel={t("auth.showPassword")} hideLabel={t("auth.hidePassword")} />}</Field>
              <Field label={t("account.deleteConfirm")}>{(p) => <Input {...p} value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="off" />}</Field>
              <Button type="submit" variant="danger" block loading={pending} disabled={confirm !== "DELETE" || !password}>
                {t("account.deleteAccount")}
              </Button>
            </form>
          </Modal>
        </section>
      )}
    </div>
  );
}

export function ReorderButton({ items }: { items: { productId: string; variantId: string | null; quantity: number; name: string; price: number }[] }) {
  const t = useTranslations("account");
  const { add } = useCart();
  const [pending, setPending] = useState(false);
  return (
    <Button
      variant="outline"
      leftIcon={<RotateCcw />}
      loading={pending}
      onClick={async () => {
        setPending(true);
        for (const [i, it] of items.entries()) await add({ ...it, openDrawer: i === items.length - 1 });
        setPending(false);
      }}
    >
      {t("reorder")}
    </Button>
  );
}

export function NotificationsList({ items }: { items: { id: string; title: string; body: string; link: string | null; createdAt: string; read: boolean }[] }) {
  const t = useTranslations("account");
  const locale = useLocale();
  const router = useRouter();
  const [pending, start] = useTransition();
  if (!items.length) return <EmptyState icon={<Bell />} title={t("noNotifications")} className="rounded-card border border-dashed border-border" />;
  return (
    <>
      <div className="mb-4 flex justify-end">
        <Button size="sm" variant="ghost" leftIcon={<CheckCheck />} loading={pending} onClick={() => start(async () => (await markNotificationsReadAction(), router.refresh()))}>
          {t("markAllRead")}
        </Button>
      </div>
      <ul className="divide-y divide-border rounded-card border border-border">
        {items.map((n) => (
          <li key={n.id} className={cn("flex gap-3 p-4", !n.read && "bg-accent/5")}>
            <span className={cn("mt-1.5 size-2 shrink-0 rounded-full", n.read ? "bg-transparent" : "bg-accent")} />
            <div className="min-w-0 flex-1">
              {n.link ? (
                <a href={`/${locale}${n.link}`} className="font-medium hover:underline">
                  {n.title}
                </a>
              ) : (
                <p className="font-medium">{n.title}</p>
              )}
              {n.body && <p className="text-sm text-muted">{n.body}</p>}
              <p className="mt-1 text-xs text-muted">{new Date(n.createdAt).toLocaleString(locale)}</p>
            </div>
          </li>
        ))}
      </ul>
    </>
  );
}

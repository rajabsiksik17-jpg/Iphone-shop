"use client";

import { useState, useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { MailCheck, CheckCircle2 } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Field, Input, PasswordInput, Checkbox } from "@/components/ui/input";
import { PhoneInput } from "@/components/ui/phone-input";
import { customerLoginAction, registerAction, forgotPasswordAction, resetPasswordAction } from "@/actions/auth";
import { useErrorMessage, useFieldError } from "@/lib/use-action";
import { guestWishlist } from "@/lib/local-store";
import { safeRedirectPath } from "@/lib/utils";
import type { FieldErrors } from "@/server/errors";

function FormError({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <p className="animate-fade-in rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">
      {message}
    </p>
  );
}

/** After auth, do a full navigation so every server component re-reads the session. */
function useAfterAuth() {
  const sp = useSearchParams();
  const locale = useLocale();
  return () => {
    const next = safeRedirectPath(sp.get("next"), "/account");
    window.location.assign(next.startsWith(`/${locale}`) ? next : `/${locale}${next}`);
  };
}

export function LoginForm() {
  const t = useTranslations();
  const errorMessage = useErrorMessage();
  const done = useAfterAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        start(async () => {
          const res = await customerLoginAction({ email, password, wishlist: guestWishlist.get() });
          if (res.ok) {
            guestWishlist.clear();
            done();
          } else setError(errorMessage(res));
        });
      }}
    >
      <FormError message={error} />
      <Field label={t("auth.email")}>{(p) => <Input {...p} type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />}</Field>
      <Field
        label={
          <span className="flex w-full items-center justify-between">
            {t("auth.password")}
            <Link href="/account/forgot-password" className="text-xs font-normal text-accent hover:underline">
              {t("auth.forgot")}
            </Link>
          </span>
        }
      >
        {(p) => <PasswordInput {...p} autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} showLabel={t("auth.showPassword")} hideLabel={t("auth.hidePassword")} />}
      </Field>
      <Button type="submit" size="lg" block loading={pending}>
        {t("auth.signInCta")}
      </Button>
    </form>
  );
}

export function RegisterForm({ minPassword }: { minPassword: number }) {
  const t = useTranslations();
  const locale = useLocale();
  const errorMessage = useErrorMessage();
  const fieldError = useFieldError();
  const done = useAfterAuth();
  const [v, setV] = useState({ name: "", email: "", password: "", phone: "", marketing: false });
  const [errors, setErrors] = useState<FieldErrors>({});
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <form
      className="space-y-4"
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        start(async () => {
          const res = await registerAction({ name: v.name, email: v.email, password: v.password, phone: v.phone, locale, marketingOptIn: v.marketing, wishlist: guestWishlist.get() });
          if (res.ok) {
            guestWishlist.clear();
            done();
          } else {
            setErrors(res.fieldErrors ?? {});
            setError(res.error === "validation" ? null : errorMessage(res));
          }
        });
      }}
    >
      <FormError message={error} />
      <Field label={t("auth.name")} error={fieldError(errors.name)}>
        {(p) => <Input {...p} autoComplete="name" required value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} />}
      </Field>
      <Field label={t("auth.email")} error={fieldError(errors.email)}>
        {(p) => <Input {...p} type="email" autoComplete="email" required value={v.email} onChange={(e) => setV({ ...v, email: e.target.value })} />}
      </Field>
      <Field label={t("auth.phone")} error={fieldError(errors.phone)}>
        {(p) => <PhoneInput {...p} value={v.phone} onChange={(phone) => setV({ ...v, phone })} />}
      </Field>
      <Field label={t("auth.password")} hint={t("auth.passwordHint", { min: minPassword })} error={fieldError(errors.password)}>
        {(p) => <PasswordInput {...p} autoComplete="new-password" required minLength={minPassword} value={v.password} onChange={(e) => setV({ ...v, password: e.target.value })} showLabel={t("auth.showPassword")} hideLabel={t("auth.hidePassword")} />}
      </Field>
      <Checkbox label={t("auth.marketingOptIn")} checked={v.marketing} onChange={(e) => setV({ ...v, marketing: e.target.checked })} />
      <Button type="submit" size="lg" block loading={pending}>
        {t("auth.registerCta")}
      </Button>
      <p className="text-center text-xs text-muted">
        {t.rich("auth.agree", {
          terms: () => (
            <Link href="/terms" className="underline">
              {t("checkout.termsLink")}
            </Link>
          ),
          privacy: () => (
            <Link href="/privacy" className="underline">
              {t("checkout.privacyLink")}
            </Link>
          ),
        })}
      </p>
    </form>
  );
}

export function ForgotForm({ scope = "STOREFRONT" }: { scope?: "STOREFRONT" | "ADMIN" }) {
  const t = useTranslations();
  const locale = useLocale();
  const errorMessage = useErrorMessage();
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  if (sent)
    return (
      <div className="animate-scale-in flex flex-col items-center gap-4 rounded-2xl bg-surface p-6 text-center">
        <MailCheck className="size-10 text-success" />
        <p className="text-sm">{t("auth.linkSent")}</p>
      </div>
    );
  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const res = await forgotPasswordAction({ email, locale, scope });
          if (res.ok) setSent(true);
          else setError(errorMessage(res));
        });
      }}
    >
      <FormError message={error} />
      <Field label={t("auth.email")}>{(p) => <Input {...p} type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />}</Field>
      <Button type="submit" size="lg" block loading={pending}>
        {t("auth.sendLink")}
      </Button>
    </form>
  );
}

export function ResetForm({ token, minPassword, loginHref }: { token: string; minPassword: number; loginHref: string }) {
  const t = useTranslations();
  const errorMessage = useErrorMessage();
  const fieldError = useFieldError();
  const [password, setPassword] = useState("");
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [pending, start] = useTransition();
  if (done)
    return (
      <div className="animate-scale-in flex flex-col items-center gap-4 rounded-2xl bg-surface p-6 text-center">
        <CheckCircle2 className="size-10 text-success" />
        <p className="text-sm">{t("auth.resetDone")}</p>
        <Button asChild>
          <a href={loginHref}>{t("auth.signInCta")}</a>
        </Button>
      </div>
    );
  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const res = await resetPasswordAction({ token, password });
          if (res.ok) setDone(true);
          else {
            setErrors(res.fieldErrors ?? {});
            setError(res.error === "validation" ? null : errorMessage(res));
          }
        });
      }}
    >
      <FormError message={error} />
      <Field label={t("account.newPassword")} hint={t("auth.passwordHint", { min: minPassword })} error={fieldError(errors.password)}>
        {(p) => <PasswordInput {...p} autoComplete="new-password" required value={password} onChange={(e) => setPassword(e.target.value)} showLabel={t("auth.showPassword")} hideLabel={t("auth.hidePassword")} />}
      </Field>
      <Button type="submit" size="lg" block loading={pending}>
        {t("auth.resetCta")}
      </Button>
    </form>
  );
}

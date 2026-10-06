"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useSearchParams } from "next/navigation";
import { LockKeyhole, MailCheck, ShieldCheck } from "lucide-react";
import { adminLoginAction, adminVerifyOtpAction, adminResendOtpAction } from "@/actions/auth";
import { Button } from "@/components/ui/button";
import { Field, Input, PasswordInput } from "@/components/ui/input";
import { adminT, hasAdminKey } from "@/admin/i18n";
import { safeRedirectPath } from "@/lib/utils";
import { cn } from "@/lib/utils";

/**
 * Admin sign-in. Step 1 password; step 2 (only when Settings → Security →
 * Admin OTP is on) a 4–10 digit emailed code with resend cooldown.
 */
export function AdminLoginForm({ locale, otpLength }: { locale: "ar" | "en"; otpLength: number }) {
  const t = adminT(locale);
  const sp = useSearchParams();
  const [step, setStep] = useState<"password" | "otp">("password");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [maskedEmail, setMaskedEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);
  const [pending, start] = useTransition();
  const codeRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (cooldown <= 0) return;
    const id = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(id);
  }, [cooldown]);

  const done = () => {
    const next = safeRedirectPath(sp.get("next"), `/${locale}/admin`);
    window.location.assign(next.startsWith(`/${locale}/admin`) ? next : `/${locale}/admin`);
  };

  const describe = (code: string, retry?: number, attemptsLeft?: number) => {
    if (code === "otp_wrong_code" && attemptsLeft) return t("auth.attemptsLeft", { n: attemptsLeft });
    if (code === "rate_limited") return locale === "ar" ? `محاولات كثيرة. انتظر ${retry ?? 60} ثانية.` : `Too many attempts. Wait ${retry ?? 60}s.`;
    const key = `auth.err.${code}`;
    return hasAdminKey(key) ? t(key) : t("c.error");
  };

  if (step === "otp")
    return (
      <form
        className="space-y-5"
        onSubmit={(e) => {
          e.preventDefault();
          setError(null);
          start(async () => {
            const r = await adminVerifyOtpAction(code);
            if (r.ok) return done();
            const attemptsLeft = typeof r.meta?.attemptsLeft === "number" ? r.meta.attemptsLeft : undefined;
            setError(describe(r.error, r.retryAfterSec, attemptsLeft));
            setCode("");
            if (r.error === "otp_too_many_attempts" || r.error === "otp_invalid_challenge" || r.error === "otp_expired") setStep("password");
            codeRef.current?.focus();
          });
        }}
      >
        <div className="flex flex-col items-center text-center">
          <span className="grid size-12 place-items-center rounded-2xl bg-ad-accent/10 text-ad-accent">
            <MailCheck className="size-6" />
          </span>
          <h1 className="mt-4 text-xl font-semibold">{t("auth.otpTitle")}</h1>
          <p className="mt-1 text-sm text-ad-muted">{t("auth.otpText", { length: otpLength, email: maskedEmail })}</p>
        </div>
        {error && <p className="rounded-lg bg-red-500/10 px-3 py-2.5 text-sm text-red-600" role="alert">{error}</p>}
        <Field label={t("auth.otpCode")}>
          {(p) => (
            <Input
              {...p}
              ref={codeRef}
              autoFocus
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, otpLength))}
              inputMode="numeric"
              autoComplete="one-time-code"
              className="tabular h-14 text-center text-2xl font-semibold tracking-[0.5em]"
              placeholder={"•".repeat(otpLength)}
              dir="ltr"
            />
          )}
        </Field>
        <Button type="submit" block size="lg" loading={pending} disabled={code.length !== otpLength}>
          {t("auth.verify")}
        </Button>
        <div className="flex items-center justify-between text-sm">
          <button type="button" className="text-ad-muted hover:text-ad-fg" onClick={() => (setStep("password"), setCode(""), setError(null))}>
            {t("auth.useDifferent")}
          </button>
          <button
            type="button"
            disabled={cooldown > 0 || pending}
            className={cn("font-medium text-ad-accent", cooldown > 0 && "text-ad-muted")}
            onClick={() =>
              start(async () => {
                const r = await adminResendOtpAction();
                if (r.ok) setCooldown(60);
                else {
                  setError(describe(r.error, r.retryAfterSec));
                  if (r.retryAfterSec) setCooldown(r.retryAfterSec);
                }
              })
            }
          >
            {cooldown > 0 ? t("auth.resendIn", { s: cooldown }) : t("auth.resend")}
          </button>
        </div>
      </form>
    );

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        start(async () => {
          const r = await adminLoginAction({ email, password });
          if (!r.ok) return setError(describe(r.error, r.retryAfterSec));
          if (r.data.status === "otp_required") {
            setMaskedEmail(r.data.email);
            setStep("otp");
            setCooldown(60);
            setPassword("");
          } else done();
        });
      }}
    >
      <div className="mb-2 flex flex-col items-center text-center">
        <span className="grid size-12 place-items-center rounded-2xl bg-ad-fg text-ad-panel">
          <LockKeyhole className="size-6" />
        </span>
        <h1 className="mt-4 text-xl font-semibold">{t("auth.title")}</h1>
        <p className="mt-1 text-sm text-ad-muted">{t("auth.subtitle")}</p>
      </div>
      {error && <p className="rounded-lg bg-red-500/10 px-3 py-2.5 text-sm text-red-600" role="alert">{error}</p>}
      <Field label={t("auth.email")}>{(p) => <Input {...p} type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} autoFocus />}</Field>
      <Field label={t("auth.password")}>
        {(p) => <PasswordInput {...p} autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} showLabel="Show" hideLabel="Hide" />}
      </Field>
      <Button type="submit" block size="lg" loading={pending}>
        {t("auth.signIn")}
      </Button>
      <div className="flex items-center justify-between pt-1 text-sm">
        <a href={`/${locale}/admin/forgot-password`} className="text-ad-muted hover:text-ad-fg">
          {t("auth.forgot")}
        </a>
        <a href={`/${locale === "ar" ? "en" : "ar"}/admin/login`} className="text-ad-muted hover:text-ad-fg">
          {locale === "ar" ? "English" : "العربية"}
        </a>
      </div>
      <p className="flex items-center justify-center gap-1.5 pt-2 text-center text-[11px] text-ad-muted">
        <ShieldCheck className="size-3.5" /> {t("auth.secure")}
      </p>
    </form>
  );
}

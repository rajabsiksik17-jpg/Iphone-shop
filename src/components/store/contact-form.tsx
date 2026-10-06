"use client";

import { useState, useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { CheckCircle2, Send } from "lucide-react";
import { contactAction } from "@/actions/store";
import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/input";
import { PhoneInput } from "@/components/ui/phone-input";
import { useStore } from "@/components/providers/store-context";
import { useErrorMessage, useFieldError } from "@/lib/use-action";
import type { FieldErrors } from "@/server/errors";

type Mode = "hidden" | "optional" | "required";

export function ContactForm({ fields }: { fields: { phone: Mode; subject: Mode; orderNumber: Mode } }) {
  const t = useTranslations();
  const locale = useLocale();
  const { user } = useStore();
  const errorMessage = useErrorMessage();
  const fieldError = useFieldError();
  const [values, setValues] = useState({ name: user?.name ?? "", email: user?.email ?? "", phone: "", subject: "", orderNumber: "", message: "", website: "" });
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [pending, start] = useTransition();
  const set = (k: keyof typeof values) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setValues((v) => ({ ...v, [k]: e.target.value }));

  if (sent)
    return (
      <div className="animate-scale-in flex flex-col items-center rounded-card border border-border p-10 text-center">
        <CheckCircle2 className="size-12 text-success" />
        <p className="mt-4 font-medium">{t("contact.sent")}</p>
      </div>
    );

  return (
    <form
      noValidate
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        setFormError(null);
        start(async () => {
          const res = await contactAction({ ...values, locale });
          if (res.ok) setSent(true);
          else {
            setErrors(res.fieldErrors ?? {});
            setFormError(errorMessage(res));
          }
        });
      }}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t("contact.name")} error={fieldError(errors.name)}>
          {(p) => <Input {...p} required autoComplete="name" value={values.name} onChange={set("name")} />}
        </Field>
        <Field label={t("contact.email")} error={fieldError(errors.email)}>
          {(p) => <Input {...p} type="email" required autoComplete="email" value={values.email} onChange={set("email")} />}
        </Field>
      </div>
      {(fields.phone !== "hidden" || fields.orderNumber !== "hidden") && (
        <div className="grid gap-4 sm:grid-cols-2">
          {fields.phone !== "hidden" && (
            <Field label={t("contact.phone")} optional={fields.phone === "optional" ? t("common.optional") : undefined} error={fieldError(errors.phone)}>
              {(p) => <PhoneInput {...p} value={values.phone} onChange={(v) => setValues((s) => ({ ...s, phone: v }))} />}
            </Field>
          )}
          {fields.orderNumber !== "hidden" && (
            <Field label={t("contact.orderNumber")} optional={fields.orderNumber === "optional" ? t("common.optional") : undefined} error={fieldError(errors.orderNumber)}>
              {(p) => <Input {...p} value={values.orderNumber} onChange={set("orderNumber")} placeholder="NQ-100123" />}
            </Field>
          )}
        </div>
      )}
      {fields.subject !== "hidden" && (
        <Field label={t("contact.subject")} optional={fields.subject === "optional" ? t("common.optional") : undefined} error={fieldError(errors.subject)}>
          {(p) => <Input {...p} value={values.subject} onChange={set("subject")} />}
        </Field>
      )}
      <Field label={t("contact.message")} error={fieldError(errors.message)}>
        {(p) => <Textarea {...p} required rows={5} value={values.message} onChange={set("message")} />}
      </Field>
      {/* Honeypot for bots — hidden from people and assistive tech. */}
      <input type="text" name="website" value={values.website} onChange={set("website")} tabIndex={-1} autoComplete="off" className="absolute -start-[9999px] size-px opacity-0" aria-hidden />
      {formError && (
        <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">
          {formError}
        </p>
      )}
      <Button type="submit" size="lg" loading={pending} rightIcon={<Send className="flip-rtl" />}>
        {t("contact.send")}
      </Button>
    </form>
  );
}

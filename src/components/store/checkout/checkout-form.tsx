"use client";

import { useEffect, useState, useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { ChevronDown, Lock, MapPin, Store, Truck, CreditCard, Banknote, Landmark, Check, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Field, Input, NativeSelect, Textarea, Checkbox } from "@/components/ui/input";
import { PhoneInput } from "@/components/ui/phone-input";
import { Spinner } from "@/components/ui/spinner";
import { useStore } from "@/components/providers/store-context";
import { useCart } from "@/components/store/cart-provider";
import { CouponBox, MiniLines, PointsBox, SummaryLines } from "@/components/store/order-summary";
import { shippingQuotesAction } from "@/actions/cart";
import { placeOrderAction } from "@/actions/checkout";
import { useErrorMessage, useFieldError } from "@/lib/use-action";
import { track } from "@/lib/analytics-client";
import { cn } from "@/lib/utils";
import type { CartTotals } from "@/server/commerce/cart";
import type { ShippingQuote } from "@/server/commerce/shipping";
import type { FieldErrors } from "@/server/errors";

type Address = { id: string; label: string | null; fullName: string; phone: string; country: string; city: string; area: string | null; line1: string; line2: string | null; postalCode: string | null; isDefault: boolean };
type PaymentMethod = { key: string; title: string; instructions: string; icon: string; online: boolean; testMode: boolean };

type Props = {
  initialTotals: CartTotals;
  user: { email: string; name: string; phone: string | null } | null;
  addresses: Address[];
  payments: PaymentMethod[];
  countries: { code: string; name: string }[];
  defaultCountry: string;
  settings: { requireTerms: boolean; allowNotes: boolean; postalCode: "hidden" | "optional" | "required"; guestCheckout: boolean };
  cancelledOrder: string | null;
};

const PAY_ICONS: Record<string, React.ReactNode> = {
  cod: <Banknote className="size-5" />,
  bank_transfer: <Landmark className="size-5" />,
};

function SectionCard({ step, title, children, aside }: { step: number; title: string; children: React.ReactNode; aside?: React.ReactNode }) {
  return (
    <section className="rounded-[calc(var(--nq-radius)*1.4)] border border-border bg-bg p-5 md:p-7">
      <div className="mb-5 flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-3 text-lg font-semibold">
          <span className="grid size-7 place-items-center rounded-full bg-primary text-xs font-bold text-primary-fg">{step}</span>
          {title}
        </h2>
        {aside}
      </div>
      {children}
    </section>
  );
}

export function CheckoutForm({ initialTotals, user, addresses, payments, countries, defaultCountry, settings, cancelledOrder }: Props) {
  const t = useTranslations();
  const locale = useLocale();
  const errorMessage = useErrorMessage();
  const fieldError = useFieldError();
  const { format, setCartCount } = useStore();
  const { totals: live, refresh } = useCart();
  const totals = live ?? initialTotals;

  const def = addresses.find((a) => a.isDefault) ?? addresses[0];
  const [addressId, setAddressId] = useState<string | "new">(def?.id ?? "new");
  const [form, setForm] = useState({
    email: user?.email ?? "",
    fullName: def?.fullName ?? user?.name ?? "",
    phone: def?.phone ?? user?.phone ?? "",
    country: def?.country ?? defaultCountry,
    city: def?.city ?? "",
    area: def?.area ?? "",
    line1: def?.line1 ?? "",
    line2: def?.line2 ?? "",
    postalCode: def?.postalCode ?? "",
  });
  const [notes, setNotes] = useState("");
  const [terms, setTerms] = useState(false);
  const [marketing, setMarketing] = useState(false);
  const [saveAddress, setSaveAddress] = useState(true);
  const [quotes, setQuotes] = useState<ShippingQuote[] | null>(null);
  const [shippingId, setShippingId] = useState<string | null>(null);
  const [payment, setPayment] = useState(payments[0]?.key ?? "");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [summaryOpen, setSummaryOpen] = useState(false);
  const [placing, start] = useTransition();
  const [loadingQuotes, setLoadingQuotes] = useState(false);

  useEffect(() => {
    if (!live) void refresh();
  }, [live, refresh]);

  useEffect(() => {
    if (cancelledOrder) toast.warning(t("checkout.cancelled", { number: cancelledOrder }), { duration: 10_000 });
    track.beginCheckout(
      totals.lines.map((l) => ({ id: l.productId, name: l.name, price: l.unitPrice, quantity: l.quantity, variant: l.variantLabel })),
      totals.total,
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Re-quote shipping whenever the destination or cart value changes.
  const quoteKey = `${form.country}:${totals.subtotal}:${totals.discountTotal}:${totals.freeShipping}`;
  useEffect(() => {
    let cancelled = false;
    setLoadingQuotes(true);
    shippingQuotesAction({ country: form.country, locale }).then((r) => {
      if (cancelled) return;
      setLoadingQuotes(false);
      if (!r.ok) return;
      setQuotes(r.data);
      setShippingId((cur) => (cur && r.data.some((q) => q.id === cur) ? cur : (r.data[0]?.id ?? null)));
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quoteKey, locale]);

  const shipping = quotes?.find((q) => q.id === shippingId) ?? null;
  const grand = totals.total + (shipping?.cost ?? 0);
  const selectedPayment = payments.find((p) => p.key === payment);

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const err = (k: string) => fieldError(errors[k] ?? errors[`address.${k}`]);

  const chooseAddress = (id: string) => {
    setAddressId(id);
    const a = addresses.find((x) => x.id === id);
    if (a) setForm((f) => ({ ...f, fullName: a.fullName, phone: a.phone, country: a.country, city: a.city, area: a.area ?? "", line1: a.line1, line2: a.line2 ?? "", postalCode: a.postalCode ?? "" }));
  };

  const submit = () => {
    setErrors({});
    start(async () => {
      const res = await placeOrderAction(
        {
          email: form.email,
          address: { fullName: form.fullName, phone: form.phone, country: form.country, city: form.city, area: form.area, line1: form.line1, line2: form.line2, postalCode: form.postalCode },
          shippingMethodId: shippingId ?? "",
          paymentMethod: payment,
          customerNote: notes,
          acceptTerms: terms,
          saveAddress: Boolean(user) && addressId === "new" && saveAddress,
          marketingOptIn: marketing,
        },
        locale,
      );
      if (!res.ok) {
        setErrors(res.fieldErrors ?? {});
        const checkoutErr = t.has(`checkout.errors.${res.error}` as never) ? t(`checkout.errors.${res.error}` as never) : errorMessage(res);
        toast.error(checkoutErr);
        if (res.error === "cart_has_issues" || res.error === "insufficient_stock") void refresh();
        document.querySelector("[aria-invalid=true]")?.scrollIntoView({ behavior: "smooth", block: "center" });
        return;
      }
      setCartCount(0);
      // Full navigation: either the hosted payment page or the confirmation page.
      window.location.assign(res.data.redirectUrl);
    });
  };

  const summary = (
    <div className="space-y-5">
      <MiniLines totals={totals} />
      <CouponBox totals={totals} />
      <PointsBox totals={totals} />
      <SummaryLines totals={totals} shipping={shipping ? shipping.cost : null} compact />
    </div>
  );

  return (
    <form
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
      className="grid grid-cols-1 gap-8 pb-28 lg:grid-cols-[minmax(0,1fr)_420px] lg:pb-0"
    >
      {/* Mobile: collapsible summary with an always-visible total. */}
      <div className="lg:hidden">
        <button type="button" onClick={() => setSummaryOpen((o) => !o)} className="flex w-full items-center justify-between rounded-2xl bg-surface px-4 py-3.5 text-sm font-medium" aria-expanded={summaryOpen}>
          <span className="flex items-center gap-2">
            {t("checkout.summary")} <ChevronDown className={cn("size-4 transition", summaryOpen && "rotate-180")} />
          </span>
          <span className="tabular text-base font-semibold">{format(grand)}</span>
        </button>
        {summaryOpen && <div className="animate-fade-in mt-3 rounded-2xl border border-border p-4">{summary}</div>}
      </div>

      <div className="space-y-5">
        <SectionCard
          step={1}
          title={t("checkout.contact")}
          aside={
            !user ? (
              <Link href="/account/login?next=/checkout" className="text-sm text-accent hover:underline">
                {t("checkout.haveAccount")}
              </Link>
            ) : undefined
          }
        >
          <Field label={t("checkout.email")} hint={t("checkout.emailHint")} error={err("email")}>
            {(p) => <Input {...p} type="email" autoComplete="email" inputMode="email" value={form.email} onChange={set("email")} disabled={Boolean(user)} required />}
          </Field>
          {!user && <p className="mt-3 text-xs text-muted">{t("checkout.guestNotice")}</p>}
        </SectionCard>

        <SectionCard step={2} title={t("checkout.delivery")}>
          {addresses.length > 0 && (
            <div className="mb-5 grid gap-2 sm:grid-cols-2">
              {addresses.map((a) => (
                <button key={a.id} type="button" onClick={() => chooseAddress(a.id)} className={cn("rounded-2xl border p-4 text-start text-sm transition", addressId === a.id ? "border-fg ring-1 ring-fg" : "border-border hover:border-fg/30")}>
                  <span className="flex items-center gap-2 font-medium">
                    <MapPin className="size-4" /> {a.label || a.fullName}
                  </span>
                  <span className="mt-1 block text-muted">
                    {a.line1}, {a.city}
                  </span>
                </button>
              ))}
              <button type="button" onClick={() => setAddressId("new")} className={cn("rounded-2xl border border-dashed p-4 text-start text-sm font-medium transition", addressId === "new" ? "border-fg" : "border-border hover:border-fg/30")}>
                + {t("checkout.newAddress")}
              </button>
            </div>
          )}
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t("checkout.fullName")} error={err("fullName")}>
              {(p) => <Input {...p} autoComplete="name" value={form.fullName} onChange={set("fullName")} required />}
            </Field>
            <Field label={t("checkout.phone")} error={err("phone")}>
              {(p) => <PhoneInput {...p} value={form.phone} onChange={(v) => setForm((f) => ({ ...f, phone: v }))} defaultCountry={form.country} required />}
            </Field>
            <Field label={t("checkout.country")} error={err("country")}>
              {(p) => (
                <NativeSelect {...p} value={form.country} onChange={set("country")} autoComplete="country">
                  {countries.map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.name}
                    </option>
                  ))}
                </NativeSelect>
              )}
            </Field>
            <Field label={t("checkout.city")} error={err("city")}>
              {(p) => <Input {...p} autoComplete="address-level2" value={form.city} onChange={set("city")} required />}
            </Field>
            <Field label={t("checkout.address")} error={err("line1")} className="sm:col-span-2">
              {(p) => <Input {...p} autoComplete="address-line1" value={form.line1} onChange={set("line1")} required />}
            </Field>
            <Field label={t("checkout.area")} optional={t("common.optional")} error={err("area")}>
              {(p) => <Input {...p} autoComplete="address-level3" value={form.area} onChange={set("area")} />}
            </Field>
            <Field label={t("checkout.address2")} optional={t("common.optional")} error={err("line2")}>
              {(p) => <Input {...p} autoComplete="address-line2" value={form.line2} onChange={set("line2")} />}
            </Field>
            {settings.postalCode !== "hidden" && (
              <Field label={t("checkout.postalCode")} optional={settings.postalCode === "optional" ? t("common.optional") : undefined} error={err("postalCode")}>
                {(p) => <Input {...p} autoComplete="postal-code" inputMode="numeric" value={form.postalCode} onChange={set("postalCode")} />}
              </Field>
            )}
          </div>
          {user && addressId === "new" && <Checkbox className="mt-4" label={t("checkout.saveAddress")} checked={saveAddress} onChange={(e) => setSaveAddress(e.target.checked)} />}

          <h3 className="mb-3 mt-7 text-sm font-semibold">{t("checkout.shippingMethod")}</h3>
          {loadingQuotes && !quotes ? (
            <div className="flex items-center gap-2 py-4 text-sm text-muted">
              <Spinner className="size-4" /> {t("common.loading")}
            </div>
          ) : quotes && quotes.length === 0 ? (
            <p className="flex items-center gap-2 rounded-2xl bg-amber-50 p-4 text-sm text-amber-800">
              <AlertTriangle className="size-4" /> {t("checkout.noShipping")}
            </p>
          ) : (
            <div className="grid gap-2" role="radiogroup" aria-label={t("checkout.shippingMethod")}>
              {quotes?.map((q) => (
                <label key={q.id} className={cn("flex cursor-pointer items-center gap-4 rounded-2xl border p-4 transition", shippingId === q.id ? "border-fg ring-1 ring-fg" : "border-border hover:border-fg/30")}>
                  <input type="radio" name="shipping" className="sr-only" checked={shippingId === q.id} onChange={() => setShippingId(q.id)} />
                  <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-surface">{q.type === "PICKUP" ? <Store className="size-5" /> : <Truck className="size-5" />}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium">{q.name}</span>
                    <span className="block text-xs text-muted">
                      {q.minDays != null && q.maxDays != null ? (q.maxDays === 0 ? t("checkout.sameDay") : t("checkout.days", { min: q.minDays, max: q.maxDays })) : q.description}
                      {q.freeOverRemaining ? ` · ${t("cart.freeShippingProgress", { amount: format(q.freeOverRemaining) })}` : ""}
                    </span>
                  </span>
                  <span className="tabular text-sm font-semibold">
                    {q.free ? (
                      <span className="text-success">
                        {t("common.free")}
                        {q.originalCost > 0 && <s className="ms-1.5 text-xs font-normal text-muted">{format(q.originalCost)}</s>}
                      </span>
                    ) : (
                      format(q.cost)
                    )}
                  </span>
                </label>
              ))}
            </div>
          )}
          {err("shippingMethodId") && <p className="mt-2 text-xs font-medium text-red-600">{err("shippingMethodId")}</p>}
        </SectionCard>

        <SectionCard step={3} title={t("checkout.payment")}>
          <p className="-mt-2 mb-4 flex items-center gap-2 text-xs text-muted">
            <Lock className="size-3.5" /> {t("checkout.paymentSecure")}
          </p>
          <div className="grid gap-2" role="radiogroup" aria-label={t("checkout.payment")}>
            {payments.map((p) => (
              <label key={p.key} className={cn("block cursor-pointer rounded-2xl border transition", payment === p.key ? "border-fg ring-1 ring-fg" : "border-border hover:border-fg/30")}>
                <span className="flex items-center gap-4 p-4">
                  <input type="radio" name="payment" className="sr-only" checked={payment === p.key} onChange={() => setPayment(p.key)} />
                  <span className={cn("grid size-5 shrink-0 place-items-center rounded-full border-2", payment === p.key ? "border-fg" : "border-border")}>{payment === p.key && <span className="size-2.5 rounded-full bg-fg" />}</span>
                  <span className="flex-1 text-sm font-medium">{p.title}</span>
                  {p.testMode && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold uppercase text-amber-800">{t("checkout.testMode")}</span>}
                  <span className="text-muted">{PAY_ICONS[p.key] ?? <CreditCard className="size-5" />}</span>
                </span>
                {payment === p.key && p.instructions && <span className="animate-fade-in block border-t border-border px-4 py-3 text-sm whitespace-pre-line text-muted">{p.instructions}</span>}
              </label>
            ))}
          </div>
          {settings.allowNotes && (
            <Field label={t("checkout.notes")} optional={t("common.optional")} className="mt-6">
              {(p) => <Textarea {...p} rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder={t("checkout.notesPlaceholder")} maxLength={1000} />}
            </Field>
          )}
          <div className="mt-6 space-y-3">
            {settings.requireTerms && (
              <div>
                <Checkbox
                  checked={terms}
                  onChange={(e) => setTerms(e.target.checked)}
                  aria-invalid={Boolean(errors.acceptTerms) || undefined}
                  label={t.rich("checkout.terms", {
                    terms: () => (
                      <Link href="/terms" target="_blank" className="underline">
                        {t("checkout.termsLink")}
                      </Link>
                    ),
                    privacy: () => (
                      <Link href="/privacy" target="_blank" className="underline">
                        {t("checkout.privacyLink")}
                      </Link>
                    ),
                  })}
                />
                {errors.acceptTerms && <p className="ms-8 mt-1 text-xs font-medium text-red-600">{t("errors.required")}</p>}
              </div>
            )}
            <Checkbox label={t("checkout.marketing")} checked={marketing} onChange={(e) => setMarketing(e.target.checked)} />
          </div>
        </SectionCard>

        <div className="hidden lg:block">
          <Button type="submit" size="xl" block loading={placing} disabled={!shipping || !payment || totals.hasIssues} leftIcon={<Lock />}>
            {placing ? t("checkout.placing") : selectedPayment?.online ? t("checkout.payNow", { total: format(grand) }) : t("checkout.placeOrder", { total: format(grand) })}
          </Button>
        </div>
      </div>

      <aside className="hidden lg:block">
        <div className="sticky top-28 rounded-[calc(var(--nq-radius)*1.4)] border border-border bg-bg p-6">
          <div className="mb-5 flex items-center justify-between">
            <h2 className="text-lg font-semibold">{t("checkout.summary")}</h2>
            <Link href="/cart" className="text-sm text-muted hover:text-fg">
              {t("checkout.editCart")}
            </Link>
          </div>
          {summary}
          <p className="mt-5 flex items-center justify-center gap-1.5 text-xs text-muted">
            <Check className="size-3.5 text-success" /> {t("product.genuine")}
          </p>
        </div>
      </aside>

      {/* Sticky mobile action bar: the final total is always visible. */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-bg/95 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur-lg lg:hidden">
        <Button type="submit" size="lg" block loading={placing} disabled={!shipping || !payment || totals.hasIssues} leftIcon={<Lock />}>
          {placing ? t("checkout.placing") : selectedPayment?.online ? t("checkout.payNow", { total: format(grand) }) : t("checkout.placeOrder", { total: format(grand) })}
        </Button>
      </div>
    </form>
  );
}

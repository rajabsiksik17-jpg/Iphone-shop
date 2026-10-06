"use client";

import { useState, useTransition } from "react";
import { Printer, Copy, MessageCircle, Mail, Phone, Truck, CreditCard, RotateCcw, CheckCircle2, StickyNote, User } from "lucide-react";
import { toast } from "sonner";
import { Link, useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/overlay";
import { useAdmin } from "../admin-context";
import { PageHeader, Panel, ColorPill, Pill, Switch } from "../ui";
import { Label, Select, TextInput, TextArea, MoneyInput } from "../fields";
import { PAY_TONE } from "./list";
import { updateOrderStatusAction, markOrderPaidAction, addOrderNoteAction, refundOrderAction } from "@/actions/admin/orders";
import { fmtDate, timeAgo } from "@/lib/time";
import { cn } from "@/lib/utils";
import type { OrderDetail } from "@/server/admin/orders";

export function OrderDetailView({ order }: { order: OrderDetail }) {
  const { t, fmt, locale, can, money } = useAdmin();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [status, setStatus] = useState(order.status.key);
  const [notify, setNotify] = useState(order.statuses.find((s) => s.key === order.status.key)?.notifyCustomer ?? true);
  const [statusNote, setStatusNote] = useState("");
  const [tracking, setTracking] = useState(order.tracking);
  const [note, setNote] = useState("");
  const [noteInternal, setNoteInternal] = useState(true);
  const [notes, setNotes] = useState(order.notes);
  const [paidOpen, setPaidOpen] = useState(false);
  const [paidRef, setPaidRef] = useState("");
  const [refundOpen, setRefundOpen] = useState(false);
  const refundable = order.totals.total - order.totals.refunded;
  const [refund, setRefund] = useState<{ amount: number | null; reason: string; restock: Record<string, number>; notify: boolean }>({ amount: refundable, reason: "", restock: {}, notify: true });
  const manage = can("orders.manage");
  const a = order.address;
  const addressText = [a.fullName, a.line1, a.line2, [a.area, a.city].filter(Boolean).join(", "), a.country, a.phone].filter(Boolean).join("\n");
  const waNumber = order.customer.phone.replace(/[^\d]/g, "");

  const saveStatus = () =>
    start(async () => {
      const r = await updateOrderStatusAction({ orderId: order.id, status, note: statusNote || undefined, notify, tracking });
      if (r.ok) {
        toast.success(t("o.statusUpdated"));
        setStatusNote("");
        router.refresh();
      } else toast.error(t("c.error"));
    });

  return (
    <>
      <PageHeader
        back={{ href: "/admin/orders", label: t("o.title") }}
        title={
          <span className="flex flex-wrap items-center gap-3">
            {order.number}
            <ColorPill label={order.status.label} color={order.status.color} />
            <Pill tone={PAY_TONE[order.paymentStatus]}>{t(`o.pay.${order.paymentStatus}` as "o.pay.PAID")}</Pill>
          </span>
        }
        description={`${fmtDate(order.placedAt, locale, true)} · ${timeAgo(order.placedAt, locale)}`}
        actions={
          <>
            <Button variant="outline" size="sm" leftIcon={<Printer />} onClick={() => window.open(`/api/admin/orders/${order.id}/invoice?locale=${locale}`, "_blank")}>
              {t("o.print")}
            </Button>
            {manage && (order.paymentStatus === "UNPAID" || order.paymentStatus === "PENDING" || order.paymentStatus === "FAILED") && (
              <Button size="sm" leftIcon={<CheckCircle2 />} onClick={() => setPaidOpen(true)}>
                {t("o.markPaid")}
              </Button>
            )}
            {can("orders.refund") && refundable > 0 && (
              <Button variant="outline" size="sm" leftIcon={<RotateCcw />} onClick={() => setRefundOpen(true)}>
                {t("o.refund")}
              </Button>
            )}
          </>
        }
      />

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-4">
          <Panel title={`${t("o.items")} (${order.items.length})`} padded={false}>
            <ul className="divide-y divide-ad-border">
              {order.items.map((i) => (
                <li key={i.id} className="flex items-center gap-4 px-5 py-3.5">
                  {i.image ? <img src={i.image} alt="" className="size-14 shrink-0 rounded-lg bg-ad-sunken object-cover" /> : <span className="size-14 shrink-0 rounded-lg bg-ad-sunken" />}
                  <div className="min-w-0 flex-1">
                    {i.productId ? (
                      <Link href={`/admin/products/${i.productId}`} className="text-sm font-medium hover:underline">
                        {i.name}
                      </Link>
                    ) : (
                      <p className="text-sm font-medium">{i.name}</p>
                    )}
                    <p className="text-xs text-ad-muted">
                      {[i.variant, i.sku].filter(Boolean).join(" · ")}
                      {i.refundedQty > 0 && <span className="ms-2 text-violet-600">↩ {i.refundedQty}</span>}
                    </p>
                  </div>
                  <span className="tabular text-sm text-ad-muted">
                    {fmt(i.unitPrice)} × {i.quantity}
                  </span>
                  <span className="tabular w-24 text-end text-sm font-semibold">{fmt(i.total)}</span>
                </li>
              ))}
            </ul>
            <dl className="space-y-1.5 border-t border-ad-border px-5 py-4 text-sm">
              {(
                [
                  ["o.subtotal", order.totals.subtotal],
                  ...order.discounts.map((d) => [d.label, -d.amount] as const),
                  ["o.shipping", order.totals.shipping],
                  ...(order.totals.tax ? [["o.tax", order.totals.tax] as const] : []),
                ] as [string, number][]
              ).map(([k, v]) => (
                <div key={k} className="flex justify-between">
                  <dt className="text-ad-muted">{k.startsWith("o.") ? t(k as "o.subtotal") : k}</dt>
                  <dd className={cn("tabular", v < 0 && "text-emerald-600")}>{v < 0 ? `-${fmt(-v)}` : fmt(v)}</dd>
                </div>
              ))}
              <div className="flex justify-between border-t border-ad-border pt-2 text-base font-semibold">
                <dt>{t("c.total")}</dt>
                <dd className="tabular">{fmt(order.totals.total)}</dd>
              </div>
              {order.totals.refunded > 0 && (
                <>
                  <div className="flex justify-between text-violet-600">
                    <dt>{t("o.refundedTotal")}</dt>
                    <dd className="tabular">-{fmt(order.totals.refunded)}</dd>
                  </div>
                  <div className="flex justify-between font-medium">
                    <dt>{t("o.net")}</dt>
                    <dd className="tabular">{fmt(order.totals.total - order.totals.refunded)}</dd>
                  </div>
                </>
              )}
            </dl>
          </Panel>

          {manage && (
            <Panel title={t("o.changeStatus")}>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label>{t("c.status")}</Label>
                  <Select
                    value={status}
                    onChange={(e) => {
                      setStatus(e.target.value);
                      setNotify(order.statuses.find((s) => s.key === e.target.value)?.notifyCustomer ?? true);
                    }}
                  >
                    {order.statuses.map((s) => (
                      <option key={s.key} value={s.key}>
                        {s.label}
                      </option>
                    ))}
                  </Select>
                </div>
                <div>
                  <Label optional>{t("o.statusNote")}</Label>
                  <TextInput value={statusNote} onChange={(e) => setStatusNote(e.target.value)} />
                </div>
              </div>
              <div className="mt-4 rounded-lg border border-ad-border p-4">
                <p className="mb-3 flex items-center gap-2 text-sm font-medium">
                  <Truck className="size-4 text-ad-muted" /> {t("o.tracking")}
                </p>
                <div className="grid gap-3 sm:grid-cols-3">
                  <TextInput placeholder={t("o.carrier")} value={tracking.carrier} onChange={(e) => setTracking({ ...tracking, carrier: e.target.value })} />
                  <TextInput placeholder={t("o.trackingNumber")} value={tracking.number} onChange={(e) => setTracking({ ...tracking, number: e.target.value })} dir="ltr" />
                  <TextInput placeholder={t("o.trackingUrl")} value={tracking.url} onChange={(e) => setTracking({ ...tracking, url: e.target.value })} dir="ltr" type="url" />
                </div>
              </div>
              <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                <Switch checked={notify} onCheckedChange={setNotify} label={t("o.notifyCustomer")} />
                <Button onClick={saveStatus} loading={pending}>
                  {t("c.saveChanges")}
                </Button>
              </div>
            </Panel>
          )}

          <Panel title={t("o.timeline")}>
            <ol className="relative space-y-5 border-s border-ad-border ps-6">
              {[...order.history].reverse().map((h, i) => (
                <li key={h.id} className="relative">
                  <span className={cn("absolute -start-[31px] top-0.5 size-3.5 rounded-full ring-4 ring-ad-panel", i === 0 ? "bg-ad-accent" : "bg-ad-border")} />
                  <p className="text-sm font-medium">
                    {h.from ? `${h.from} → ` : ""}
                    {h.to}
                  </p>
                  <p className="text-xs text-ad-muted">
                    {fmtDate(h.at, locale, true)}
                    {h.by ? ` · ${h.by}` : ""}
                    {h.notified ? ` · ✉︎` : ""}
                  </p>
                  {h.note && <p className="mt-1 text-[13px] text-ad-fg/80">{h.note}</p>}
                </li>
              ))}
            </ol>
          </Panel>
        </div>

        <div className="space-y-4">
          <Panel
            title={t("o.customer")}
            actions={
              order.customer.user && can("customers.view") ? (
                <Link href={`/admin/customers/${order.customer.user.id}`} className="text-xs text-ad-muted hover:text-ad-fg">
                  {t("c.view")}
                </Link>
              ) : (
                <Pill>{t("o.guest")}</Pill>
              )
            }
          >
            <p className="flex items-center gap-2 font-medium">
              <User className="size-4 text-ad-muted" /> {order.customer.name}
            </p>
            {order.customer.user && <p className="mt-0.5 text-xs text-ad-muted">{t("o.ordersBy", { n: order.customer.user.orders })}</p>}
            <div className="mt-3 space-y-1.5 text-sm">
              <a href={order.pii ? `mailto:${order.customer.email}` : undefined} className="flex items-center gap-2 text-ad-fg/80 hover:text-ad-fg">
                <Mail className="size-4 text-ad-muted" /> {order.customer.email}
              </a>
              <a href={order.pii ? `tel:${order.customer.phone}` : undefined} className="flex items-center gap-2 text-ad-fg/80 hover:text-ad-fg" dir="ltr">
                <Phone className="size-4 text-ad-muted" /> {order.customer.phone}
              </a>
            </div>
            {order.pii && waNumber && (
              <a href={`https://wa.me/${waNumber}?text=${encodeURIComponent(`${order.number}`)}`} target="_blank" rel="noopener noreferrer" className="mt-3 flex items-center gap-2 text-[13px] font-medium text-emerald-600 hover:underline">
                <MessageCircle className="size-4" /> {t("o.whatsapp")}
              </a>
            )}
          </Panel>

          <Panel
            title={t("o.shippingAddress")}
            actions={
              order.pii ? (
                <button type="button" onClick={() => (navigator.clipboard.writeText(addressText), toast.success(t("c.copied")))} className="text-ad-muted hover:text-ad-fg" aria-label={t("o.copyAddress")}>
                  <Copy className="size-4" />
                </button>
              ) : undefined
            }
          >
            <p className="whitespace-pre-line text-sm leading-relaxed">{addressText}</p>
            <p className="mt-3 text-xs text-ad-muted">
              {t("o.shippingMethod")}: <span className="text-ad-fg">{order.shippingMethod}</span>
            </p>
            {order.customerNote && (
              <div className="mt-3 rounded-lg bg-amber-500/10 p-3 text-[13px]">
                <p className="mb-0.5 font-medium text-amber-700 dark:text-amber-400">{t("o.customerNote")}</p>
                {order.customerNote}
              </div>
            )}
          </Panel>

          <Panel title={t("o.payments")}>
            <p className="flex items-center gap-2 text-sm">
              <CreditCard className="size-4 text-ad-muted" /> {order.paymentMethod}
            </p>
            {order.payments.length > 0 && (
              <ul className="mt-3 space-y-2">
                {order.payments.map((p) => (
                  <li key={p.id} className="rounded-lg border border-ad-border p-3 text-xs">
                    <div className="flex justify-between">
                      <span className="font-medium">
                        {p.provider} {p.mode === "test" && p.provider !== "cod" && p.provider !== "bank_transfer" ? <Pill tone="amber">test</Pill> : null}
                      </span>
                      <span className="tabular">{fmt(p.amount)}</span>
                    </div>
                    <p className="mt-1 text-ad-muted">
                      {p.status} · {fmtDate(p.at, locale, true)}
                    </p>
                    {p.ref && <p className="mt-0.5 truncate font-mono text-[10.5px] text-ad-muted">{p.ref}</p>}
                    {p.error && <p className="mt-1 text-red-600">{p.error}</p>}
                  </li>
                ))}
              </ul>
            )}
            {order.refunds.length > 0 && (
              <ul className="mt-3 space-y-1.5 text-xs">
                {order.refunds.map((r) => (
                  <li key={r.id} className="flex justify-between text-violet-600">
                    <span>
                      ↩ {r.reason || t("o.refund")} {r.status === "manual" ? "(manual)" : ""}
                    </span>
                    <span className="tabular">-{fmt(r.amount)}</span>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <Panel title={t("o.notes")}>
            {manage && (
              <div className="space-y-2">
                <TextArea rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder={t("o.addNote")} />
                <div className="flex items-center justify-between">
                  <Switch checked={noteInternal} onCheckedChange={setNoteInternal} label={t("o.internal")} />
                  <Button
                    size="sm"
                    disabled={!note.trim()}
                    loading={pending}
                    onClick={() =>
                      start(async () => {
                        const r = await addOrderNoteAction(order.id, note, noteInternal);
                        if (r.ok) {
                          setNotes([r.data, ...notes]);
                          setNote("");
                        }
                      })
                    }
                  >
                    {t("c.add")}
                  </Button>
                </div>
              </div>
            )}
            <ul className="mt-4 space-y-3">
              {notes.map((n) => (
                <li key={n.id} className="rounded-lg bg-ad-sunken p-3 text-[13px]">
                  <p className="whitespace-pre-wrap">{n.body}</p>
                  <p className="mt-1.5 flex items-center gap-1.5 text-[11px] text-ad-muted">
                    <StickyNote className="size-3" /> {n.author} · {timeAgo(n.createdAt, locale)} {n.isInternal && `· ${t("o.internal")}`}
                  </p>
                </li>
              ))}
            </ul>
          </Panel>
        </div>
      </div>

      <Modal open={paidOpen} onOpenChange={setPaidOpen} title={t("o.markPaid")} description={t("o.markPaidHint")}>
        <Label optional>{t("o.reference")}</Label>
        <TextInput value={paidRef} onChange={(e) => setPaidRef(e.target.value)} />
        <Button
          block
          className="mt-4"
          loading={pending}
          onClick={() =>
            start(async () => {
              const r = await markOrderPaidAction(order.id, paidRef || undefined);
              if (r.ok) {
                toast.success(t("o.statusUpdated"));
                setPaidOpen(false);
                router.refresh();
              } else toast.error(t("c.error"));
            })
          }
        >
          {t("c.confirm")}
        </Button>
      </Modal>

      <Modal open={refundOpen} onOpenChange={setRefundOpen} title={t("o.refund")} description={t("o.refundMax", { amount: fmt(refundable) })}>
        <div className="space-y-4">
          <div>
            <Label>{t("o.refundAmount")}</Label>
            <MoneyInput value={refund.amount} onChange={(v) => setRefund({ ...refund, amount: v })} decimals={money.base.decimals} symbol={money.display.symbol} />
          </div>
          <div>
            <Label optional>{t("o.refundReason")}</Label>
            <TextInput value={refund.reason} onChange={(e) => setRefund({ ...refund, reason: e.target.value })} />
          </div>
          <div>
            <Label>{t("o.restock")}</Label>
            <ul className="space-y-2">
              {order.items
                .filter((i) => i.productId && i.quantity - i.refundedQty > 0)
                .map((i) => (
                  <li key={i.id} className="flex items-center justify-between gap-3 text-sm">
                    <span className="truncate">{i.name}</span>
                    <input
                      type="number"
                      min={0}
                      max={i.quantity - i.refundedQty}
                      value={refund.restock[i.id] ?? 0}
                      onChange={(e) => setRefund({ ...refund, restock: { ...refund.restock, [i.id]: Math.min(i.quantity - i.refundedQty, Math.max(0, Number(e.target.value))) } })}
                      className="h-9 w-20 rounded-lg border border-ad-border bg-ad-panel px-2 text-center"
                      aria-label={i.name}
                    />
                  </li>
                ))}
            </ul>
          </div>
          <Switch checked={refund.notify} onCheckedChange={(v) => setRefund({ ...refund, notify: v })} label={t("o.notifyCustomer")} />
          <Button
            block
            variant="danger"
            loading={pending}
            disabled={!refund.amount || refund.amount > refundable}
            onClick={() =>
              start(async () => {
                const r = await refundOrderAction({
                  orderId: order.id,
                  amount: refund.amount!,
                  reason: refund.reason || undefined,
                  notify: refund.notify,
                  restockItems: Object.entries(refund.restock)
                    .filter(([, q]) => q > 0)
                    .map(([itemId, quantity]) => ({ itemId, quantity })),
                });
                if (r.ok) {
                  toast.success(r.data.manual ? t("o.refundManual") : t("o.refunded"));
                  setRefundOpen(false);
                  router.refresh();
                } else toast.error(r.meta?.message ? String(r.meta.message) : t("c.error"));
              })
            }
          >
            {t("o.refund")} {refund.amount ? fmt(refund.amount) : ""}
          </Button>
        </div>
      </Modal>
    </>
  );
}

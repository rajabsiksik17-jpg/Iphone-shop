"use client";

import { useEffect, useState, useTransition } from "react";
import { Mail, Phone, MapPin, Ban, RotateCcw, Coins, Heart, ShoppingCart, MessagesSquare, Star, Users } from "lucide-react";
import { toast } from "sonner";
import { Link, useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/overlay";
import { useAdmin } from "../admin-context";
import { PageHeader, Panel, DataTable, FilterTabs, SearchBox, Pager, Pill, ColorPill, StatCard, AdminEmpty } from "../ui";
import { Label, TextInput } from "../fields";
import { setCustomerStatusAction, adjustPointsAction } from "@/actions/admin/operations";
import { markSeenAction } from "@/actions/admin/shell";
import { timeAgo, fmtDate } from "@/lib/time";
import type { customerList, CustomerDetail } from "@/server/admin/operations";

type List = Awaited<ReturnType<typeof customerList>>;

export function CustomersList({ data }: { data: List }) {
  const { t, fmt, locale, refreshCounters } = useAdmin();
  useEffect(() => {
    // Viewing the list clears the "new customers" badge.
    markSeenAction("customers").then(refreshCounters);
  }, [refreshCounters]);
  return (
    <>
      <PageHeader title={t("cu.title")} />
      <div className="mb-4">
        <FilterTabs
          param="status"
          options={[
            { value: "", label: t("c.all") },
            { value: "subscribed", label: t("cu.subscribed") },
            { value: "suspended", label: t("cu.suspended") },
          ]}
        />
      </div>
      <Panel padded={false}>
        <div className="border-b border-ad-border p-3">
          <SearchBox placeholder={locale === "ar" ? "الاسم، البريد، الهاتف…" : "Name, email, phone…"} />
        </div>
        <DataTable
          rows={data.rows}
          href={(r) => `/admin/customers/${r.id}`}
          empty={<AdminEmpty icon={<Users />} />}
          columns={[
            {
              key: "n",
              header: t("c.name"),
              cell: (r) => (
                <div className="flex items-center gap-3">
                  <span className="grid size-9 shrink-0 place-items-center rounded-full bg-ad-sunken text-sm font-semibold">{r.name.slice(0, 1)}</span>
                  <div className="min-w-0">
                    <p className="truncate font-medium">
                      {r.name} {r.status === "SUSPENDED" && <Pill tone="red">{t("cu.suspended")}</Pill>}
                    </p>
                    <p className="truncate text-xs text-ad-muted">{r.email}</p>
                  </div>
                </div>
              ),
            },
            { key: "o", header: t("cu.ordersCount"), align: "center", cell: (r) => r.orders },
            { key: "s", header: t("cu.spent"), align: "end", cell: (r) => <span className="tabular">{fmt(r.spent)}</span> },
            { key: "l", header: t("cu.lastOrder"), cell: (r) => <span className="text-ad-muted">{r.lastOrder ? timeAgo(r.lastOrder, locale) : "—"}</span> },
            { key: "c", header: t("cu.since"), cell: (r) => <span className="text-ad-muted">{fmtDate(r.createdAt, locale)}</span> },
          ]}
          mobile={(r) => (
            <div className="flex items-center gap-3">
              <span className="grid size-10 shrink-0 place-items-center rounded-full bg-ad-sunken font-semibold">{r.name.slice(0, 1)}</span>
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{r.name}</p>
                <p className="truncate text-xs text-ad-muted">{r.email}</p>
              </div>
              <div className="text-end text-xs">
                <p className="tabular font-semibold">{fmt(r.spent)}</p>
                <p className="text-ad-muted">{t("o.ordersBy", { n: r.orders })}</p>
              </div>
            </div>
          )}
        />
        <Pager page={data.page} pageCount={data.pageCount} total={data.total} />
      </Panel>
    </>
  );
}

export function CustomerView({ c }: { c: CustomerDetail }) {
  const { t, fmt, locale, can } = useAdmin();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [pointsOpen, setPointsOpen] = useState(false);
  const [delta, setDelta] = useState(0);
  const [note, setNote] = useState("");
  return (
    <>
      <PageHeader
        back={{ href: "/admin/customers", label: t("cu.title") }}
        title={
          <span className="flex items-center gap-3">
            {c.name} {c.status === "SUSPENDED" && <Pill tone="red">{t("cu.suspended")}</Pill>}
          </span>
        }
        description={`${t("cu.since")} ${fmtDate(c.createdAt, locale)}${c.lastLoginAt ? ` · ${locale === "ar" ? "آخر دخول" : "Last seen"} ${timeAgo(c.lastLoginAt, locale)}` : ""}`}
        actions={
          can("customers.manage") && (
            <>
              <Button size="sm" variant="outline" leftIcon={<Coins />} onClick={() => setPointsOpen(true)}>
                {t("cu.adjustPoints")}
              </Button>
              <Button
                size="sm"
                variant={c.status === "SUSPENDED" ? "primary" : "outline"}
                className={c.status === "SUSPENDED" ? "" : "text-red-600"}
                loading={pending}
                leftIcon={c.status === "SUSPENDED" ? <RotateCcw /> : <Ban />}
                onClick={() => start(async () => { await setCustomerStatusAction(c.id, c.status === "SUSPENDED" ? "ACTIVE" : "SUSPENDED"); router.refresh(); })}
              >
                {c.status === "SUSPENDED" ? t("cu.reactivate") : t("cu.suspend")}
              </Button>
            </>
          )
        }
      />
      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label={t("cu.ordersCount")} value={c.stats.orders} />
        <StatCard label={t("cu.spent")} value={fmt(c.stats.spent)} />
        <StatCard label={t("cu.aov")} value={fmt(c.stats.aov)} />
        <StatCard label={t("cu.points")} value={c.points.balance.toLocaleString()} />
      </div>
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="space-y-4">
          <Panel title={t("nav.orders")} padded={false}>
            {c.orders.length ? (
              <ul className="divide-y divide-ad-border">
                {c.orders.map((o) => (
                  <li key={o.id}>
                    <Link href={`/admin/orders/${o.id}`} className="flex items-center gap-3 px-5 py-3 text-sm hover:bg-ad-hover">
                      <span className="w-24 font-medium">{o.number}</span>
                      <span className="flex-1 text-ad-muted">{fmtDate(o.placedAt, locale)}</span>
                      <ColorPill label={o.status.label} color={o.status.color} />
                      <span className="tabular w-24 text-end font-medium">{fmt(o.total)}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <AdminEmpty />
            )}
          </Panel>
          <Panel title={t("nav.reviews")} padded={false}>
            <ul className="divide-y divide-ad-border">
              {c.reviews.map((r) => (
                <li key={r.id} className="px-5 py-3 text-sm">
                  <p className="flex items-center gap-2">
                    <Star className="size-3.5 fill-amber-400 text-amber-400" />
                    {r.rating} · <span className="text-ad-muted">{r.product}</span>
                    <Pill>{r.status}</Pill>
                  </p>
                  <p className="mt-1 line-clamp-2 text-ad-fg/80">{r.body}</p>
                </li>
              ))}
              {!c.reviews.length && <li className="px-5 py-6 text-center text-sm text-ad-muted">{t("c.empty")}</li>}
            </ul>
          </Panel>
          <Panel title={t("cu.points")} padded={false}>
            <ul className="divide-y divide-ad-border">
              {c.points.history.map((p) => (
                <li key={p.id} className="flex justify-between px-5 py-2.5 text-sm">
                  <span>
                    {p.reason}
                    {p.note && <span className="text-ad-muted"> · {p.note}</span>}
                  </span>
                  <span className={p.delta > 0 ? "tabular text-emerald-600" : "tabular text-red-600"}>
                    {p.delta > 0 ? "+" : ""}
                    {p.delta}
                  </span>
                </li>
              ))}
              {!c.points.history.length && <li className="px-5 py-6 text-center text-sm text-ad-muted">{t("c.empty")}</li>}
            </ul>
          </Panel>
        </div>
        <div className="space-y-4">
          <Panel title={t("chat.customerInfo")}>
            {c.pii ? (
              <div className="space-y-2 text-sm">
                <a href={`mailto:${c.email}`} className="flex items-center gap-2 hover:underline">
                  <Mail className="size-4 text-ad-muted" /> {c.email}
                </a>
                {c.phone && (
                  <a href={`tel:${c.phone}`} className="flex items-center gap-2 hover:underline" dir="ltr">
                    <Phone className="size-4 text-ad-muted" /> {c.phone}
                  </a>
                )}
              </div>
            ) : (
              <p className="text-xs text-ad-muted">{t("cu.piiHidden")}</p>
            )}
            <p className="mt-3 text-xs text-ad-muted">
              {t("cu.marketing")}: <b className="text-ad-fg">{c.marketingOptIn ? t("cu.subscribed") : t("cu.notSubscribed")}</b> · {c.locale.toUpperCase()}
            </p>
          </Panel>
          {c.addresses.length > 0 && (
            <Panel title={t("cu.addresses")}>
              <ul className="space-y-2 text-[13px]">
                {c.addresses.map((a) => (
                  <li key={a.id} className="flex gap-2">
                    <MapPin className="mt-0.5 size-4 shrink-0 text-ad-muted" />
                    <span>
                      {a.text} {a.isDefault && <Pill>{locale === "ar" ? "افتراضي" : "Default"}</Pill>}
                    </span>
                  </li>
                ))}
              </ul>
            </Panel>
          )}
          <Panel title={t("cu.cart")}>
            {c.cart.length ? (
              <ul className="space-y-1 text-[13px]">
                {c.cart.map((i, k) => (
                  <li key={k} className="flex items-center gap-2">
                    <ShoppingCart className="size-3.5 text-ad-muted" /> {i.name} × {i.quantity}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-ad-muted">{t("c.empty")}</p>
            )}
            {c.wishlist.length > 0 && (
              <ul className="mt-3 space-y-1 border-t border-ad-border pt-3 text-[13px]">
                {c.wishlist.map((w) => (
                  <li key={w.id} className="flex items-center gap-2">
                    <Heart className="size-3.5 text-ad-muted" /> {w.name}
                  </li>
                ))}
              </ul>
            )}
          </Panel>
          {c.conversations.length > 0 && (
            <Panel title={t("cu.chats")}>
              <ul className="space-y-1.5 text-[13px]">
                {c.conversations.map((cv) => (
                  <li key={cv.id}>
                    <Link href={`/admin/chat?c=${cv.id}`} className="flex items-center gap-2 hover:underline">
                      <MessagesSquare className="size-3.5 text-ad-muted" /> {cv.subject}
                    </Link>
                  </li>
                ))}
              </ul>
            </Panel>
          )}
        </div>
      </div>
      <Modal open={pointsOpen} onOpenChange={setPointsOpen} title={t("cu.adjustPoints")} description={`${t("cu.points")}: ${c.points.balance}`}>
        <div className="space-y-3">
          <div>
            <Label hint={locale === "ar" ? "سالب للخصم" : "Negative to deduct"}>{t("c.value")}</Label>
            <TextInput type="number" value={delta} onChange={(e) => setDelta(Number(e.target.value))} />
          </div>
          <div>
            <Label>{t("c.note")}</Label>
            <TextInput value={note} onChange={(e) => setNote(e.target.value)} />
          </div>
          <Button
            block
            loading={pending}
            disabled={!delta || !note}
            onClick={() =>
              start(async () => {
                const r = await adjustPointsAction(c.id, delta, note);
                if (r.ok) {
                  toast.success(t("c.saved"));
                  setPointsOpen(false);
                  router.refresh();
                }
              })
            }
          >
            {t("c.save")}
          </Button>
        </div>
      </Modal>
    </>
  );
}

"use client";

import { Area, AreaChart, Bar, BarChart, CartesianGrid, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useAdmin } from "./admin-context";

/** Shared chart styling: theme-aware colours, compact axes, RTL-safe tooltips. */
function TooltipBox({ active, payload, label, format }: { active?: boolean; payload?: { name: string; value: number; color: string; dataKey: string }[]; label?: string; format: (dataKey: string, v: number) => string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-ad-border bg-ad-panel px-3 py-2 text-xs shadow-pop">
      <p className="mb-1 font-medium">{label}</p>
      {payload.map((p) => (
        <p key={p.dataKey} className="flex items-center gap-2">
          <span className="size-2 rounded-full" style={{ backgroundColor: p.color }} />
          <span className="text-ad-muted">{p.name}</span>
          <span className="tabular ms-auto font-semibold">{format(p.dataKey, p.value)}</span>
        </p>
      ))}
    </div>
  );
}

const shortDate = (s: string, locale: string) => (/^\d{4}-\d{2}-\d{2}$/.test(s) ? new Date(`${s}T00:00:00`).toLocaleDateString(locale === "ar" ? "ar-SA-u-ca-gregory-nu-latn" : "en-GB", { day: "numeric", month: "short" }) : s);

export function RevenueChart({ data, height = 280 }: { data: { label: string; revenue: number; previous: number }[]; height?: number }) {
  const { fmt, locale, t } = useAdmin();
  const compact = (v: number) => new Intl.NumberFormat(locale === "ar" ? "ar-SA-u-ca-gregory-nu-latn" : "en", { notation: "compact", maximumFractionDigits: 1 }).format(v / 1000);
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="rev" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--ad-accent)" stopOpacity={0.28} />
            <stop offset="100%" stopColor="var(--ad-accent)" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid vertical={false} stroke="var(--ad-border)" strokeDasharray="3 4" />
        <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fontSize: 11 }} tickFormatter={(v) => shortDate(v, locale)} minTickGap={24} reversed={locale === "ar"} />
        <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 11 }} width={40} tickFormatter={compact} orientation={locale === "ar" ? "right" : "left"} />
        <Tooltip cursor={{ stroke: "var(--ad-border)" }} content={<TooltipBox format={(_, v) => fmt(v)} />} labelFormatter={(l) => shortDate(String(l), locale)} />
        <Line type="monotone" dataKey="previous" name={t("c.vsPrevious")} stroke="var(--ad-muted)" strokeOpacity={0.5} strokeDasharray="4 4" dot={false} strokeWidth={1.5} isAnimationActive={false} />
        <Area type="monotone" dataKey="revenue" name={t("dash.revenue")} stroke="var(--ad-accent)" strokeWidth={2.2} fill="url(#rev)" activeDot={{ r: 4 }} />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function OrdersChart({ data, height = 220 }: { data: { label: string; orders: number }[]; height?: number }) {
  const { locale, t } = useAdmin();
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid vertical={false} stroke="var(--ad-border)" strokeDasharray="3 4" />
        <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fontSize: 11 }} tickFormatter={(v) => shortDate(v, locale)} minTickGap={24} reversed={locale === "ar"} />
        <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 11 }} width={28} allowDecimals={false} orientation={locale === "ar" ? "right" : "left"} />
        <Tooltip cursor={{ fill: "var(--ad-hover)" }} content={<TooltipBox format={(_, v) => String(v)} />} labelFormatter={(l) => shortDate(String(l), locale)} />
        <Bar dataKey="orders" name={t("dash.orders")} fill="var(--ad-accent)" radius={[4, 4, 0, 0]} maxBarSize={28} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function SimpleBars({ data, height = 220, valueLabel, format }: { data: { label: string; value: number }[]; height?: number; valueLabel: string; format?: (v: number) => string }) {
  const { locale } = useAdmin();
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid vertical={false} stroke="var(--ad-border)" strokeDasharray="3 4" />
        <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fontSize: 11 }} tickFormatter={(v) => shortDate(v, locale)} minTickGap={16} reversed={locale === "ar"} />
        <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 11 }} width={32} allowDecimals={false} orientation={locale === "ar" ? "right" : "left"} />
        <Tooltip cursor={{ fill: "var(--ad-hover)" }} content={<TooltipBox format={(_, v) => (format ? format(v) : String(v))} />} />
        <Bar dataKey="value" name={valueLabel} fill="var(--ad-accent)" radius={[4, 4, 0, 0]} maxBarSize={32} />
      </BarChart>
    </ResponsiveContainer>
  );
}

/** Horizontal funnel with step conversion rates. */
export function Funnel({ steps }: { steps: { label: string; value: number }[] }) {
  const max = Math.max(1, ...steps.map((s) => s.value));
  return (
    <ol className="space-y-3">
      {steps.map((s, i) => {
        const prev = i ? steps[i - 1].value : null;
        const rate = prev ? (s.value / prev) * 100 : null;
        return (
          <li key={s.label}>
            <div className="mb-1 flex items-center justify-between text-[13px]">
              <span>{s.label}</span>
              <span className="tabular flex items-center gap-2">
                <span className="font-semibold">{s.value.toLocaleString()}</span>
                {rate != null && <span className="text-xs text-ad-muted">{rate.toFixed(1)}%</span>}
              </span>
            </div>
            <div className="h-2.5 overflow-hidden rounded-full bg-ad-sunken">
              <div className="h-full rounded-full bg-ad-accent transition-[width] duration-700" style={{ width: `${(s.value / max) * 100}%`, opacity: 1 - i * 0.13 }} />
            </div>
          </li>
        );
      })}
    </ol>
  );
}

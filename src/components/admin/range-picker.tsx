"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { CalendarRange } from "lucide-react";
import { usePathname, useRouter } from "@/i18n/navigation";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/menu";
import { Button } from "@/components/ui/button";
import { TextInput } from "./fields";
import { useAdmin } from "./admin-context";
import { cn } from "@/lib/utils";
import type { AdminKey } from "@/admin/i18n";

const PRESETS: { key: string; label: AdminKey }[] = [
  { key: "today", label: "c.today" },
  { key: "yesterday", label: "c.yesterday" },
  { key: "7d", label: "c.last7" },
  { key: "30d", label: "c.last30" },
  { key: "month", label: "c.thisMonth" },
  { key: "lastMonth", label: "c.lastMonth" },
  { key: "90d", label: "c.last90" },
];

export function RangePicker() {
  const { t } = useAdmin();
  const sp = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const current = sp.get("range") ?? "30d";
  const [from, setFrom] = useState(sp.get("from") ?? "");
  const [to, setTo] = useState(sp.get("to") ?? "");
  const [open, setOpen] = useState(false);
  const go = (range: string, extra: Record<string, string> = {}) => {
    const p = new URLSearchParams({ range, ...extra });
    router.push(`${pathname}?${p.toString()}`, { scroll: false });
  };
  const label = current === "custom" ? `${sp.get("from")} → ${sp.get("to")}` : t(PRESETS.find((p) => p.key === current)?.label ?? "c.last30");
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger className="flex h-9 items-center gap-2 rounded-lg border border-ad-border bg-ad-panel px-3 text-[13px] font-medium transition hover:bg-ad-hover">
        <CalendarRange className="size-4 text-ad-muted" />
        {label}
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72 p-2">
        <div className="grid gap-0.5">
          {PRESETS.map((p) => (
            <button key={p.key} type="button" onClick={() => (go(p.key), setOpen(false))} className={cn("rounded-lg px-3 py-2 text-start text-sm transition hover:bg-ad-hover", current === p.key && "bg-ad-hover font-medium")}>
              {t(p.label)}
            </button>
          ))}
        </div>
        <div className="mt-2 border-t border-ad-border p-2">
          <p className="mb-2 text-xs font-medium text-ad-muted">{t("c.custom")}</p>
          <div className="grid grid-cols-2 gap-2">
            <TextInput type="date" value={from} onChange={(e) => setFrom(e.target.value)} aria-label={t("c.from")} />
            <TextInput type="date" value={to} onChange={(e) => setTo(e.target.value)} aria-label={t("c.to")} />
          </div>
          <Button size="sm" block className="mt-2" disabled={!from || !to || from > to} onClick={() => (go("custom", { from, to }), setOpen(false))}>
            {t("c.apply")}
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

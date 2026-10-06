"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { icons } from "lucide-react";
import { Search, Upload, X, Shapes } from "lucide-react";
import { toast } from "sonner";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/menu";
import { parseIcon } from "@/components/icons/icon-value";
import { listCustomIconsAction, uploadCustomIconAction } from "@/actions/admin/icons";
import { useAdmin } from "./admin-context";
import { cn } from "@/lib/utils";

const NAMES = Object.keys(icons) as (keyof typeof icons)[];
/** Suggestions shown before the admin types anything. */
const SUGGESTED = ["Smartphone", "Cpu", "MemoryStick", "HardDrive", "BatteryFull", "BatteryCharging", "Zap", "Camera", "ScanFace", "Video", "Wifi", "Bluetooth", "Signal", "Nfc", "Cable", "PlugZap", "Ruler", "Weight", "Droplets", "Palette", "Gauge", "MonitorSmartphone", "AppWindow", "Headphones", "Watch", "Tablet", "Laptop", "Truck", "ShieldCheck", "RotateCcw", "BadgeCheck", "CreditCard", "Banknote", "Gift", "Tag", "Sparkles", "Star", "Clock", "MapPin", "Phone", "Mail", "MessagesSquare", "Store", "Package", "Lock", "Award", "Leaf", "Layers", "Link", "Info"] as const;

export function IconPreview({ value, customSvgs, className }: { value: string | null | undefined; customSvgs?: Record<string, string>; className?: string }) {
  const parsed = parseIcon(value);
  if (!parsed) return <Shapes className={cn("text-ad-muted/50", className)} />;
  if (parsed.kind === "custom") {
    const svg = customSvgs?.[parsed.id];
    return svg ? <span className={cn("inline-block [&>svg]:size-full", className)} dangerouslySetInnerHTML={{ __html: svg }} /> : <Shapes className={className} />;
  }
  const I = icons[parsed.name as keyof typeof icons];
  return I ? <I className={className} /> : <Shapes className={className} />;
}

/**
 * Icon picker: searchable Lucide library (1,800+ icons) plus the store's own
 * uploaded SVG icons. Uploads are sanitised server-side.
 */
export function IconPicker({ value, onChange, label }: { value: string | null | undefined; onChange: (v: string | null) => void; label?: string }) {
  const { t, locale } = useAdmin();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [tab, setTab] = useState<"library" | "custom">("library");
  const [custom, setCustom] = useState<{ id: string; name: string; svg: string }[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);
  const customSvgs = useMemo(() => Object.fromEntries(custom.map((c) => [c.id, c.svg])), [custom]);

  useEffect(() => {
    if (open || parseIcon(value)?.kind === "custom") listCustomIconsAction().then((r) => r.ok && setCustom(r.data));
  }, [open, value]);

  const results = useMemo(() => {
    const term = q.trim().toLowerCase().replace(/\s+/g, "");
    if (!term) return [...SUGGESTED];
    return NAMES.filter((n) => n.toLowerCase().includes(term)).slice(0, 120);
  }, [q]);

  const upload = async (file?: File) => {
    if (!file) return;
    if (!/svg/i.test(file.type) && !file.name.endsWith(".svg")) return toast.error(locale === "ar" ? "يُسمح بملفات SVG فقط" : "Only SVG files are allowed");
    const svg = await file.text();
    const r = await uploadCustomIconAction(file.name.replace(/\.svg$/i, ""), svg);
    if (!r.ok) return toast.error(locale === "ar" ? "ملف SVG غير صالح أو كبير جداً" : "Invalid or too large SVG");
    setCustom((c) => [r.data, ...c]);
    onChange(`custom:${r.data.id}`);
    setOpen(false);
  };

  return (
    <div className="flex items-center gap-2">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger className="flex h-10 items-center gap-2.5 rounded-lg border border-ad-border bg-ad-panel px-3 text-sm transition hover:bg-ad-hover" aria-label={label ?? t("c.icon")}>
          <span className="grid size-6 place-items-center rounded-md bg-ad-sunken">
            <IconPreview value={value} customSvgs={customSvgs} className="size-4" />
          </span>
          <span className="max-w-32 truncate text-ad-muted">{parseIcon(value)?.kind === "lucide" ? (parseIcon(value) as { name: string }).name : parseIcon(value) ? custom.find((c) => `custom:${c.id}` === value)?.name ?? "SVG" : t("c.icon")}</span>
        </PopoverTrigger>
        <PopoverContent className="w-[min(360px,calc(100vw-24px))] p-0" align="start">
          <div className="flex border-b border-ad-border text-[13px]">
            {(["library", "custom"] as const).map((k) => (
              <button key={k} type="button" onClick={() => setTab(k)} className={cn("flex-1 py-2.5 font-medium", tab === k ? "border-b-2 border-ad-accent text-ad-fg" : "text-ad-muted")}>
                {k === "library" ? "Lucide" : locale === "ar" ? "أيقوناتي" : "My icons"}
              </button>
            ))}
          </div>
          {tab === "library" ? (
            <>
              <div className="relative border-b border-ad-border p-2">
                <Search className="pointer-events-none absolute inset-y-0 start-5 my-auto size-4 text-ad-muted" />
                <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder={locale === "ar" ? "ابحث (بالإنجليزية): battery, camera…" : "Search: battery, camera, wifi…"} className="h-9 w-full rounded-lg bg-ad-sunken pe-3 ps-9 text-sm outline-none" />
              </div>
              <div className="grid max-h-64 grid-cols-8 gap-1 overflow-y-auto p-2">
                {results.map((n) => {
                  const I = icons[n as keyof typeof icons];
                  const v = `lucide:${n}`;
                  return (
                    <button key={n} type="button" title={n} onClick={() => (onChange(v), setOpen(false))} className={cn("grid aspect-square place-items-center rounded-lg transition hover:bg-ad-hover", value === v && "bg-ad-accent text-ad-accent-fg hover:bg-ad-accent")}>
                      {I && <I className="size-[18px]" />}
                    </button>
                  );
                })}
                {!results.length && <p className="col-span-8 py-6 text-center text-xs text-ad-muted">{t("c.noResults")}</p>}
              </div>
            </>
          ) : (
            <div className="p-2">
              <button type="button" onClick={() => fileRef.current?.click()} className="mb-2 flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-ad-border py-3 text-[13px] text-ad-muted hover:bg-ad-hover">
                <Upload className="size-4" /> {locale === "ar" ? "رفع أيقونة SVG" : "Upload SVG icon"}
              </button>
              <input ref={fileRef} type="file" accept=".svg,image/svg+xml" hidden onChange={(e) => (void upload(e.target.files?.[0]), (e.target.value = ""))} />
              <div className="grid max-h-56 grid-cols-8 gap-1 overflow-y-auto">
                {custom.map((c) => (
                  <button key={c.id} type="button" title={c.name} onClick={() => (onChange(`custom:${c.id}`), setOpen(false))} className={cn("grid aspect-square place-items-center rounded-lg p-1.5 hover:bg-ad-hover", value === `custom:${c.id}` && "bg-ad-accent text-ad-accent-fg")}>
                    <span className="size-[18px] [&>svg]:size-full" dangerouslySetInnerHTML={{ __html: c.svg }} />
                  </button>
                ))}
              </div>
            </div>
          )}
        </PopoverContent>
      </Popover>
      {value && (
        <button type="button" onClick={() => onChange(null)} className="grid size-8 place-items-center rounded-lg text-ad-muted hover:bg-ad-hover" aria-label={t("c.remove")}>
          <X className="size-4" />
        </button>
      )}
    </div>
  );
}

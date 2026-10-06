"use client";

import { useRef, useState, type ReactNode } from "react";
import { ImagePlus, Loader2, Trash2, Languages } from "lucide-react";
import { toast } from "sonner";
import { inputBase } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { useAdmin } from "./admin-context";
import type { LocalizedText } from "@/lib/i18n-text";

export function Label({ children, hint, htmlFor, optional }: { children: ReactNode; hint?: ReactNode; htmlFor?: string; optional?: boolean }) {
  const { t } = useAdmin();
  return (
    <div className="mb-1.5">
      <label htmlFor={htmlFor} className="text-[13px] font-medium">
        {children} {optional && <span className="font-normal text-ad-muted">({t("c.optional")})</span>}
      </label>
      {hint && <p className="mt-0.5 text-xs text-ad-muted">{hint}</p>}
    </div>
  );
}

export function TextInput({ className, invalid, ...props }: React.ComponentProps<"input"> & { invalid?: boolean }) {
  return <input aria-invalid={invalid || undefined} className={cn(inputBase, "h-10 rounded-lg text-sm", className)} {...props} />;
}

export function TextArea({ className, ...props }: React.ComponentProps<"textarea">) {
  return <textarea className={cn(inputBase, "min-h-24 rounded-lg py-2.5 text-sm leading-relaxed", className)} {...props} />;
}

export function Select({ className, children, ...props }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <div className="relative">
      <select className={cn(inputBase, "h-10 appearance-none rounded-lg pe-9 text-sm", className)} {...props}>
        {children}
      </select>
      <svg className="pointer-events-none absolute inset-y-0 end-3 my-auto size-4 text-ad-muted" viewBox="0 0 20 20" fill="currentColor" aria-hidden>
        <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" />
      </svg>
    </div>
  );
}

export function FieldError({ message }: { message?: string | null }) {
  if (!message) return null;
  return <p className="mt-1 text-xs font-medium text-red-600">{message}</p>;
}

/**
 * Bilingual text field: English + Arabic side by side (each in its own
 * direction) on desktop, stacked on phones. Every translatable admin field
 * uses this so content is never accidentally single-language.
 */
export function LocalizedField({
  label,
  value,
  onChange,
  multiline,
  rows = 3,
  hint,
  required,
  maxLength,
  placeholder,
  error,
}: {
  label: ReactNode;
  value: LocalizedText | undefined;
  onChange: (v: LocalizedText) => void;
  multiline?: boolean;
  rows?: number;
  hint?: ReactNode;
  required?: boolean;
  maxLength?: number;
  placeholder?: LocalizedText;
  error?: string | null;
}) {
  const { t } = useAdmin();
  const v = value ?? {};
  const field = (lang: "en" | "ar") => {
    const common = {
      value: v[lang] ?? "",
      onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => onChange({ ...v, [lang]: e.target.value }),
      dir: lang === "ar" ? ("rtl" as const) : ("ltr" as const),
      lang,
      maxLength,
      placeholder: placeholder?.[lang],
      "aria-label": `${typeof label === "string" ? label : ""} (${lang === "ar" ? t("c.arabic") : t("c.english")})`,
    };
    return (
      <div className="relative">
        <span className="pointer-events-none absolute end-2 top-2 z-10 rounded bg-ad-sunken px-1.5 py-0.5 text-[10px] font-semibold uppercase text-ad-muted">{lang}</span>
        {multiline ? <TextArea {...common} rows={rows} className="pe-10" /> : <TextInput {...common} className="pe-10" />}
      </div>
    );
  };
  return (
    <div>
      <div className="mb-1.5 flex items-center gap-1.5">
        <Languages className="size-3.5 text-ad-muted" />
        <span className="text-[13px] font-medium">
          {label}
          {required && <span className="text-red-500"> *</span>}
        </span>
      </div>
      {hint && <p className="-mt-1 mb-1.5 text-xs text-ad-muted">{hint}</p>}
      <div className="grid gap-2 md:grid-cols-2">
        {field("en")}
        {field("ar")}
      </div>
      <FieldError message={error} />
    </div>
  );
}

export type MediaRef = { id?: string; url: string } | null;

/** Upload to the media pipeline (validated, EXIF-stripped, WebP renditions). */
export async function uploadImage(file: File, folder = "uploads"): Promise<{ id: string; url: string } | null> {
  const fd = new FormData();
  fd.append("file", file);
  fd.append("folder", folder);
  const res = await fetch("/api/admin/upload", { method: "POST", body: fd });
  const body = (await res.json().catch(() => ({}))) as { id?: string; url?: string; error?: string };
  if (!res.ok || !body.id) {
    toast.error(body.error === "file_too_large" ? "File too large (max 10 MB)" : body.error === "unsupported_image_type" || body.error === "invalid_image" ? "Unsupported image. Use JPG, PNG, WebP or AVIF." : "Upload failed");
    return null;
  }
  return { id: body.id, url: body.url! };
}

export function ImageField({ value, onChange, folder, aspect = "aspect-video", label }: { value: MediaRef; onChange: (v: MediaRef) => void; folder?: string; aspect?: string; label?: ReactNode }) {
  const { t } = useAdmin();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [drag, setDrag] = useState(false);
  const handle = async (file?: File) => {
    if (!file) return;
    setBusy(true);
    const r = await uploadImage(file, folder);
    setBusy(false);
    if (r) onChange(r);
  };
  return (
    <div>
      {label && <Label>{label}</Label>}
      <div
        onDragOver={(e) => (e.preventDefault(), setDrag(true))}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDrag(false);
          void handle(e.dataTransfer.files[0]);
        }}
        className={cn("group relative overflow-hidden rounded-lg border border-dashed border-ad-border bg-ad-sunken transition", aspect, drag && "border-ad-accent bg-ad-accent/5")}
      >
        {value?.url ? (
          <>
            <img src={value.url} alt="" className="size-full object-cover" />
            <div className="absolute inset-0 flex items-center justify-center gap-2 bg-black/40 opacity-0 transition group-hover:opacity-100 focus-within:opacity-100">
              <button type="button" onClick={() => input.current?.click()} className="rounded-lg bg-white px-3 py-1.5 text-xs font-medium text-neutral-900">
                {t("c.replace")}
              </button>
              <button type="button" onClick={() => onChange(null)} className="grid size-8 place-items-center rounded-lg bg-white text-red-600" aria-label={t("c.remove")}>
                <Trash2 className="size-4" />
              </button>
            </div>
          </>
        ) : (
          <button type="button" onClick={() => input.current?.click()} className="flex size-full flex-col items-center justify-center gap-2 p-4 text-center text-xs text-ad-muted">
            {busy ? <Loader2 className="size-6 animate-spin" /> : <ImagePlus className="size-6" />}
            {busy ? t("c.uploading") : t("c.dropHere")}
          </button>
        )}
        {busy && value?.url && (
          <div className="absolute inset-0 grid place-items-center bg-black/40">
            <Loader2 className="size-6 animate-spin text-white" />
          </div>
        )}
      </div>
      <input ref={input} type="file" accept="image/jpeg,image/png,image/webp,image/avif,image/gif" hidden onChange={(e) => (void handle(e.target.files?.[0]), (e.target.value = ""))} />
    </div>
  );
}

export function MoneyInput({ value, onChange, decimals, symbol, placeholder, invalid }: { value: number | null; onChange: (v: number | null) => void; decimals: number; symbol: string; placeholder?: string; invalid?: boolean }) {
  const [text, setText] = useState(value == null ? "" : (value / 10 ** decimals).toString());
  return (
    <div className="relative">
      <TextInput
        inputMode="decimal"
        value={text}
        invalid={invalid}
        placeholder={placeholder}
        onChange={(e) => {
          const s = e.target.value.replace(/[^\d.]/g, "");
          setText(s);
          onChange(s === "" ? null : Math.round(Number(s) * 10 ** decimals));
        }}
        className="tabular pe-14"
        dir="ltr"
      />
      <span className="pointer-events-none absolute inset-y-0 end-3 my-auto h-fit text-xs font-medium text-ad-muted">{symbol}</span>
    </div>
  );
}

export function ColorInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex items-center gap-2">
      <input type="color" value={value || "#000000"} onChange={(e) => onChange(e.target.value)} className="size-10 shrink-0 cursor-pointer rounded-lg border border-ad-border bg-transparent p-1" />
      <TextInput value={value} onChange={(e) => onChange(e.target.value)} placeholder="#000000" className="font-mono" dir="ltr" maxLength={7} />
    </div>
  );
}

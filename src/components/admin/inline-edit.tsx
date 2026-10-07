"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { Loader2, Pencil } from "lucide-react";
import { useAdmin } from "./admin-context";
import { cn } from "@/lib/utils";

/**
 * Click-to-edit value for tables. Enter or blur saves, Escape cancels. The
 * new value shows immediately (optimistic); if `onSave` rejects, the old value
 * comes back and the field reopens so nothing is silently lost.
 */
export function InlineEdit({
  value,
  display,
  onSave,
  type = "text",
  label,
  disabled,
  className,
  inputClassName,
  min,
  step,
  dir,
  placeholder,
}: {
  /** Raw editable value (text or number as string). */
  value: string;
  /** How the value looks when not editing (defaults to the value). */
  display?: ReactNode;
  onSave: (next: string) => Promise<boolean>;
  type?: "text" | "number";
  label: string;
  disabled?: boolean;
  className?: string;
  inputClassName?: string;
  min?: number;
  step?: number | "any";
  dir?: "ltr" | "rtl";
  placeholder?: string;
}) {
  const { locale } = useAdmin();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const [shown, setShown] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => setShown(null), [value]);
  useEffect(() => {
    if (!editing) return;
    input.current?.focus();
    input.current?.select();
  }, [editing]);

  if (disabled) return <span className={className}>{display ?? value}</span>;

  const commit = async () => {
    const next = draft.trim();
    setEditing(false);
    if (next === value) return;
    setShown(next);
    setBusy(true);
    const ok = await onSave(next).catch(() => false);
    setBusy(false);
    if (!ok) {
      setShown(null);
      setDraft(next);
      setEditing(true);
    }
  };

  if (editing)
    return (
      <input
        ref={input}
        type={type}
        value={draft}
        min={min}
        step={step}
        dir={dir}
        placeholder={placeholder}
        aria-label={label}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") (e.currentTarget as HTMLInputElement).blur();
          if (e.key === "Escape") {
            setDraft(value);
            setEditing(false);
          }
        }}
        onClick={(e) => e.stopPropagation()}
        className={cn("h-8 w-full min-w-0 rounded-md border border-ad-accent bg-ad-panel px-2 text-[13px] tabular-nums outline-none ring-2 ring-ad-accent/15", inputClassName)}
      />
    );

  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        setDraft(value);
        setEditing(true);
      }}
      title={locale === "ar" ? "انقر للتعديل" : "Click to edit"}
      aria-label={`${label}: ${shown ?? value}`}
      className={cn("group/ie -mx-1.5 inline-flex max-w-full items-center gap-1.5 rounded-md px-1.5 py-0.5 text-start transition hover:bg-ad-hover", className)}
    >
      <span className={cn("min-w-0 truncate", busy && "opacity-60")}>{shown != null ? shown : (display ?? value)}</span>
      {busy ? <Loader2 className="size-3 shrink-0 animate-spin text-ad-muted" /> : <Pencil className="size-3 shrink-0 text-ad-muted opacity-0 transition group-hover/ie:opacity-100" />}
    </button>
  );
}

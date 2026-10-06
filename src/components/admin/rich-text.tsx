"use client";

import { useEffect, useRef } from "react";
import { Bold, Italic, List, ListOrdered, Heading2, Heading3, Link2, Quote, Eraser, Languages } from "lucide-react";
import { cn } from "@/lib/utils";
import type { LocalizedText } from "@/lib/i18n-text";
import { useAdmin } from "./admin-context";

/**
 * Minimal, dependency-free rich text editor (contentEditable). Output is
 * always re-sanitised on the server, so pasted markup can't inject scripts.
 */
function RichEditor({ value, onChange, dir, lang }: { value: string; onChange: (html: string) => void; dir: "rtl" | "ltr"; lang: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (ref.current && ref.current.innerHTML !== value) ref.current.innerHTML = value || "";
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);
  const cmd = (name: string, arg?: string) => {
    ref.current?.focus();
    document.execCommand(name, false, arg);
    onChange(ref.current?.innerHTML ?? "");
  };
  const tools = [
    { icon: Bold, run: () => cmd("bold"), label: "Bold" },
    { icon: Italic, run: () => cmd("italic"), label: "Italic" },
    { icon: Heading2, run: () => cmd("formatBlock", "h2"), label: "Heading" },
    { icon: Heading3, run: () => cmd("formatBlock", "h3"), label: "Subheading" },
    { icon: List, run: () => cmd("insertUnorderedList"), label: "Bulleted list" },
    { icon: ListOrdered, run: () => cmd("insertOrderedList"), label: "Numbered list" },
    { icon: Quote, run: () => cmd("formatBlock", "blockquote"), label: "Quote" },
    {
      icon: Link2,
      run: () => {
        const url = window.prompt("URL (https://…)");
        if (url && /^(https?:\/\/|\/|mailto:)/.test(url)) cmd("createLink", url);
      },
      label: "Link",
    },
    { icon: Eraser, run: () => (cmd("removeFormat"), cmd("formatBlock", "p")), label: "Clear formatting" },
  ];
  return (
    <div className="overflow-hidden rounded-lg border border-ad-border focus-within:border-ad-accent focus-within:ring-4 focus-within:ring-ad-accent/12">
      <div className="flex flex-wrap items-center gap-0.5 border-b border-ad-border bg-ad-sunken p-1">
        {tools.map(({ icon: Icon, run, label }) => (
          <button key={label} type="button" onMouseDown={(e) => e.preventDefault()} onClick={run} title={label} aria-label={label} className="grid size-7 place-items-center rounded text-ad-muted hover:bg-ad-hover hover:text-ad-fg">
            <Icon className="size-3.5" />
          </button>
        ))}
        <span className="ms-auto rounded bg-ad-panel px-1.5 py-0.5 text-[10px] font-semibold uppercase text-ad-muted">{lang}</span>
      </div>
      <div
        ref={ref}
        contentEditable
        suppressContentEditableWarning
        dir={dir}
        lang={lang}
        onInput={(e) => onChange((e.target as HTMLDivElement).innerHTML)}
        onPaste={(e) => {
          // Paste as plain text to avoid foreign styling.
          e.preventDefault();
          document.execCommand("insertText", false, e.clipboardData.getData("text/plain"));
        }}
        className={cn("prose-store min-h-40 bg-ad-panel px-3.5 py-3 text-sm text-ad-fg outline-none [&_h2]:text-lg [&_h3]:text-base")}
        role="textbox"
        aria-multiline="true"
      />
    </div>
  );
}

export function LocalizedRichText({ label, value, onChange }: { label: string; value: LocalizedText; onChange: (v: LocalizedText) => void }) {
  const { t } = useAdmin();
  return (
    <div>
      <p className="mb-1.5 flex items-center gap-1.5 text-[13px] font-medium">
        <Languages className="size-3.5 text-ad-muted" /> {label}
      </p>
      <div className="grid gap-3 xl:grid-cols-2">
        <RichEditor value={value.en ?? ""} onChange={(html) => onChange({ ...value, en: html })} dir="ltr" lang="en" />
        <RichEditor value={value.ar ?? ""} onChange={(html) => onChange({ ...value, ar: html })} dir="rtl" lang="ar" />
      </div>
      <span className="sr-only">{t("c.english")}</span>
    </div>
  );
}

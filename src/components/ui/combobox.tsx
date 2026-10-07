"use client";

import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from "react";
import * as D from "@radix-ui/react-dialog";
import { useTranslations } from "next-intl";
import { Check, ChevronDown, Search, X } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/menu";
import { normalizeText } from "@/lib/search-text";
import { cn } from "@/lib/utils";

export type ComboOption = {
  value: string;
  label: string;
  /** Secondary text (e.g. a code, a region, a price). */
  hint?: string;
  /** Group heading (options are shown in the order given, grouped consecutively). */
  group?: string;
  /** Leading visual (flag, icon, swatch). */
  icon?: ReactNode;
  /** Extra search terms — e.g. the name in the other language, ISO codes, calling codes. */
  keywords?: string;
  disabled?: boolean;
};

function useIsMobile() {
  const [mobile, setMobile] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 639px)");
    const on = () => setMobile(mq.matches);
    on();
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  return mobile;
}

const fieldClass =
  "flex h-12 w-full items-center gap-2.5 rounded-xl border border-border bg-bg px-3.5 text-start text-[15px] text-fg outline-none transition-[border-color,box-shadow] hover:border-fg/25 focus-visible:border-accent focus-visible:ring-4 focus-visible:ring-accent/12 disabled:cursor-not-allowed disabled:opacity-60 data-[invalid]:border-red-500";

/**
 * The store's dropdown. One component for every choice list — country, city,
 * phone country, currency, language, sort… Desktop: a popover anchored to the
 * field. Phones: a bottom sheet with large touch rows. Long lists get a search
 * box that matches Arabic and English names (spelling variants folded), codes
 * and keywords; arrows / Enter / Escape work throughout.
 */
export function Combobox({
  options,
  value,
  onChange,
  placeholder,
  label,
  searchable,
  disabled,
  invalid,
  id,
  className,
  trigger,
  emptyText,
  "aria-describedby": describedBy,
}: {
  options: ComboOption[];
  value: string | null | undefined;
  onChange: (value: string) => void;
  placeholder?: string;
  /** Accessible name; also the sheet title on phones. */
  label: string;
  /** Defaults to on for lists longer than 8. */
  searchable?: boolean;
  disabled?: boolean;
  invalid?: boolean;
  id?: string;
  className?: string;
  /** Custom trigger content (e.g. a compact pill); defaults to a form field. */
  trigger?: (selected: ComboOption | undefined) => ReactNode;
  emptyText?: string;
  "aria-describedby"?: string;
}) {
  const t = useTranslations("common");
  const mobile = useIsMobile();
  const [open, setOpen] = useState(false);
  const selected = options.find((o) => o.value === value);
  const withSearch = searchable ?? options.length > 8;

  const button = (
    <button
      type="button"
      id={id}
      disabled={disabled}
      aria-haspopup="listbox"
      aria-expanded={open}
      aria-label={trigger ? label : undefined}
      aria-describedby={describedBy}
      aria-invalid={invalid || undefined}
      data-invalid={invalid || undefined}
      onClick={() => setOpen(true)}
      className={trigger ? cn("outline-none focus-visible:ring-2 focus-visible:ring-accent/40", className) : cn(fieldClass, className)}
    >
      {trigger ? (
        trigger(selected)
      ) : (
        <>
          {selected?.icon && <span className="grid shrink-0 place-items-center">{selected.icon}</span>}
          <span className={cn("min-w-0 flex-1 truncate", !selected && "text-muted/80")}>{selected ? selected.label : placeholder ?? label}</span>
          {selected?.hint && <span className="shrink-0 text-xs text-muted">{selected.hint}</span>}
          <ChevronDown className={cn("size-4 shrink-0 text-muted transition", open && "rotate-180")} />
        </>
      )}
    </button>
  );

  const list = <ComboList options={options} value={value} withSearch={withSearch} label={label} emptyText={emptyText ?? t("noMatches")} onPick={(v) => (onChange(v), setOpen(false))} large={mobile} />;

  if (mobile)
    return (
      <D.Root open={open} onOpenChange={setOpen}>
        {button}
        <D.Portal>
          <D.Overlay className="sheet-overlay fixed inset-0 z-[94] bg-black/40" />
          <D.Content data-side="bottom" aria-describedby={undefined} className="sheet fixed inset-x-0 bottom-0 z-[95] flex max-h-[85dvh] flex-col rounded-t-3xl bg-bg pb-[env(safe-area-inset-bottom)] shadow-pop outline-none">
            <div className="mx-auto mt-2.5 h-1.5 w-10 shrink-0 rounded-full bg-border" aria-hidden />
            <div className="flex items-center justify-between gap-3 px-5 pb-2 pt-3">
              <D.Title className="text-base font-semibold">{label}</D.Title>
              <D.Close className="grid size-9 place-items-center rounded-full hover:bg-surface" aria-label={t("close")}>
                <X className="size-5" />
              </D.Close>
            </div>
            {list}
          </D.Content>
        </D.Portal>
      </D.Root>
    );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{button}</PopoverTrigger>
      <PopoverContent align="start" className="flex max-h-[min(24rem,var(--radix-popover-content-available-height))] w-[max(16rem,var(--radix-popover-trigger-width))] flex-col p-1.5" onOpenAutoFocus={(e) => withSearch || e.preventDefault()}>
        {list}
      </PopoverContent>
    </Popover>
  );
}

function ComboList({ options, value, withSearch, label, emptyText, onPick, large }: { options: ComboOption[]; value: string | null | undefined; withSearch: boolean; label: string; emptyText: string; onPick: (v: string) => void; large: boolean }) {
  const t = useTranslations("common");
  const [q, setQ] = useState("");
  const listId = useId();
  const listRef = useRef<HTMLUListElement>(null);
  const filtered = useMemo(() => {
    const needle = normalizeText(q.trim());
    if (!needle) return options;
    return options.filter((o) => normalizeText(`${o.label} ${o.hint ?? ""} ${o.keywords ?? ""} ${o.value} ${o.group ?? ""}`).includes(needle));
  }, [options, q]);
  const [active, setActive] = useState(() => Math.max(0, filtered.findIndex((o) => o.value === value)));
  useEffect(() => setActive((a) => (q ? 0 : Math.max(0, filtered.findIndex((o) => o.value === value)) || a)), [q, filtered, value]);

  // Keep the active row in view (and start at the selected option).
  useEffect(() => {
    listRef.current?.querySelector<HTMLElement>(`[data-index="${active}"]`)?.scrollIntoView({ block: "nearest" });
  }, [active]);

  const move = (delta: number) => {
    if (!filtered.length) return;
    let i = active;
    for (let n = 0; n < filtered.length; n++) {
      i = (i + delta + filtered.length) % filtered.length;
      if (!filtered[i].disabled) break;
    }
    setActive(i);
  };
  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") (e.preventDefault(), move(1));
    else if (e.key === "ArrowUp") (e.preventDefault(), move(-1));
    else if (e.key === "Home") (e.preventDefault(), setActive(0));
    else if (e.key === "End") (e.preventDefault(), setActive(filtered.length - 1));
    else if (e.key === "Enter") {
      e.preventDefault();
      const o = filtered[active];
      if (o && !o.disabled) onPick(o.value);
    }
  };

  return (
    <div className="flex min-h-0 flex-col" onKeyDown={onKey}>
      {withSearch && (
        <div className={cn("relative shrink-0", large ? "px-4 pb-2" : "p-1 pb-1.5")}>
          <Search className={cn("pointer-events-none absolute top-1/2 size-4 -translate-y-1/2 text-muted", large ? "start-7" : "start-4")} />
          <input
            autoFocus={!large}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={t("search")}
            aria-label={`${t("search")}: ${label}`}
            aria-controls={listId}
            aria-activedescendant={filtered[active] ? `${listId}-${active}` : undefined}
            className={cn("w-full rounded-xl border border-border bg-surface/60 pe-3 text-sm outline-none transition focus:border-accent focus:bg-bg", large ? "h-11 ps-10" : "h-10 ps-9")}
          />
        </div>
      )}
      <ul ref={listRef} id={listId} role="listbox" aria-label={label} tabIndex={withSearch ? -1 : 0} className={cn("min-h-0 flex-1 overflow-y-auto overscroll-contain outline-none [scrollbar-width:thin]", large ? "px-2 pb-3" : "")}>
        {filtered.map((o, i) => {
          const header = o.group && o.group !== filtered[i - 1]?.group;
          const isSelected = o.value === value;
          return (
            <li key={o.value} role="presentation">
              {header && <p className={cn("sticky top-0 z-[1] bg-bg/95 px-3 pb-1 pt-2.5 text-[11px] font-semibold uppercase tracking-wide text-muted backdrop-blur", i > 0 && "mt-1 border-t border-border")}>{o.group}</p>}
              <div
                id={`${listId}-${i}`}
                data-index={i}
                role="option"
                aria-selected={isSelected}
                aria-disabled={o.disabled || undefined}
                onMouseMove={() => active !== i && setActive(i)}
                onClick={() => !o.disabled && onPick(o.value)}
                className={cn(
                  "flex cursor-pointer items-center gap-3 rounded-lg px-3 text-[14.5px] transition-colors",
                  large ? "min-h-12 py-2.5" : "min-h-10 py-2",
                  i === active && "bg-surface",
                  isSelected && "font-semibold",
                  o.disabled && "cursor-not-allowed opacity-50",
                )}
              >
                {o.icon && <span className="grid shrink-0 place-items-center">{o.icon}</span>}
                <span className="min-w-0 flex-1 truncate">{o.label}</span>
                {o.hint && <span className="shrink-0 text-xs text-muted" dir="ltr">{o.hint}</span>}
                {isSelected && <Check className="size-4 shrink-0 text-accent" />}
              </div>
            </li>
          );
        })}
        {!filtered.length && <li className="px-3 py-8 text-center text-sm text-muted">{emptyText}</li>}
      </ul>
    </div>
  );
}

"use client";

import { forwardRef, useId, useState, type InputHTMLAttributes, type ReactNode, type TextareaHTMLAttributes } from "react";
import { Eye, EyeOff } from "lucide-react";
import { cn } from "@/lib/utils";

export const inputBase =
  "w-full rounded-xl border border-border bg-bg px-3.5 text-[15px] text-fg placeholder:text-muted/70 transition-[border-color,box-shadow] outline-none focus:border-accent focus:ring-4 focus:ring-accent/12 disabled:cursor-not-allowed disabled:bg-surface disabled:opacity-70 aria-[invalid=true]:border-red-500 aria-[invalid=true]:focus:ring-red-500/12";

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean; leading?: ReactNode; trailing?: ReactNode }>(
  function Input({ className, invalid, leading, trailing, ...props }, ref) {
    if (!leading && !trailing) return <input ref={ref} aria-invalid={invalid || undefined} className={cn(inputBase, "h-12", className)} {...props} />;
    return (
      <div className="relative">
        {leading && <span className="pointer-events-none absolute inset-y-0 start-3.5 flex items-center text-muted">{leading}</span>}
        <input ref={ref} aria-invalid={invalid || undefined} className={cn(inputBase, "h-12", leading && "ps-10", trailing && "pe-11", className)} {...props} />
        {trailing && <span className="absolute inset-y-0 end-1.5 flex items-center">{trailing}</span>}
      </div>
    );
  },
);

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement> & { invalid?: boolean }>(function Textarea({ className, invalid, ...props }, ref) {
  return <textarea ref={ref} aria-invalid={invalid || undefined} className={cn(inputBase, "min-h-28 py-3 leading-relaxed", className)} {...props} />;
});

export function PasswordInput(props: InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean; showLabel: string; hideLabel: string }) {
  const { showLabel, hideLabel, ...rest } = props;
  const [show, setShow] = useState(false);
  return (
    <Input
      {...rest}
      type={show ? "text" : "password"}
      trailing={
        <button type="button" onClick={() => setShow((s) => !s)} className="grid size-9 place-items-center rounded-lg text-muted hover:text-fg" aria-label={show ? hideLabel : showLabel} aria-pressed={show}>
          {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
        </button>
      }
    />
  );
}

/** Label + control + help/error with correct ARIA wiring. */
export function Field({
  label,
  hint,
  error,
  optional,
  children,
  className,
  id: idProp,
}: {
  label?: ReactNode;
  hint?: ReactNode;
  error?: string | null;
  optional?: string;
  children: (props: { id: string; "aria-describedby"?: string; invalid: boolean }) => ReactNode;
  className?: string;
  id?: string;
}) {
  const auto = useId();
  const id = idProp ?? auto;
  const describedBy = [hint ? `${id}-hint` : null, error ? `${id}-error` : null].filter(Boolean).join(" ") || undefined;
  return (
    <div className={cn("space-y-1.5", className)}>
      {label && (
        <label htmlFor={id} className="flex items-baseline gap-1.5 text-sm font-medium text-fg">
          {label}
          {optional && <span className="text-xs font-normal text-muted">({optional})</span>}
        </label>
      )}
      {children({ id, "aria-describedby": describedBy, invalid: Boolean(error) })}
      {hint && !error && (
        <p id={`${id}-hint`} className="text-xs text-muted">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${id}-error`} className="animate-fade-in text-xs font-medium text-red-600" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

export function NativeSelect({ className, invalid, children, ...props }: React.SelectHTMLAttributes<HTMLSelectElement> & { invalid?: boolean }) {
  return (
    <div className="relative">
      <select aria-invalid={invalid || undefined} className={cn(inputBase, "h-12 appearance-none pe-10", className)} {...props}>
        {children}
      </select>
      <svg className="pointer-events-none absolute inset-y-0 end-3.5 my-auto size-4 text-muted" viewBox="0 0 20 20" fill="currentColor" aria-hidden>
        <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" />
      </svg>
    </div>
  );
}

export function Checkbox({ label, className, ...props }: InputHTMLAttributes<HTMLInputElement> & { label: ReactNode }) {
  return (
    <label className={cn("flex cursor-pointer items-start gap-3 text-sm leading-snug", className)}>
      <span className="relative mt-0.5 grid size-[18px] shrink-0 place-items-center">
        <input type="checkbox" className="peer absolute inset-0 cursor-pointer appearance-none rounded-md border border-border bg-bg transition checked:border-accent checked:bg-accent focus-visible:ring-4 focus-visible:ring-accent/15" {...props} />
        <svg className="pointer-events-none relative size-[14px] scale-0 text-white transition peer-checked:scale-100" viewBox="0 0 20 20" fill="none" aria-hidden>
          <path d="M5 10.5l3.2 3.2L15 7" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
      <span className="text-fg/85">{label}</span>
    </label>
  );
}

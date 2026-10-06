import { cn } from "@/lib/utils";

/** Star rating, rendered as text-free SVG with an accessible label. */
export function Stars({ value, size = 14, className, label }: { value: number; size?: number; className?: string; label?: string }) {
  const pct = Math.max(0, Math.min(100, (value / 5) * 100));
  return (
    <span className={cn("relative inline-flex shrink-0", className)} role="img" aria-label={label ?? `${value.toFixed(1)} / 5`}>
      <span className="flex text-border" aria-hidden>
        {Array.from({ length: 5 }, (_, i) => (
          <Star key={i} size={size} />
        ))}
      </span>
      <span className="absolute inset-0 flex overflow-hidden text-amber-400 rtl:justify-end" style={{ width: `${pct}%` }} aria-hidden>
        {Array.from({ length: 5 }, (_, i) => (
          <Star key={i} size={size} />
        ))}
      </span>
    </span>
  );
}

/** "★★★★★ 4.8 (124)" — stars, average and review count in one compact row. */
export function RatingSummary({ value, count, size = 12, className, countLabel }: { value: number; count: number; size?: number; className?: string; countLabel?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5", className)}>
      <Stars value={value} size={size} label={`${value.toFixed(1)} / 5${countLabel ? ` · ${countLabel}` : ""}`} />
      <span className="tabular text-xs font-semibold text-fg" aria-hidden>
        {value.toFixed(1)}
      </span>
      <span className="tabular text-xs text-muted" aria-hidden>
        ({count.toLocaleString()})
      </span>
    </span>
  );
}

function Star({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="currentColor" className="shrink-0">
      <path d="M10 1.6l2.47 5.3 5.8.68-4.3 3.95 1.15 5.73L10 14.4l-5.12 2.86 1.15-5.73-4.3-3.95 5.8-.68z" />
    </svg>
  );
}

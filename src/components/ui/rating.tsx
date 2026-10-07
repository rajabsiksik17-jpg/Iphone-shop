import { cn } from "@/lib/utils";

/**
 * Star rating, rendered as text-free SVG with an accessible label. Each star
 * paints its own fill fraction (clipped from the reading-start side, so it
 * fills right-to-left in Arabic), which keeps outline and fill perfectly
 * aligned at any size or direction.
 */
export function Stars({ value, size = 14, className, label }: { value: number; size?: number; className?: string; label?: string }) {
  const v = Math.max(0, Math.min(5, value));
  return (
    <span className={cn("inline-flex shrink-0 items-center gap-px", className)} role="img" aria-label={label ?? `${value.toFixed(1)} / 5`}>
      {Array.from({ length: 5 }, (_, i) => {
        const fill = Math.max(0, Math.min(1, v - i));
        return (
          <span key={i} className="relative inline-block shrink-0" style={{ width: size, height: size }} aria-hidden>
            <Star size={size} className="absolute inset-0 text-border" />
            {fill > 0 && (
              <Star
                size={size}
                className="absolute inset-0 text-amber-400 [clip-path:inset(0_calc((1-var(--f))*100%)_0_0)] rtl:[clip-path:inset(0_0_0_calc((1-var(--f))*100%))]"
                style={{ "--f": fill } as React.CSSProperties}
              />
            )}
          </span>
        );
      })}
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

function Star({ size, className, style }: { size: number; className?: string; style?: React.CSSProperties }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="currentColor" className={cn("shrink-0", className)} style={style}>
      <path d="M10 1.6l2.47 5.3 5.8.68-4.3 3.95 1.15 5.73L10 14.4l-5.12 2.86 1.15-5.73-4.3-3.95 5.8-.68z" />
    </svg>
  );
}

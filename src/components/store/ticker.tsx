import { Link } from "@/i18n/navigation";
import { ServerIcon } from "@/components/icons/server-icon";
import type { Settings } from "@/server/settings/schemas";

const SEPARATORS = { dot: "•", diamond: "◆", slash: "/", none: "" } as const;

/**
 * Announcement ticker. Pure CSS marquee (no JS): the track is duplicated and
 * translated by 50%. Direction follows the reading direction ("auto"): text
 * enters from the end edge in both LTR and RTL. Pauses on hover; collapses
 * to a static wrapped list under prefers-reduced-motion.
 */
export function Ticker({ items, settings, dir, svgs }: { items: { id: string; text: string; url: string | null; icon: string | null }[]; settings: Settings<"ticker">; dir: "rtl" | "ltr"; svgs?: Record<string, string> }) {
  if (!settings.enabled || !items.length) return null;
  const sep = SEPARATORS[settings.separator];
  const reverse = settings.direction === "reverse";
  // Repeat short lists so one half of the track is always wider than the viewport.
  const loop = items.length < 6 ? Array.from({ length: Math.ceil(6 / items.length) }, () => items).flat() : items;
  // Duration scales with content length so speed (px/s) feels consistent.
  const chars = loop.reduce((s, i) => s + i.text.length, 0);
  const duration = Math.max(12, (chars * 9) / settings.speed);
  const weight = { normal: "font-normal", medium: "font-medium", semibold: "font-semibold" }[settings.fontWeight];
  const Track = ({ hidden }: { hidden?: boolean }) => (
    <ul className="flex shrink-0 items-center" aria-hidden={hidden || undefined}>
      {loop.map((a, i) => (
        <li key={a.id + i} className="flex items-center whitespace-nowrap">
          {a.url ? (
            <Link href={a.url} tabIndex={hidden ? -1 : undefined} className="flex items-center gap-2 px-6 hover:underline">
              {a.icon && <ServerIcon value={a.icon} customSvgs={svgs} className="size-4 opacity-80" />}
              {a.text}
            </Link>
          ) : (
            <span className="flex items-center gap-2 px-6">
              {a.icon && <ServerIcon value={a.icon} customSvgs={svgs} className="size-4 opacity-80" />}
              {a.text}
            </span>
          )}
          {sep && <span className="opacity-40">{sep}</span>}
        </li>
      ))}
    </ul>
  );
  return (
    <div className="marquee overflow-hidden" style={{ backgroundColor: settings.background, color: settings.textColor }} role="region" aria-label="Announcements" dir={dir}>
      <div className={`marquee-track py-3 text-[13.5px] ${weight}`} style={{ ["--marquee-duration" as string]: `${duration}s` }} data-reverse={reverse} data-pause={settings.pauseOnHover}>
        <Track />
        <Track hidden />
      </div>
    </div>
  );
}

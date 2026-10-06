"use client";

import { useEffect, useState } from "react";
import { Timer } from "lucide-react";

/** Honest countdown to the real sale end date (never a fake, resetting timer). */
export function Countdown({ to, label }: { to: string; label: string }) {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  if (now === null) return null;
  const ms = new Date(to).getTime() - now;
  if (ms <= 0) return null;
  const d = Math.floor(ms / 86_400_000);
  const h = Math.floor((ms % 86_400_000) / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  const s = Math.floor((ms % 60_000) / 1000);
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    <p className="inline-flex items-center gap-2 rounded-full bg-sale/8 px-3 py-1.5 text-sm text-sale">
      <Timer className="size-4" />
      {label}
      <span className="tabular font-semibold" dir="ltr">
        {d > 0 ? `${d}d ` : ""}
        {pad(h)}:{pad(m)}:{pad(s)}
      </span>
    </p>
  );
}

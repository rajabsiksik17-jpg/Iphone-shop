"use client";

import { useEffect, useState } from "react";
import { useLocale } from "next-intl";
import { timeAgo } from "@/lib/time";

/**
 * Relative time ("5 minutes ago") that stays correct: refreshes every minute
 * and doesn't trigger hydration errors when the server and the browser render
 * a few seconds apart. The exact timestamp is available on hover.
 */
export function TimeAgo({ date, locale: localeProp, className }: { date: string | Date; locale?: string; className?: string }) {
  const current = useLocale();
  const locale = localeProp ?? current;
  const [, tick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => tick((n) => n + 1), 60_000);
    return () => clearInterval(id);
  }, []);
  const d = typeof date === "string" ? new Date(date) : date;
  return (
    <time dateTime={d.toISOString()} title={d.toLocaleString(locale === "ar" ? "ar-SA-u-ca-gregory-nu-latn" : "en-GB", { dateStyle: "medium", timeStyle: "short" })} className={className} suppressHydrationWarning>
      {timeAgo(d, locale)}
    </time>
  );
}

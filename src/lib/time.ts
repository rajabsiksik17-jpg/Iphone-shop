/** Localised relative time ("3 minutes ago" / "منذ 3 دقائق"). */
export function timeAgo(date: string | Date, locale: string) {
  const d = typeof date === "string" ? new Date(date) : date;
  const diff = (d.getTime() - Date.now()) / 1000;
  const rtf = new Intl.RelativeTimeFormat(locale === "ar" ? "ar" : "en", { numeric: "auto" });
  const abs = Math.abs(diff);
  if (abs < 60) return rtf.format(Math.round(diff), "second");
  if (abs < 3600) return rtf.format(Math.round(diff / 60), "minute");
  if (abs < 86_400) return rtf.format(Math.round(diff / 3600), "hour");
  if (abs < 30 * 86_400) return rtf.format(Math.round(diff / 86_400), "day");
  return d.toLocaleDateString(locale === "ar" ? "ar-JO" : "en-GB", { dateStyle: "medium" });
}

/** mm:ss or h:mm:ss elapsed since a date. */
export function elapsed(from: string | Date, now = Date.now()) {
  const s = Math.max(0, Math.floor((now - new Date(from).getTime()) / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = String(s % 60).padStart(2, "0");
  return h ? `${h}:${String(m).padStart(2, "0")}:${ss}` : `${String(m).padStart(2, "0")}:${ss}`;
}

export function fmtDate(d: string | Date, locale: string, withTime = false) {
  return new Date(d).toLocaleString(locale === "ar" ? "ar-JO" : "en-GB", withTime ? { dateStyle: "medium", timeStyle: "short" } : { dateStyle: "medium" });
}

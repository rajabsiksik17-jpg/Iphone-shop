"use client";

import { useEffect } from "react";
import { logSearchAction } from "@/actions/store";
import { recentSearches } from "@/lib/local-store";
import { track } from "@/lib/analytics-client";

/** Records a completed search once per query (powers popular searches & GA `search`). */
export function SearchTracker({ q, results }: { q: string; results: number }) {
  useEffect(() => {
    const key = `nq:searched:${q}`;
    try {
      if (sessionStorage.getItem(key)) return;
      sessionStorage.setItem(key, "1");
    } catch {
      /* ignore */
    }
    recentSearches.push(q);
    track.search(q);
    logSearchAction(q, results).catch(() => {});
  }, [q, results]);
  return null;
}

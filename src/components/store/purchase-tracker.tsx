"use client";

import { useEffect } from "react";
import { track } from "@/lib/analytics-client";

/** Fires the e-commerce `purchase` event exactly once per order (guards against refreshes). */
export function PurchaseTracker({ orderNumber, items, total, shipping }: { orderNumber: string; items: { id: string; name: string; price: number; quantity: number }[]; total: number; shipping: number }) {
  useEffect(() => {
    const key = `nq:purchase:${orderNumber}`;
    try {
      if (localStorage.getItem(key)) return;
      localStorage.setItem(key, "1");
    } catch {
      /* ignore */
    }
    // Give consent-gated tags a moment to initialise.
    const t = setTimeout(() => track.purchase(orderNumber, items, total, shipping), 1200);
    return () => clearTimeout(t);
  }, [orderNumber, items, total, shipping]);
  return null;
}

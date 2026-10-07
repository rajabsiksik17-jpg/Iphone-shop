"use client";

import { useLayoutEffect } from "react";

/**
 * Switches the document into admin mode (admin colour tokens + saved
 * light/dark theme) while any admin page is mounted, and back to the store's
 * tokens when leaving — including client-side navigations, where an inline
 * <script> would never run. First paint is handled by the boot script in the
 * root layout, so there's no flash.
 */
export function AdminMode() {
  useLayoutEffect(() => {
    const html = document.documentElement;
    html.classList.add("admin-mode");
    let theme = "system";
    try {
      theme = localStorage.getItem("nq:admin-theme") ?? "system";
    } catch {
      /* storage unavailable */
    }
    html.classList.toggle("ad-dark", theme === "dark" || (theme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches));
    return () => {
      html.classList.remove("admin-mode", "ad-dark");
    };
  }, []);
  return null;
}

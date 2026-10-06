"use client";

import { Toaster as Sonner } from "sonner";

export function Toaster({ dir }: { dir: "rtl" | "ltr" }) {
  return (
    <Sonner
      dir={dir}
      position={dir === "rtl" ? "bottom-left" : "bottom-right"}
      gap={10}
      offset={20}
      mobileOffset={{ bottom: 84 }}
      toastOptions={{
        classNames: {
          toast: "!rounded-2xl !border !border-border !bg-bg !text-fg !shadow-pop !font-sans !px-4 !py-3.5",
          description: "!text-muted",
          actionButton: "!rounded-full !bg-primary !text-primary-fg !font-medium",
        },
      }}
    />
  );
}

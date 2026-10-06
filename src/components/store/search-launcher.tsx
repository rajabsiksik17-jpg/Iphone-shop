"use client";

import { Button } from "@/components/ui/button";

/** Opens the global search overlay owned by the header. */
export function SearchLauncher({ label, icon }: { label: string; icon?: React.ReactNode }) {
  return (
    <Button size="lg" variant="outline" leftIcon={icon} onClick={() => window.dispatchEvent(new Event("nq:open-search"))}>
      {label}
    </Button>
  );
}

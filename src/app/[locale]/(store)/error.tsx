"use client";

import { useEffect } from "react";
import { useTranslations } from "next-intl";
import { RefreshCw, Home } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";

/** Friendly error boundary: no stack traces for shoppers; the digest helps support find the server log. */
export default function StoreError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const t = useTranslations();
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <div className="container-store grid min-h-[60dvh] place-items-center py-16 text-center">
      <div className="max-w-md">
        <h1 className="text-3xl font-semibold tracking-tight">{t("error.title")}</h1>
        <p className="mt-3 text-muted">{t("error.text")}</p>
        {error.digest && <p className="mt-2 font-mono text-xs text-muted/70">ref: {error.digest}</p>}
        <div className="mt-8 flex justify-center gap-3">
          <Button onClick={reset} leftIcon={<RefreshCw />}>
            {t("error.retry")}
          </Button>
          <Button asChild variant="outline" leftIcon={<Home />}>
            <Link href="/">{t("notFound.home")}</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}

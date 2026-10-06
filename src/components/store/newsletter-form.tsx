"use client";

import { useState, useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { ArrowRight, Check } from "lucide-react";
import { toast } from "sonner";
import { subscribeAction } from "@/actions/store";
import { useErrorMessage } from "@/lib/use-action";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";

export function NewsletterForm({ tone = "dark", source = "footer" }: { tone?: "dark" | "light"; source?: string }) {
  const t = useTranslations("footer");
  const locale = useLocale();
  const errorMessage = useErrorMessage();
  const [email, setEmail] = useState("");
  const [done, setDone] = useState(false);
  const [pending, start] = useTransition();

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const res = await subscribeAction(email, locale, source);
          if (res.ok) {
            setDone(true);
            toast.success(t("subscribed"));
          } else toast.error(errorMessage(res));
        });
      }}
      className={cn("flex h-12 w-full max-w-md items-center rounded-full p-1 ps-4 ring-1 transition focus-within:ring-2", tone === "dark" ? "bg-white/10 ring-white/15 focus-within:ring-white/40" : "bg-bg ring-border focus-within:ring-accent")}
    >
      <label htmlFor={`nl-${source}`} className="sr-only">
        {t("emailPlaceholder")}
      </label>
      <input
        id={`nl-${source}`}
        type="email"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder={t("emailPlaceholder")}
        disabled={done}
        className={cn("min-w-0 flex-1 bg-transparent text-sm outline-none", tone === "dark" ? "text-white placeholder:text-white/50" : "placeholder:text-muted")}
        autoComplete="email"
      />
      <button type="submit" disabled={pending || done} className={cn("flex h-10 items-center gap-2 rounded-full px-4 text-sm font-semibold transition", tone === "dark" ? "bg-white text-neutral-950 hover:bg-white/90" : "bg-primary text-primary-fg hover:bg-primary/90")}>
        {pending ? <Spinner className="size-4" /> : done ? <Check className="size-4" /> : <ArrowRight className="flip-rtl size-4" />}
        <span className="max-sm:sr-only">{done ? t("subscribed") : t("subscribe")}</span>
      </button>
    </form>
  );
}

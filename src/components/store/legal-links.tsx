import type { ReactNode } from "react";
import { Link } from "@/i18n/navigation";
import { LEGAL_PATHS } from "@/config/legal";

const linkClass = "font-medium text-fg underline decoration-fg/30 underline-offset-[3px] transition hover:decoration-fg focus-visible:rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

/**
 * Tag handlers for messages like "I agree to the <terms>…</terms> and the
 * <privacy>…</privacy>" (use with `t.rich`). The link text comes from the
 * message itself, so translations keep natural word order in both languages.
 * At checkout the pages open in a new tab so the shopper doesn't lose the form.
 */
export function legalLinkTags({ newTab = false }: { newTab?: boolean } = {}) {
  const extra = newTab ? { target: "_blank", rel: "noopener" } : {};
  return {
    terms: (chunks: ReactNode) => (
      <Link href={LEGAL_PATHS.terms} className={linkClass} {...extra}>
        {chunks}
      </Link>
    ),
    privacy: (chunks: ReactNode) => (
      <Link href={LEGAL_PATHS.privacy} className={linkClass} {...extra}>
        {chunks}
      </Link>
    ),
  };
}

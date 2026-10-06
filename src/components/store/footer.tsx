import { getTranslations } from "next-intl/server";
import { Mail, MapPin, Phone } from "lucide-react";
import { siApplepay, siMastercard, siVisa } from "simple-icons";
import { Link } from "@/i18n/navigation";
import { SocialIcon, socialLabel } from "@/components/ui/social-icon";
import { NewsletterForm } from "./newsletter-form";
import { CookiePrefsLink } from "./consent";
import { Logo } from "./header";
import { cn } from "@/lib/utils";
import type { ResolvedMenuItem } from "@/server/cms/queries";

type FooterProps = {
  storeName: string;
  logoUrl: string;
  about: string;
  style: "dark" | "light";
  showNewsletter: boolean;
  showPaymentIcons: boolean;
  paymentIcons: string[];
  menus: { title: string; items: ResolvedMenuItem[] }[];
  legal: ResolvedMenuItem[];
  social: { platform: string; url: string }[];
  contact: { phone: string; email: string; address: string };
};

const PAYMENT_ICONS: Record<string, { path: string; label: string }> = {
  visa: { path: siVisa.path, label: "Visa" },
  mastercard: { path: siMastercard.path, label: "Mastercard" },
  applepay: { path: siApplepay.path, label: "Apple Pay" },
};

export async function Footer(p: FooterProps) {
  const t = await getTranslations("footer");
  const dark = p.style === "dark";
  return (
    <footer className={cn(dark ? "bg-[#0b0f17] text-white/70" : "border-t border-border bg-surface text-muted")}>
      {p.showNewsletter && (
        <div className={cn("border-b", dark ? "border-white/10" : "border-border")}>
          <div className="container-store flex flex-col items-start justify-between gap-6 py-12 md:flex-row md:items-center">
            <div>
              <h2 className={cn("text-2xl font-semibold tracking-tight", dark ? "text-white" : "text-fg")}>{t("newsletterTitle")}</h2>
              <p className="mt-1 text-sm">{t("newsletterText")}</p>
            </div>
            <NewsletterForm tone={dark ? "dark" : "light"} />
          </div>
        </div>
      )}
      <div className="container-store grid gap-10 py-14 md:grid-cols-[1.3fr_repeat(3,1fr)] lg:grid-cols-[1.5fr_repeat(4,1fr)]">
        <div className="max-w-sm">
          <Link href="/" className={dark ? "text-white" : "text-fg"}>
            <Logo name={p.storeName} url={p.logoUrl} />
          </Link>
          <p className="mt-4 text-sm leading-relaxed">{p.about}</p>
          <ul className="mt-5 space-y-2 text-sm">
            {p.contact.phone && (
              <li className="flex items-center gap-2.5">
                <Phone className="size-4 opacity-70" />
                <a href={`tel:${p.contact.phone.replace(/\s/g, "")}`} dir="ltr" className="hover:underline">
                  {p.contact.phone}
                </a>
              </li>
            )}
            {p.contact.email && (
              <li className="flex items-center gap-2.5">
                <Mail className="size-4 opacity-70" />
                <a href={`mailto:${p.contact.email}`} className="hover:underline">
                  {p.contact.email}
                </a>
              </li>
            )}
            {p.contact.address && (
              <li className="flex items-center gap-2.5">
                <MapPin className="size-4 opacity-70" />
                {p.contact.address}
              </li>
            )}
          </ul>
          {p.social.length > 0 && (
            <div className="mt-6 flex flex-wrap gap-2">
              {p.social.map((s) => (
                <a
                  key={s.platform}
                  href={s.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={socialLabel(s.platform)}
                  className={cn("grid size-10 place-items-center rounded-full transition", dark ? "bg-white/8 hover:bg-white/15 hover:text-white" : "bg-bg hover:text-fg")}
                >
                  <SocialIcon platform={s.platform} className="size-[18px]" />
                </a>
              ))}
            </div>
          )}
        </div>
        {p.menus
          .filter((m) => m.items.length)
          .map((m) => (
            <nav key={m.title} aria-label={m.title}>
              <h3 className={cn("mb-4 text-sm font-semibold", dark ? "text-white" : "text-fg")}>{m.title}</h3>
              <ul className="space-y-2.5 text-sm">
                {m.items.map((i) => (
                  <li key={i.id}>
                    <Link href={i.href} className={cn("transition", dark ? "hover:text-white" : "hover:text-fg")}>
                      {i.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
      </div>
      <div className={cn("border-t", dark ? "border-white/10" : "border-border")}>
        <div className="container-store flex flex-col items-center justify-between gap-4 py-6 pb-24 text-xs md:flex-row md:pb-6">
          <p>{t("rights", { year: new Date().getFullYear(), store: p.storeName })}</p>
          <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2">
            {p.legal.map((l) => (
              <Link key={l.id} href={l.href} className={dark ? "hover:text-white" : "hover:text-fg"}>
                {l.label}
              </Link>
            ))}
            <CookiePrefsLink className={dark ? "hover:text-white" : "hover:text-fg"} />
          </div>
          {p.showPaymentIcons && (
            <div className="flex items-center gap-2" aria-label={t("weAccept")}>
              {p.paymentIcons.map((k) =>
                PAYMENT_ICONS[k] ? (
                  <span key={k} title={PAYMENT_ICONS[k].label} className={cn("grid h-7 w-11 place-items-center rounded-md", dark ? "bg-white/90 text-neutral-900" : "bg-bg text-fg ring-1 ring-border")}>
                    <svg viewBox="0 0 24 24" className="h-4 w-8" fill="currentColor" aria-label={PAYMENT_ICONS[k].label} role="img">
                      <path d={PAYMENT_ICONS[k].path} />
                    </svg>
                  </span>
                ) : k === "cod" ? (
                  <span key={k} className={cn("grid h-7 place-items-center rounded-md px-2 text-[10px] font-bold", dark ? "bg-white/90 text-neutral-900" : "bg-bg text-fg ring-1 ring-border")}>
                    COD
                  </span>
                ) : null,
              )}
            </div>
          )}
        </div>
      </div>
      {/* Clearance for the fixed mobile tab bar, painted in the footer's own colour. */}
      <div aria-hidden className="h-[calc(4rem+env(safe-area-inset-bottom))] md:hidden" />
    </footer>
  );
}

"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { MessageCircle, Share2, X, MessagesSquare } from "lucide-react";
import { SocialIcon, socialLabel } from "@/components/ui/social-icon";
import { useStore } from "@/components/providers/store-context";
import { usePathname } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import type { Settings } from "@/server/settings/schemas";

type Props = {
  widgets: Settings<"widgets">;
  social: { platform: string; url: string }[];
  whatsappMessage: string;
  chatAvailable: boolean;
};

const SIZES = { sm: "size-11", md: "size-12", lg: "size-14" } as const;

function useOutside(ref: React.RefObject<HTMLElement | null>, close: () => void, active: boolean) {
  useEffect(() => {
    if (!active) return;
    const onDown = (e: PointerEvent) => !ref.current?.contains(e.target as Node) && close();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [ref, close, active]);
}

/** True while the page is being scrolled down (past the first screen); false on scroll up or when idle. */
function useTuckOnScroll() {
  const [tucked, setTucked] = useState(false);
  useEffect(() => {
    let last = window.scrollY;
    let idle: ReturnType<typeof setTimeout> | undefined;
    const onScroll = () => {
      const y = window.scrollY;
      if (Math.abs(y - last) > 6) setTucked(y > last && y > 120);
      last = y;
      clearTimeout(idle);
      idle = setTimeout(() => setTucked(false), 900);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      clearTimeout(idle);
    };
  }, []);
  return tucked;
}

/**
 * Two unobtrusive floating launchers on opposite edges: social links and
 * support (WhatsApp / live chat). Social links are desktop-only (phones reach
 * them from the footer and menu, and a second bubble would cover content);
 * both hide while the cart drawer or chat is open.
 */
export function FloatingWidgets({ widgets, social, whatsappMessage, chatAvailable }: Props) {
  const t = useTranslations("widgets");
  const { cartOpen, setChatOpen, chatOpen } = useStore();
  const pathname = usePathname();
  const onCheckout = pathname.startsWith("/checkout");
  const tucked = useTuckOnScroll();
  const [socialOpen, setSocialOpen] = useState(false);
  const [supportOpen, setSupportOpen] = useState(false);
  const socialRef = useRef<HTMLDivElement>(null);
  const supportRef = useRef<HTMLDivElement>(null);
  useOutside(socialRef, () => setSocialOpen(false), socialOpen);
  useOutside(supportRef, () => setSupportOpen(false), supportOpen);

  const floatingSocial = social;
  const waNumber = widgets.whatsapp.number.replace(/[^\d]/g, "");
  const waHref = waNumber ? `https://wa.me/${waNumber}?text=${encodeURIComponent(whatsappMessage)}` : null;
  const supportItems = [widgets.support.whatsapp && waHref ? "whatsapp" : null, widgets.support.liveChat && chatAvailable ? "chat" : null].filter(Boolean) as ("whatsapp" | "chat")[];

  if (cartOpen || chatOpen) return null;
  // Phones: launchers sit above the tab bar (or checkout's order bar) and tuck away while the
  // shopper scrolls down through content, so they never cover what's being read.
  const bottom = onCheckout ? "bottom-[104px]" : "bottom-[88px]";
  const pos = (side: "start" | "end") => (side === "start" ? "start-4 md:start-6" : "end-4 md:end-6");
  const size = SIZES[widgets.social.size];
  const anim = widgets.social.animation === "float" ? "motion-safe:animate-[fade-up_0.6s_ease_both]" : "";

  return (
    <>
      {widgets.social.enabled && floatingSocial.length > 0 && (
        <div ref={socialRef} className={cn("fixed bottom-6 z-30 hidden flex-col items-center gap-2 md:flex", pos(widgets.social.side), anim)}>
          <div className={cn("flex flex-col-reverse items-center gap-2 transition-all duration-300", socialOpen ? "pointer-events-auto translate-y-0 opacity-100" : "pointer-events-none translate-y-3 opacity-0")} aria-hidden={!socialOpen}>
            {floatingSocial.map((s, i) => (
              <a
                key={s.platform}
                href={s.url}
                target="_blank"
                rel="noopener noreferrer"
                tabIndex={socialOpen ? 0 : -1}
                aria-label={socialLabel(s.platform)}
                className="grid size-11 place-items-center rounded-full bg-bg shadow-pop ring-1 ring-black/5 transition hover:scale-110"
                style={{ transitionDelay: socialOpen ? `${i * 35}ms` : "0ms" }}
              >
                <SocialIcon platform={s.platform} brandColor={widgets.social.style === "brand"} className="size-5" />
              </a>
            ))}
          </div>
          <button
            type="button"
            onClick={() => setSocialOpen((o) => !o)}
            aria-expanded={socialOpen}
            aria-label={t("social")}
            className={cn("grid place-items-center rounded-full bg-bg text-fg shadow-pop ring-1 ring-black/5 transition hover:scale-105 max-md:size-11", size, widgets.social.animation === "pulse" && !socialOpen && "motion-safe:animate-pulse")}
          >
            {socialOpen ? <X className="size-5" /> : <Share2 className="size-5" />}
          </button>
        </div>
      )}

      {widgets.support.enabled && supportItems.length > 0 && (
        <div
          ref={supportRef}
          className={cn(
            "fixed z-30 flex flex-col items-end gap-2 transition-[transform,opacity] duration-300 md:bottom-6 md:translate-y-0 md:opacity-100",
            bottom,
            pos(widgets.support.side),
            widgets.support.side === "start" && "items-start",
            tucked && !supportOpen && "max-md:pointer-events-none max-md:translate-y-4 max-md:opacity-0",
          )}
        >
          {supportItems.length > 1 && (
            <div className={cn("flex flex-col gap-2 transition-all duration-300", supportOpen ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-3 opacity-0")} aria-hidden={!supportOpen}>
              {supportItems.includes("chat") && (
                <button type="button" tabIndex={supportOpen ? 0 : -1} onClick={() => (setSupportOpen(false), setChatOpen(true))} className="flex h-11 items-center gap-2.5 rounded-full bg-bg px-4 text-sm font-medium shadow-pop ring-1 ring-black/5 transition hover:scale-[1.03]">
                  <MessagesSquare className="size-5 text-accent" />
                  {t("liveChat")}
                </button>
              )}
              {supportItems.includes("whatsapp") && (
                <a href={waHref!} target="_blank" rel="noopener noreferrer" tabIndex={supportOpen ? 0 : -1} className="flex h-11 items-center gap-2.5 rounded-full bg-bg px-4 text-sm font-medium shadow-pop ring-1 ring-black/5 transition hover:scale-[1.03]">
                  <SocialIcon platform="whatsapp" brandColor className="size-5" />
                  {t("whatsapp")}
                </a>
              )}
            </div>
          )}
          {supportItems.length === 1 && supportItems[0] === "whatsapp" ? (
            <a href={waHref!} target="_blank" rel="noopener noreferrer" aria-label={t("whatsapp")} className="grid size-12 place-items-center rounded-full bg-[#25D366] text-white shadow-pop transition hover:scale-105 max-md:size-11">
              <SocialIcon platform="whatsapp" className="size-6" />
            </a>
          ) : (
            <button
              type="button"
              onClick={() => (supportItems.length === 1 ? setChatOpen(true) : setSupportOpen((o) => !o))}
              aria-expanded={supportItems.length > 1 ? supportOpen : undefined}
              aria-label={t("support")}
              className="grid size-12 place-items-center rounded-full bg-primary text-primary-fg shadow-pop transition hover:scale-105 max-md:size-11"
            >
              {supportOpen ? <X className="size-5" /> : <MessageCircle className="size-[22px]" />}
            </button>
          )}
        </div>
      )}
    </>
  );
}

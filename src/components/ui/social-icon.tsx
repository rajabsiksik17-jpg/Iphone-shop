import { siDiscord, siFacebook, siInstagram, siPinterest, siReddit, siSnapchat, siTelegram, siThreads, siTiktok, siWhatsapp, siX, siYoutube } from "simple-icons";
import { Globe } from "lucide-react";

type SimpleIcon = { title: string; path: string; hex: string };

/**
 * Recognisable platform icons, bundled (no admin uploads, no external
 * requests). LinkedIn's mark isn't in simple-icons for licensing reasons,
 * so a faithful path is inlined.
 */
const LINKEDIN: SimpleIcon = {
  title: "LinkedIn",
  hex: "0A66C2",
  path: "M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 1 1 0-4.125 2.062 2.062 0 0 1 0 4.125zM7.119 20.452H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z",
};

export const SOCIAL_PLATFORMS: Record<string, { label: string; icon: SimpleIcon }> = {
  facebook: { label: "Facebook", icon: siFacebook },
  instagram: { label: "Instagram", icon: siInstagram },
  tiktok: { label: "TikTok", icon: siTiktok },
  youtube: { label: "YouTube", icon: siYoutube },
  x: { label: "X", icon: siX },
  linkedin: { label: "LinkedIn", icon: LINKEDIN },
  snapchat: { label: "Snapchat", icon: siSnapchat },
  telegram: { label: "Telegram", icon: siTelegram },
  whatsapp: { label: "WhatsApp", icon: siWhatsapp },
  pinterest: { label: "Pinterest", icon: siPinterest },
  threads: { label: "Threads", icon: siThreads },
  discord: { label: "Discord", icon: siDiscord },
  reddit: { label: "Reddit", icon: siReddit },
};

export function SocialIcon({ platform, className, brandColor }: { platform: string; className?: string; brandColor?: boolean }) {
  const p = SOCIAL_PLATFORMS[platform];
  if (!p) return <Globe className={className} aria-hidden />;
  return (
    <svg viewBox="0 0 24 24" className={className} fill={brandColor ? `#${p.icon.hex}` : "currentColor"} aria-hidden>
      <path d={p.icon.path} />
    </svg>
  );
}

export const socialLabel = (platform: string) => SOCIAL_PLATFORMS[platform]?.label ?? platform;

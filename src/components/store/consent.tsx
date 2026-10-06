"use client";

import { useEffect, useState } from "react";
import Script from "next/script";
import { useTranslations } from "next-intl";
import { Cookie } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { useStore } from "@/components/providers/store-context";
import { readConsent, writeConsent, type Consent } from "@/lib/analytics-client";

function useConsent() {
  const [consent, setConsent] = useState<Consent | null>(null);
  useEffect(() => {
    setConsent(readConsent());
    const onChange = () => setConsent(readConsent());
    window.addEventListener("nq:consent", onChange);
    return () => window.removeEventListener("nq:consent", onChange);
  }, []);
  return consent;
}

/** Cookie banner — shown only when tracking tags exist and consent is required. */
export function ConsentBanner() {
  const t = useTranslations("consent");
  const { analytics } = useStore();
  const consent = useConsent();
  const [custom, setCustom] = useState(false);
  const [a, setA] = useState(true);
  const [m, setM] = useState(false);
  const [forced, setForced] = useState(false);

  useEffect(() => {
    const open = () => setForced(true);
    window.addEventListener("nq:consent-open", open);
    return () => window.removeEventListener("nq:consent-open", open);
  }, []);

  const hasTags = Boolean(analytics.gaId || analytics.metaPixelId || analytics.tiktokPixel);
  if (!consent || !analytics.consentBanner || !analytics.requireConsent || !hasTags) return null;
  if (consent.decided && !forced) return null;

  const decide = (c: { analytics: boolean; marketing: boolean }) => {
    writeConsent(c);
    setForced(false);
  };

  return (
    <div role="dialog" aria-live="polite" aria-label={t("title")} className="animate-fade-up fixed inset-x-3 bottom-20 z-[60] mx-auto max-w-xl rounded-3xl border border-border bg-bg p-5 shadow-pop md:bottom-5 md:start-5 md:end-auto md:mx-0">
      <div className="flex gap-3">
        <Cookie className="mt-0.5 size-5 shrink-0 text-accent" />
        <div className="min-w-0">
          <h2 className="font-semibold">{t("title")}</h2>
          <p className="mt-1 text-sm text-muted">
            {t("text")}{" "}
            <Link href="/cookies" className="underline underline-offset-2">
              {t("policy")}
            </Link>
          </p>
        </div>
      </div>
      {custom && (
        <div className="mt-4 space-y-2 rounded-2xl bg-surface p-3 text-sm">
          <label className="flex items-center justify-between opacity-70">
            {t("essential")}
            <input type="checkbox" checked disabled className="size-4 accent-[var(--color-accent)]" />
          </label>
          <label className="flex items-center justify-between">
            {t("analytics")}
            <input type="checkbox" checked={a} onChange={(e) => setA(e.target.checked)} className="size-4 accent-[var(--color-accent)]" />
          </label>
          <label className="flex items-center justify-between">
            {t("marketing")}
            <input type="checkbox" checked={m} onChange={(e) => setM(e.target.checked)} className="size-4 accent-[var(--color-accent)]" />
          </label>
        </div>
      )}
      <div className="mt-4 flex flex-wrap gap-2">
        {custom ? (
          <Button size="sm" onClick={() => decide({ analytics: a, marketing: m })}>
            {t("save")}
          </Button>
        ) : (
          <>
            <Button size="sm" onClick={() => decide({ analytics: true, marketing: true })}>
              {t("accept")}
            </Button>
            <Button size="sm" variant="outline" onClick={() => decide({ analytics: false, marketing: false })}>
              {t("reject")}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setCustom(true)}>
              {t("customize")}
            </Button>
          </>
        )}
      </div>
    </div>
  );
}

export function CookiePrefsLink({ className }: { className?: string }) {
  const t = useTranslations("footer");
  return (
    <button type="button" className={className} onClick={() => window.dispatchEvent(new Event("nq:consent-open"))}>
      {t("cookiePrefs")}
    </button>
  );
}

/**
 * Loads GA4 / Meta / TikTok only with the matching consent (or when the store
 * disabled consent requirements). GA uses Consent Mode v2 defaults = denied.
 */
export function AnalyticsScripts() {
  const { analytics, money } = useStore();
  const consent = useConsent();
  useEffect(() => {
    window.__nqMoney = { currency: money.base.code, decimals: money.base.decimals };
  }, [money]);
  if (!consent) return null;
  const allowAnalytics = !analytics.requireConsent || consent.analytics;
  const allowMarketing = !analytics.requireConsent || consent.marketing;
  return (
    <>
      {analytics.gaId && allowAnalytics && (
        <>
          <Script id="ga-init" strategy="afterInteractive">
            {`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments)}window.gtag=gtag;gtag('consent','default',{analytics_storage:'${allowAnalytics ? "granted" : "denied"}',ad_storage:'${allowMarketing ? "granted" : "denied"}',ad_user_data:'${allowMarketing ? "granted" : "denied"}',ad_personalization:'${allowMarketing ? "granted" : "denied"}'});gtag('js',new Date());gtag('config',${JSON.stringify(analytics.gaId)},{anonymize_ip:true});`}
          </Script>
          <Script src={`https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(analytics.gaId)}`} strategy="afterInteractive" />
        </>
      )}
      {analytics.metaPixelId && allowMarketing && (
        <Script id="meta-pixel" strategy="afterInteractive">
          {`!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');fbq('init',${JSON.stringify(analytics.metaPixelId)});fbq('track','PageView');`}
        </Script>
      )}
      {analytics.tiktokPixel && allowMarketing && (
        <Script id="tiktok-pixel" strategy="afterInteractive">
          {`!function(w,d,t){w.TiktokAnalyticsObject=t;var ttq=w[t]=w[t]||[];ttq.methods=["page","track","identify","instances","debug","on","off","once","ready","alias","group","enableCookie","disableCookie"];ttq.setAndDefer=function(t,e){t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}};for(var i=0;i<ttq.methods.length;i++)ttq.setAndDefer(ttq,ttq.methods[i]);ttq.load=function(e){var i="https://analytics.tiktok.com/i18n/pixel/events.js";ttq._i=ttq._i||{};ttq._i[e]=[];ttq._u=i;var o=d.createElement("script");o.type="text/javascript";o.async=!0;o.src=i+"?sdkid="+e+"&lib="+t;var a=d.getElementsByTagName("script")[0];a.parentNode.insertBefore(o,a)};ttq.load(${JSON.stringify(analytics.tiktokPixel)});ttq.page()}(window,document,'ttq');`}
        </Script>
      )}
    </>
  );
}

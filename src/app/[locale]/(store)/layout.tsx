import type { ReactNode } from "react";
import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Wrench } from "lucide-react";
import { getStorefrontShell } from "@/server/storefront";
import { getCurrentStaff } from "@/server/auth/session";
import { getSocialLinks } from "@/server/cms/queries";
import { ClientShell } from "@/components/store/client-shell";
import { Header, MobileTabBar } from "@/components/store/header";
import { Footer } from "@/components/store/footer";
import { FloatingWidgets } from "@/components/store/floating-widgets";
import { ChatWidget } from "@/components/store/chat-widget";
import { AnalyticsScripts, ConsentBanner } from "@/components/store/consent";
import { JsonLd, organizationJsonLd, websiteJsonLd } from "@/components/seo/json-ld";
import { formatMoney } from "@/lib/money";
import { t as tr } from "@/lib/i18n-text";
import { siteMetadata } from "@/server/seo";
import { localeMeta, type Locale } from "@/i18n/config";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const locale = (await params).locale as Locale;
  return siteMetadata(locale);
}

export default async function StoreLayout({ children, params }: { children: ReactNode; params: Promise<{ locale: string }> }) {
  const locale = (await params).locale as Locale;
  setRequestLocale(locale);
  const shell = await getStorefrontShell(locale);
  const { settings, config } = shell;
  const t = await getTranslations();

  // Maintenance mode: staff signed into the admin can still browse.
  if (settings.maintenance.enabled && !(settings.maintenance.allowStaff && (await getCurrentStaff()))) {
    return (
      <main className="grid min-h-dvh place-items-center bg-surface px-6 text-center">
        <div className="max-w-md">
          <div className="mx-auto mb-6 grid size-16 place-items-center rounded-2xl bg-bg shadow-card">
            <Wrench className="size-7 text-accent" />
          </div>
          <h1 className="text-3xl font-semibold tracking-tight">{tr(settings.maintenance.title, locale)}</h1>
          <p className="mt-3 text-muted">{tr(settings.maintenance.message, locale)}</p>
          {settings.maintenance.until && <p className="mt-4 text-sm text-muted">{t("maintenance.back", { when: new Date(settings.maintenance.until).toLocaleString(localeMeta[locale].intl, { dateStyle: "medium", timeStyle: "short" }) })}</p>}
        </div>
      </main>
    );
  }

  const freeShippingText = config.freeShippingThreshold ? t("header.freeShippingOver", { amount: formatMoney(config.freeShippingThreshold, config.money, { trimZeros: true }) }) : null;
  const floating = await getSocialLinks("floating");
  const footerSocial = await getSocialLinks("footer");
  const waNumber = settings.widgets.whatsapp.number.replace(/[^\d]/g, "");
  const waMessage = tr(settings.widgets.whatsapp.message, locale);

  return (
    <ClientShell config={config} cartCount={shell.cartCount} wishlist={shell.wishlist}>
      <JsonLd data={[organizationJsonLd(shell, locale), websiteJsonLd(shell, locale)]} />
      <div className="flex min-h-dvh flex-col [&>*]:min-w-0">
      <Header
        storeName={config.storeName}
        logoUrl={settings.store.logoUrl}
        menu={shell.menus.header}
        topLinks={shell.menus.topbar}
        freeShippingText={freeShippingText}
        sticky={settings.appearance.header.sticky}
        blur={settings.appearance.header.style === "blur"}
        showCategoryBar={settings.appearance.header.showCategoryBar}
      />
      {/* Bottom spacing lives in .store-main (globals.css), not on the footer, so a
          coloured last section meets the footer without a white band. */}
      <main id="main" className="store-main flex-1">
        {children}
      </main>
      <Footer
        storeName={config.storeName}
        logoUrl={settings.store.logoDarkUrl || settings.store.logoUrl}
        about={tr(settings.appearance.footer.about, locale)}
        style={settings.appearance.footer.style}
        showNewsletter={settings.appearance.footer.showNewsletter}
        showPaymentIcons={settings.appearance.footer.showPaymentIcons}
        paymentIcons={settings.appearance.footer.paymentIcons}
        menus={[
          { title: t("footer.shop"), items: shell.menus.footerShop },
          { title: t("footer.help"), items: shell.menus.footerHelp },
          { title: t("footer.company"), items: shell.menus.footerCompany },
        ]}
        legal={shell.menus.footerLegal}
        social={footerSocial}
        contact={{ phone: settings.contact.phone || settings.store.phone, email: settings.contact.email || settings.store.email, address: tr(settings.contact.address, locale) || tr(settings.store.address, locale) }}
      />
      </div>
      <MobileTabBar />
      <FloatingWidgets widgets={settings.widgets} social={floating} whatsappMessage={waMessage} chatAvailable={settings.chat.enabled} />
      <ChatWidget whatsappHref={waNumber ? `https://wa.me/${waNumber}?text=${encodeURIComponent(waMessage)}` : null} offlineText={tr(settings.chat.offline, locale)} />
      <ConsentBanner />
      <AnalyticsScripts />
    </ClientShell>
  );
}

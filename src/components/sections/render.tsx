import { getTranslations } from "next-intl/server";
import { ArrowRight, Clock, Mail, MapPin, MessagesSquare, Phone, Quote, ChevronDown, BadgeCheck } from "lucide-react";
import { db } from "@/server/db";
import { t as tr } from "@/lib/i18n-text";
import { cn } from "@/lib/utils";
import { Link } from "@/i18n/navigation";
import { getSlider, getAnnouncements, getFaqs, getSocialLinks, approvedTestimonials } from "@/server/cms/queries";
import { productCollection, type CollectionSource } from "@/server/catalog/product";
import { categoryTree, listBrands } from "@/server/catalog/taxonomy";
import { imageDTO } from "@/server/catalog/dto";
import { getManySettings } from "@/server/settings/service";
import { sanitizeCustom, sanitizeRich } from "@/server/sanitize";
import { SectionShell } from "./section-shell";
import { HeroSlider } from "./hero-slider";
import { ProductRail } from "./product-rail";
import { LiteVideo } from "./lite-video";
import { Ticker } from "@/components/store/ticker";
import { ProductGrid } from "@/components/store/product-card";
import { NewsletterForm } from "@/components/store/newsletter-form";
import { ContactForm } from "@/components/store/contact-form";
import { Picture } from "@/components/ui/picture";
import { SectionHeading } from "@/components/ui/misc";
import { Stars } from "@/components/ui/rating";
import { CmsIcon } from "@/components/ui/icon";
import { SocialIcon, socialLabel } from "@/components/ui/social-icon";
import { JsonLd, faqJsonLd } from "@/components/seo/json-ld";
import type { SectionStyle } from "@/cms/sections";
import type { Locale } from "@/i18n/config";

type Section = { id: string; type: string; data: Record<string, unknown>; style: SectionStyle };
type Ctx = { locale: Locale; first: boolean };

const s = (v: unknown, locale: string) => tr(v, locale);
const img = (v: unknown) => (v && typeof v === "object" && "url" in v ? (v as { id?: string; url: string }) : null);

async function mediaFor(v: unknown, locale: string, alt: string) {
  const ref = img(v);
  if (!ref) return null;
  if (ref.id) {
    const m = await db.media.findUnique({ where: { id: ref.id } });
    if (m) return imageDTO(m, locale, alt);
  }
  return { url: ref.url, alt, width: null, height: null, blur: null, srcSet: [] };
}

const renderers: Record<string, (sec: Section, ctx: Ctx) => Promise<React.ReactNode>> = {
  async hero_slider({ data, style }, { locale }) {
    const slider = await getSlider(String(data.slider || "home"), locale);
    if (!slider?.slides.length) return null;
    return (
      <SectionShell style={{ ...style, width: "full" }} flush>
        <HeroSlider slides={slider.slides} settings={slider.settings} height={(data.height as "md" | "lg" | "screen") ?? "lg"} rounded={Boolean(data.rounded)} />
      </SectionShell>
    );
  },

  async ticker(_sec, { locale }) {
    const [items, { ticker }] = await Promise.all([getAnnouncements(locale), getManySettings(["ticker"])]);
    return <Ticker items={items} settings={ticker} dir={locale === "ar" ? "rtl" : "ltr"} />;
  },

  async category_grid({ data, style }, { locale }) {
    const tree = await categoryTree(locale);
    const flat = (nodes: typeof tree): typeof tree => nodes.flatMap((n) => [n, ...flat(n.children)]);
    const all = flat(tree);
    const limit = Number(data.limit ?? 8);
    let list = data.source === "manual" ? ((data.categories as string[]) ?? []).map((id) => all.find((c) => c.id === id)).filter((c): c is (typeof all)[number] => Boolean(c)) : data.source === "roots" ? tree : all.filter((c) => c.isFeatured);
    list = list.slice(0, limit);
    if (!list.length) return null;
    const layout = (data.layout as string) ?? "tiles";
    return (
      <SectionShell style={style}>
        <SectionHeading title={s(data.title, locale)} subtitle={s(data.subtitle, locale)} align={style.align} />
        {layout === "chips" ? (
          <div className={cn("flex flex-wrap gap-2", style.align === "center" && "justify-center")}>
            {list.map((c) => (
              <Link key={c.id} href={`/category/${c.fullSlug}`} className="rounded-full border border-border bg-bg px-4 py-2 text-sm font-medium transition hover:border-fg/30 hover:bg-surface">
                {c.name}
              </Link>
            ))}
          </div>
        ) : layout === "circles" ? (
          <div className="no-scrollbar -mx-4 flex gap-5 overflow-x-auto px-4 sm:mx-0 sm:grid sm:grid-cols-[repeat(auto-fill,minmax(120px,1fr))] sm:px-0">
            {list.map((c) => (
              <Link key={c.id} href={`/category/${c.fullSlug}`} className="group flex w-24 shrink-0 flex-col items-center gap-3 text-center sm:w-auto">
                <Picture image={c.image} sizes="120px" className="aspect-square w-full rounded-full bg-surface ring-1 ring-border transition group-hover:ring-2 group-hover:ring-accent" />
                <span className="text-sm font-medium">{c.name}</span>
              </Link>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-6">
            {list.map((c, i) => (
              <Link key={c.id} href={`/category/${c.fullSlug}`} className={cn("group relative overflow-hidden rounded-card bg-surface", i === 0 && list.length >= 5 && "md:row-span-1")}>
                <Picture image={c.image} sizes="(min-width:1024px) 16vw, 45vw" className="aspect-square transition duration-700 group-hover:scale-105" />
                <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-2 bg-gradient-to-t from-black/45 to-transparent p-3 pt-10 text-white">
                  <span className="text-[15px] font-semibold drop-shadow">{c.name}</span>
                  <ArrowRight className="flip-rtl size-4 -translate-x-1 opacity-0 transition group-hover:translate-x-0 group-hover:opacity-100 rtl:translate-x-1" />
                </div>
              </Link>
            ))}
          </div>
        )}
      </SectionShell>
    );
  },

  async product_carousel({ data, style }, { locale }) {
    const t = await getTranslations("common");
    const products = await productCollection((data.source as CollectionSource) ?? "featured", locale, {
      limit: Number(data.limit ?? 10),
      categoryId: (data.category as string) || undefined,
      brandId: (data.brand as string) || undefined,
      ids: (data.products as string[]) ?? [],
    });
    if (!products.length) return null;
    const viewAll = data.viewAll as string;
    return (
      <SectionShell style={style}>
        <SectionHeading
          title={s(data.title, locale)}
          subtitle={s(data.subtitle, locale)}
          align={style.align}
          action={
            viewAll ? (
              <Link href={viewAll} className="group flex items-center gap-1.5 text-sm font-medium text-fg/80 hover:text-fg">
                {t("viewAll")}
                <ArrowRight className="flip-rtl size-4 transition group-hover:translate-x-0.5 rtl:group-hover:-translate-x-0.5" />
              </Link>
            ) : undefined
          }
        />
        {data.layout === "grid" ? <ProductGrid products={products} /> : <ProductRail products={products} />}
      </SectionShell>
    );
  },

  async brand_strip({ data, style }, { locale }) {
    const brands = await listBrands(locale, { featuredOnly: data.source !== "all" });
    if (!brands.length) return null;
    return (
      <SectionShell style={style}>
        <SectionHeading title={s(data.title, locale)} subtitle={s(data.subtitle, locale)} align={style.align} />
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-7">
          {brands.map((b) => (
            <Link key={b.id} href={`/brand/${b.slug}`} className="group grid h-20 place-items-center rounded-card border border-border bg-bg px-4 transition hover:border-fg/20 hover:shadow-card">
              {b.logo ? (
                <Picture image={b.logo} sizes="160px" fit="contain" className={cn("h-10 w-full transition", data.grayscale ? "opacity-60 grayscale group-hover:opacity-100 group-hover:grayscale-0" : "")} />
              ) : (
                <span className="font-semibold">{b.name}</span>
              )}
              <span className="sr-only">{b.name}</span>
            </Link>
          ))}
        </div>
      </SectionShell>
    );
  },

  async promo_banners({ data, style }, { locale }) {
    const items = (data.items as Record<string, unknown>[]) ?? [];
    if (!items.length) return null;
    const media = await Promise.all(items.map((i) => mediaFor(i.image, locale, s(i.title, locale))));
    return (
      <SectionShell style={style}>
        <div className={cn("grid gap-4", items.length === 2 && "md:grid-cols-2", items.length >= 3 && "md:grid-cols-3")}>
          {items.map((it, i) => {
            const light = it.theme !== "dark";
            const inner = (
              <div className={cn("group relative flex min-h-[280px] overflow-hidden rounded-[calc(var(--nq-radius)*1.4)] md:min-h-[340px]", light ? "text-white" : "text-neutral-950")} style={{ backgroundColor: (it.background as string) || "#0f172a" }}>
                {media[i] && <Picture image={media[i]} sizes="(min-width:768px) 50vw, 100vw" className="absolute inset-0 transition duration-1000 group-hover:scale-[1.03]" />}
                {media[i] && light && <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-black/10 to-transparent" />}
                <div className="relative mt-auto p-6 md:p-8">
                  {s(it.eyebrow, locale) && <p className="text-xs font-semibold uppercase tracking-[0.14em] opacity-80">{s(it.eyebrow, locale)}</p>}
                  <h3 className="mt-2 text-2xl font-semibold tracking-tight md:text-3xl">{s(it.title, locale)}</h3>
                  {s(it.text, locale) && <p className="mt-2 max-w-sm text-sm opacity-85">{s(it.text, locale)}</p>}
                  {s(it.cta, locale) && (
                    <span className={cn("mt-5 inline-flex h-10 items-center gap-2 rounded-btn px-5 text-sm font-semibold transition group-hover:gap-3", light ? "bg-white text-neutral-950" : "bg-neutral-950 text-white")}>
                      {s(it.cta, locale)}
                      <ArrowRight className="flip-rtl size-4" />
                    </span>
                  )}
                </div>
              </div>
            );
            return it.href ? (
              <Link key={i} href={it.href as string} className="block">
                {inner}
              </Link>
            ) : (
              <div key={i}>{inner}</div>
            );
          })}
        </div>
      </SectionShell>
    );
  },

  async features({ data, style }, { locale }) {
    const items = (data.items as Record<string, unknown>[]) ?? [];
    if (!items.length) return null;
    return (
      <SectionShell style={style}>
        <SectionHeading title={s(data.title, locale)} subtitle={s(data.subtitle, locale)} align={style.align} />
        <div className={cn("grid gap-4 sm:grid-cols-2", items.length >= 4 ? "lg:grid-cols-4" : "lg:grid-cols-3")}>
          {items.map((it, i) => (
            <div key={i} className="flex gap-4 rounded-card border border-border bg-bg p-5 transition hover:shadow-card">
              <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-accent/10 text-accent">
                <CmsIcon name={it.icon as string} className="size-5" />
              </span>
              <div>
                <h3 className="font-semibold">{s(it.title, locale)}</h3>
                <p className="mt-1 text-sm text-muted">{s(it.text, locale)}</p>
              </div>
            </div>
          ))}
        </div>
      </SectionShell>
    );
  },

  async testimonials({ data, style }, { locale }) {
    const t = await getTranslations("reviews");
    const reviews = await approvedTestimonials(locale, Number(data.limit ?? 6), Number(data.minRating ?? 4));
    if (!reviews.length) return null;
    return (
      <SectionShell style={style}>
        <SectionHeading title={s(data.title, locale)} subtitle={s(data.subtitle, locale)} align={style.align} />
        <div className="no-scrollbar -mx-4 flex snap-x gap-4 overflow-x-auto px-4 sm:mx-0 sm:grid sm:grid-cols-2 sm:px-0 lg:grid-cols-3">
          {reviews.map((r) => (
            <figure key={r.id} className="flex w-[85%] shrink-0 snap-start flex-col rounded-card border border-border bg-bg p-6 sm:w-auto">
              <Quote className="size-6 text-accent/30" />
              <Stars value={r.rating} className="mt-3" />
              {r.title && <p className="mt-3 font-semibold">{r.title}</p>}
              <blockquote className="mt-2 line-clamp-5 flex-1 text-[15px] leading-relaxed text-fg/80">{r.body}</blockquote>
              <figcaption className="mt-5 flex items-center justify-between gap-3 border-t border-border pt-4 text-sm">
                <span className="font-medium">{r.author}</span>
                {r.verified && (
                  <span className="flex items-center gap-1 text-xs text-success">
                    <BadgeCheck className="size-3.5" /> {t("verified")}
                  </span>
                )}
              </figcaption>
              <Link href={`/product/${r.product.slug}`} className="mt-2 truncate text-xs text-muted hover:text-fg">
                {r.product.name}
              </Link>
            </figure>
          ))}
        </div>
      </SectionShell>
    );
  },

  async newsletter({ data, style }, { locale }) {
    const dark = style.background === "dark" || style.background === "accent";
    return (
      <SectionShell style={style}>
        <div className={cn("flex flex-col items-center gap-5 py-4 text-center")}>
          <h2 className="max-w-xl text-3xl font-semibold tracking-tight text-balance md:text-4xl">{s(data.title, locale)}</h2>
          {s(data.subtitle, locale) && <p className="max-w-lg text-muted">{s(data.subtitle, locale)}</p>}
          <NewsletterForm tone={dark ? "dark" : "light"} source="home" />
        </div>
      </SectionShell>
    );
  },

  async rich_text({ data, style }, { locale }) {
    const html = sanitizeRich(s(data.body, locale));
    if (!html) return null;
    return (
      <SectionShell style={style}>
        <div className="prose-store mx-auto max-w-3xl" dangerouslySetInnerHTML={{ __html: html }} />
      </SectionShell>
    );
  },

  async image_text({ data, style }, { locale }) {
    const image = await mediaFor(data.image, locale, s(data.title, locale));
    return (
      <SectionShell style={style}>
        <div className="grid items-center gap-8 md:grid-cols-2 md:gap-14">
          <div className={cn(data.imageSide === "end" && "md:order-2")}>
            <Picture image={image} sizes="(min-width:768px) 50vw, 100vw" className="aspect-[4/3] rounded-[calc(var(--nq-radius)*1.4)] bg-surface" />
          </div>
          <div>
            {s(data.eyebrow, locale) && <p className="text-xs font-semibold uppercase tracking-[0.14em] text-accent">{s(data.eyebrow, locale)}</p>}
            {s(data.title, locale) && <h2 className="mt-2 text-3xl font-semibold tracking-tight text-balance md:text-4xl">{s(data.title, locale)}</h2>}
            <div className="prose-store mt-5" dangerouslySetInnerHTML={{ __html: sanitizeRich(s(data.body, locale)) }} />
            {s(data.cta, locale) && data.href ? (
              <Link href={data.href as string} className="mt-7 inline-flex h-12 items-center gap-2 rounded-btn bg-primary px-6 font-medium text-primary-fg transition hover:bg-primary/90">
                {s(data.cta, locale)}
                <ArrowRight className="flip-rtl size-4" />
              </Link>
            ) : null}
          </div>
        </div>
      </SectionShell>
    );
  },

  async cta({ data, style }, { locale }) {
    return (
      <SectionShell style={style}>
        <div className={cn("flex flex-col gap-5 rounded-[calc(var(--nq-radius)*1.4)] py-6", style.align === "center" ? "items-center text-center" : "md:flex-row md:items-center md:justify-between")}>
          <div>
            <h2 className="text-2xl font-semibold tracking-tight md:text-3xl">{s(data.title, locale)}</h2>
            {s(data.subtitle, locale) && <p className="mt-2 text-muted">{s(data.subtitle, locale)}</p>}
          </div>
          {s(data.cta, locale) && data.href ? (
            <Link href={data.href as string} className="inline-flex h-12 shrink-0 items-center gap-2 rounded-btn bg-primary px-6 font-medium text-primary-fg transition hover:bg-primary/90">
              {s(data.cta, locale)}
              <ArrowRight className="flip-rtl size-4" />
            </Link>
          ) : null}
        </div>
      </SectionShell>
    );
  },

  async faq({ data, style }, { locale }) {
    const faqs = await getFaqs(locale, (data.category as string) || undefined);
    if (!faqs.length) return null;
    const groups = new Map<string, { name: string; items: typeof faqs }>();
    for (const f of faqs) {
      const key = f.category?.slug ?? "_";
      const g = groups.get(key) ?? { name: f.category?.name ?? "", items: [] };
      g.items.push(f);
      groups.set(key, g);
    }
    return (
      <SectionShell style={style}>
        <JsonLd data={faqJsonLd(faqs.map((f) => ({ question: f.question, answer: f.answer })))} />
        <div className="mx-auto max-w-3xl">
          <SectionHeading title={s(data.title, locale)} subtitle={s(data.subtitle, locale)} align="center" />
          <div className="space-y-10">
            {[...groups.values()].map((g) => (
              <div key={g.name}>
                {groups.size > 1 && g.name && <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted">{g.name}</h3>}
                <div className="divide-y divide-border rounded-card border border-border bg-bg">
                  {g.items.map((f) => (
                    <details key={f.id} className="group px-5 [&_summary::-webkit-details-marker]:hidden">
                      <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-4 text-start font-medium">
                        {f.question}
                        <ChevronDown className="size-5 shrink-0 text-muted transition-transform duration-300 group-open:rotate-180" />
                      </summary>
                      <p className="pb-5 text-[15px] leading-relaxed text-fg/75">{f.answer}</p>
                    </details>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </SectionShell>
    );
  },

  async video({ data, style }, { locale }) {
    const url = data.url as string;
    if (!url) return null;
    return (
      <SectionShell style={style}>
        <SectionHeading title={s(data.title, locale)} subtitle={s(data.subtitle, locale)} align={style.align} />
        <div className="mx-auto max-w-4xl">
          <LiteVideo url={url} title={s(data.title, locale) || "Video"} poster={img(data.poster)?.url} />
        </div>
      </SectionShell>
    );
  },

  async contact({ data, style }, { locale }) {
    const t = await getTranslations("contact");
    const [{ contact, chat, widgets }, social] = await Promise.all([getManySettings(["contact", "chat", "widgets"]), getSocialLinks("contact")]);
    const wa = (contact.whatsapp || widgets.whatsapp.number).replace(/[^\d]/g, "");
    const channels = [
      contact.phone && { icon: <Phone className="size-5" />, label: t("call"), value: contact.phone, href: `tel:${contact.phone.replace(/\s/g, "")}`, ltr: true },
      contact.email && { icon: <Mail className="size-5" />, label: t("emailUs"), value: contact.email, href: `mailto:${contact.email}` },
      contact.showWhatsapp && wa && { icon: <SocialIcon platform="whatsapp" className="size-5" />, label: t("whatsapp"), value: `+${wa}`, href: `https://wa.me/${wa}`, ltr: true },
      tr(contact.address, locale) && { icon: <MapPin className="size-5" />, label: t("visit"), value: tr(contact.address, locale) },
      tr(contact.hours, locale) && { icon: <Clock className="size-5" />, label: t("hours"), value: tr(contact.hours, locale) },
    ].filter(Boolean) as { icon: React.ReactNode; label: string; value: string; href?: string; ltr?: boolean }[];
    return (
      <SectionShell style={style}>
        <div className="mb-10 max-w-2xl">
          <h1 className="text-4xl font-semibold tracking-tight md:text-5xl">{s(data.title, locale) || t("title")}</h1>
          {s(data.subtitle, locale) && <p className="mt-3 text-lg text-muted">{s(data.subtitle, locale)}</p>}
        </div>
        <div className="grid gap-10 lg:grid-cols-[1.2fr_1fr]">
          {data.showForm !== false && (
            <div className="rounded-[calc(var(--nq-radius)*1.4)] border border-border bg-bg p-6 md:p-8">
              <ContactForm fields={contact.form} />
            </div>
          )}
          <div className="space-y-6">
            <div className="grid gap-3">
              {channels.map((c) => {
                const body = (
                  <>
                    <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-surface text-fg/80">{c.icon}</span>
                    <span className="min-w-0">
                      <span className="block text-xs text-muted">{c.label}</span>
                      <span className="block truncate font-medium" dir={c.ltr ? "ltr" : undefined}>
                        {c.value}
                      </span>
                    </span>
                  </>
                );
                return c.href ? (
                  <a key={c.label} href={c.href} target={c.href.startsWith("http") ? "_blank" : undefined} rel="noopener noreferrer" className="flex items-center gap-4 rounded-card border border-border p-4 transition hover:border-fg/20 hover:shadow-card">
                    {body}
                  </a>
                ) : (
                  <div key={c.label} className="flex items-center gap-4 rounded-card border border-border p-4">
                    {body}
                  </div>
                );
              })}
              {contact.showLiveChat && chat.enabled && (
                <div className="flex items-center gap-4 rounded-card bg-primary p-4 text-primary-fg">
                  <span className="grid size-11 place-items-center rounded-xl bg-white/12">
                    <MessagesSquare className="size-5" />
                  </span>
                  <span className="font-medium">{t("liveChat")}</span>
                </div>
              )}
            </div>
            {social.length > 0 && (
              <div>
                <p className="mb-3 text-sm font-semibold">{t("followUs")}</p>
                <div className="flex flex-wrap gap-2">
                  {social.map((x) => (
                    <a key={x.platform} href={x.url} target="_blank" rel="noopener noreferrer" aria-label={socialLabel(x.platform)} className="grid size-11 place-items-center rounded-full border border-border transition hover:bg-surface">
                      <SocialIcon platform={x.platform} brandColor className="size-5" />
                    </a>
                  ))}
                </div>
              </div>
            )}
            {data.showMap !== false && contact.mapEmbedUrl && /^https:\/\/(www\.openstreetmap\.org|www\.google\.com\/maps)/.test(contact.mapEmbedUrl) && (
              <iframe src={contact.mapEmbedUrl} title={t("visit")} loading="lazy" className="aspect-[4/3] w-full rounded-card border border-border" referrerPolicy="no-referrer-when-downgrade" />
            )}
          </div>
        </div>
      </SectionShell>
    );
  },

  async html({ data, style }) {
    const html = sanitizeCustom(String(data.html ?? ""));
    if (!html) return null;
    return (
      <SectionShell style={style}>
        <div dangerouslySetInnerHTML={{ __html: html }} />
      </SectionShell>
    );
  },
};

/** Render a page's visible sections in order; one failing section never breaks the page. */
export async function Sections({ sections, locale }: { sections: Section[]; locale: Locale }) {
  const out = await Promise.all(
    sections.map(async (sec, i) => {
      const r = renderers[sec.type];
      if (!r) return null;
      try {
        // data-bleed: the section paints its own background, so the page can end flush against the footer.
        return (
          <div key={sec.id} data-section={sec.type} data-bleed={sec.style.background !== "none" ? "" : undefined}>
            {await r(sec, { locale, first: i === 0 })}
          </div>
        );
      } catch (e) {
        console.error(`[sections] ${sec.type} failed`, e);
        return null;
      }
    }),
  );
  return <>{out}</>;
}

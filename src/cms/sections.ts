import { z } from "zod";
import type { LocalizedText } from "@/lib/i18n-text";
import { defaultsFor, schemaFor, type Field } from "./fields";

const L = (en: string, ar: string): LocalizedText => ({ en, ar });

export type SectionDefinition = {
  type: string;
  name: LocalizedText;
  description: LocalizedText;
  icon: string; // lucide icon name
  fields: Field[];
  /** Pre-filled content when the section is added, so it never renders empty. */
  initial?: Record<string, unknown>;
  /** Restrict to certain page templates (e.g. contact form only once). */
  singleton?: boolean;
};

const titleFields: Field[] = [
  { key: "title", type: "text", label: L("Title", "العنوان") },
  { key: "subtitle", type: "text", label: L("Subtitle", "العنوان الفرعي") },
];

const collectionSources = [
  { value: "featured", label: L("Featured products", "منتجات مميزة") },
  { value: "new", label: L("New arrivals", "وصل حديثاً") },
  { value: "best_sellers", label: L("Best sellers", "الأكثر مبيعاً") },
  { value: "on_sale", label: L("On sale", "عروض وخصومات") },
  { value: "top_rated", label: L("Top rated", "الأعلى تقييماً") },
  { value: "category", label: L("From a category", "من تصنيف") },
  { value: "brand", label: L("From a brand", "من علامة تجارية") },
  { value: "manual", label: L("Hand-picked", "اختيار يدوي") },
];

export const SECTION_DEFINITIONS: SectionDefinition[] = [
  {
    type: "hero_slider",
    name: L("Hero slider", "السلايدر الرئيسي"),
    description: L("Full-width slides with headings and buttons.", "شرائح بعرض كامل مع عناوين وأزرار."),
    icon: "GalleryHorizontal",
    fields: [
      { key: "slider", type: "slider", label: L("Slider", "السلايدر") },
      {
        key: "height",
        type: "select",
        label: L("Height", "الارتفاع"),
        options: [
          { value: "md", label: L("Medium", "متوسط") },
          { value: "lg", label: L("Large", "كبير") },
          { value: "screen", label: L("Full screen", "ملء الشاشة") },
        ],
      },
      { key: "rounded", type: "boolean", label: L("Rounded, inset card style", "نمط بطاقة بحواف دائرية") },
    ],
    initial: { slider: "home", height: "lg", rounded: true },
  },
  {
    type: "ticker",
    name: L("Announcement ticker", "شريط الإعلانات المتحرك"),
    description: L("Scrolling announcements (managed in Content → Announcements).", "إعلانات متحركة (تُدار من المحتوى ← الإعلانات)."),
    icon: "Megaphone",
    fields: [],
  },
  {
    type: "category_grid",
    name: L("Categories", "التصنيفات"),
    description: L("Showcase categories as tiles or circles.", "عرض التصنيفات كبطاقات أو دوائر."),
    icon: "LayoutGrid",
    fields: [
      ...titleFields,
      {
        key: "source",
        type: "select",
        label: L("Which categories", "أي التصنيفات"),
        options: [
          { value: "featured", label: L("Featured", "المميزة") },
          { value: "roots", label: L("Top-level", "الرئيسية") },
          { value: "manual", label: L("Hand-picked", "اختيار يدوي") },
        ],
      },
      { key: "categories", type: "category", multiple: true, label: L("Categories (hand-picked)", "التصنيفات (اختيار يدوي)") },
      {
        key: "layout",
        type: "select",
        label: L("Layout", "التخطيط"),
        options: [
          { value: "tiles", label: L("Image tiles", "بطاقات بالصور") },
          { value: "circles", label: L("Circles", "دوائر") },
          { value: "chips", label: L("Compact chips", "أزرار مدمجة") },
        ],
      },
      { key: "limit", type: "number", min: 2, max: 24, label: L("Maximum", "الحد الأقصى") },
    ],
    initial: { title: L("Shop by category", "تسوّق حسب التصنيف"), source: "featured", layout: "tiles", limit: 8 },
  },
  {
    type: "product_carousel",
    name: L("Product collection", "مجموعة منتجات"),
    description: L("Featured, new, best sellers, sale, a category, a brand or hand-picked.", "مميزة، جديدة، الأكثر مبيعاً، عروض، تصنيف، علامة، أو اختيار يدوي."),
    icon: "ShoppingBag",
    fields: [
      ...titleFields,
      { key: "source", type: "select", label: L("Source", "المصدر"), options: collectionSources },
      { key: "category", type: "category", label: L("Category", "التصنيف") },
      { key: "brand", type: "brand", label: L("Brand", "العلامة التجارية") },
      { key: "products", type: "products", label: L("Products (hand-picked)", "المنتجات (اختيار يدوي)") },
      {
        key: "layout",
        type: "select",
        label: L("Layout", "التخطيط"),
        options: [
          { value: "carousel", label: L("Carousel", "شريط متحرك") },
          { value: "grid", label: L("Grid", "شبكة") },
        ],
      },
      { key: "limit", type: "number", min: 2, max: 24, label: L("Number of products", "عدد المنتجات") },
      { key: "viewAll", type: "link", label: L("“View all” link", "رابط \"عرض الكل\"") },
      { key: "showCountdown", type: "boolean", label: L("Show sale countdown when products have an end date", "عرض العد التنازلي للعروض") },
    ],
    initial: { title: L("Featured", "منتجات مميزة"), source: "featured", layout: "carousel", limit: 10 },
  },
  {
    type: "brand_strip",
    name: L("Brands", "العلامات التجارية"),
    description: L("Logos of the brands you carry.", "شعارات العلامات التي تبيعها."),
    icon: "BadgeCheck",
    fields: [
      ...titleFields,
      {
        key: "source",
        type: "select",
        label: L("Which brands", "أي العلامات"),
        options: [
          { value: "featured", label: L("Featured", "المميزة") },
          { value: "all", label: L("All active", "جميع النشطة") },
        ],
      },
      { key: "grayscale", type: "boolean", label: L("Monochrome logos (colour on hover)", "شعارات أحادية اللون (ملونة عند التمرير)") },
    ],
    initial: { title: L("Brands we love", "علامات نحبها"), source: "featured", grayscale: true },
  },
  {
    type: "promo_banners",
    name: L("Promotional banners", "بانرات ترويجية"),
    description: L("One to three image banners with copy and a button.", "من بانر إلى ثلاثة بانرات بصور ونص وزر."),
    icon: "Image",
    fields: [
      {
        key: "items",
        type: "list",
        max: 3,
        titleKey: "title",
        label: L("Banners", "البانرات"),
        itemLabel: L("Banner", "بانر"),
        fields: [
          { key: "image", type: "image", label: L("Image", "الصورة") },
          { key: "eyebrow", type: "text", label: L("Eyebrow", "نص علوي") },
          { key: "title", type: "text", label: L("Title", "العنوان") },
          { key: "text", type: "textarea", label: L("Text", "النص") },
          { key: "cta", type: "text", label: L("Button label", "نص الزر") },
          { key: "href", type: "link", label: L("Link", "الرابط") },
          {
            key: "theme",
            type: "select",
            label: L("Text colour", "لون النص"),
            options: [
              { value: "light", label: L("Light text", "نص فاتح") },
              { value: "dark", label: L("Dark text", "نص داكن") },
            ],
          },
          { key: "background", type: "color", label: L("Background colour (if no image)", "لون الخلفية (بدون صورة)") },
        ],
      },
    ],
  },
  {
    type: "features",
    name: L("Benefits / trust", "المزايا / الثقة"),
    description: L("Icons with short benefits: delivery, warranty, payments…", "أيقونات بمزايا قصيرة: التوصيل، الضمان، الدفع…"),
    icon: "ShieldCheck",
    fields: [
      ...titleFields,
      {
        key: "items",
        type: "list",
        max: 8,
        titleKey: "title",
        label: L("Items", "العناصر"),
        itemLabel: L("Item", "عنصر"),
        fields: [
          { key: "icon", type: "icon", label: L("Icon", "الأيقونة") },
          { key: "title", type: "text", label: L("Title", "العنوان") },
          { key: "text", type: "text", label: L("Text", "النص") },
        ],
      },
    ],
  },
  {
    type: "testimonials",
    name: L("Customer reviews", "آراء العملاء"),
    description: L("Real, approved product reviews from verified customers.", "تقييمات حقيقية ومعتمدة من عملاء موثّقين."),
    icon: "MessageSquareQuote",
    fields: [...titleFields, { key: "limit", type: "number", min: 2, max: 12, label: L("Number of reviews", "عدد التقييمات") }, { key: "minRating", type: "number", min: 1, max: 5, label: L("Minimum rating", "أقل تقييم") }],
    initial: { title: L("Loved by our customers", "يحبه عملاؤنا"), limit: 6, minRating: 4 },
  },
  {
    type: "newsletter",
    name: L("Newsletter", "النشرة البريدية"),
    description: L("Email sign-up block.", "نموذج الاشتراك بالبريد."),
    icon: "Mail",
    fields: [...titleFields],
    initial: { title: L("Get early access to deals", "احصل على العروض أولاً"), subtitle: L("New arrivals and exclusive offers. No spam — unsubscribe anytime.", "وصول المنتجات الجديدة والعروض الحصرية. بدون إزعاج — يمكنك الإلغاء في أي وقت.") },
  },
  {
    type: "rich_text",
    name: L("Text", "نص"),
    description: L("Formatted text content.", "محتوى نصي منسق."),
    icon: "Type",
    fields: [{ key: "body", type: "richtext", label: L("Content", "المحتوى") }],
  },
  {
    type: "image_text",
    name: L("Image + text", "صورة ونص"),
    description: L("An image beside text and an optional button.", "صورة بجانب نص مع زر اختياري."),
    icon: "PanelLeft",
    fields: [
      { key: "image", type: "image", label: L("Image", "الصورة") },
      { key: "eyebrow", type: "text", label: L("Eyebrow", "نص علوي") },
      { key: "title", type: "text", label: L("Title", "العنوان") },
      { key: "body", type: "richtext", label: L("Text", "النص") },
      { key: "cta", type: "text", label: L("Button label", "نص الزر") },
      { key: "href", type: "link", label: L("Button link", "رابط الزر") },
      {
        key: "imageSide",
        type: "select",
        label: L("Image side", "جهة الصورة"),
        options: [
          { value: "start", label: L("Start", "البداية") },
          { value: "end", label: L("End", "النهاية") },
        ],
      },
    ],
  },
  {
    type: "cta",
    name: L("Call to action", "دعوة لاتخاذ إجراء"),
    description: L("Bold statement with a button.", "عبارة بارزة مع زر."),
    icon: "MousePointerClick",
    fields: [...titleFields, { key: "cta", type: "text", label: L("Button label", "نص الزر") }, { key: "href", type: "link", label: L("Button link", "رابط الزر") }],
  },
  {
    type: "faq",
    name: L("FAQ", "الأسئلة الشائعة"),
    description: L("Questions from the FAQ manager, with FAQ rich results markup.", "أسئلة من مدير الأسئلة الشائعة مع ترميز النتائج المنسقة."),
    icon: "CircleHelp",
    fields: [...titleFields, { key: "category", type: "text", localized: false, label: L("FAQ category slug (blank = all)", "معرّف تصنيف الأسئلة (فارغ = الكل)") }],
    initial: { title: L("Frequently asked questions", "الأسئلة الشائعة") },
  },
  {
    type: "video",
    name: L("Video", "فيديو"),
    description: L("YouTube or Vimeo, loaded only when played.", "يوتيوب أو فيميو، يُحمّل فقط عند التشغيل."),
    icon: "PlaySquare",
    fields: [...titleFields, { key: "url", type: "link", label: L("Video URL", "رابط الفيديو") }, { key: "poster", type: "image", label: L("Poster image", "صورة الغلاف") }],
  },
  {
    type: "contact",
    name: L("Contact", "التواصل"),
    description: L("Contact details, channels, map and form.", "بيانات التواصل والقنوات والخريطة والنموذج."),
    icon: "Contact",
    singleton: true,
    fields: [
      ...titleFields,
      { key: "showForm", type: "boolean", label: L("Show contact form", "عرض نموذج التواصل") },
      { key: "showMap", type: "boolean", label: L("Show map", "عرض الخريطة") },
    ],
    initial: { title: L("We're here to help", "نحن هنا لمساعدتك"), showForm: true, showMap: true },
  },
  {
    type: "html",
    name: L("Custom HTML", "HTML مخصص"),
    description: L("Sanitised HTML (scripts are removed).", "HTML منقّى (تُحذف السكربتات)."),
    icon: "Code",
    fields: [{ key: "html", type: "textarea", label: L("HTML", "HTML") }],
  },
];

export const sectionDef = (type: string) => SECTION_DEFINITIONS.find((d) => d.type === type);

/** Appearance options shared by every section (edited in the same panel). */
export const sectionStyleSchema = z
  .object({
    background: z.enum(["none", "surface", "dark", "accent", "custom"]).default("none"),
    customBackground: z.string().regex(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i).or(z.literal("")).default(""),
    paddingY: z.enum(["none", "sm", "md", "lg"]).default("md"),
    width: z.enum(["contained", "full"]).default("contained"),
    align: z.enum(["start", "center"]).default("start"),
    hideOnMobile: z.boolean().default(false),
    hideOnDesktop: z.boolean().default(false),
    anchor: z.string().regex(/^[a-z0-9-]*$/).max(40).default(""),
    animate: z.boolean().default(true),
  })
  .prefault({});

export type SectionStyle = z.infer<typeof sectionStyleSchema>;

export function parseSectionData(type: string, data: unknown) {
  const def = sectionDef(type);
  if (!def) throw new Error(`Unknown section type ${type}`);
  return schemaFor(def.fields).parse(data ?? {});
}

export function initialSectionData(type: string) {
  const def = sectionDef(type);
  if (!def) return {};
  return { ...defaultsFor(def.fields), ...(def.initial ?? {}) };
}

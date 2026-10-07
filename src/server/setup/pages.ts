import { initialSectionData } from "@/cms/sections";

/**
 * Default layouts for the About and Contact pages, built from regular page
 * builder sections (so everything is editable, reorderable and hideable in
 * Admin → Pages). Shared by the seed and the content upgrade.
 */
const L = (en: string, ar: string) => ({ en, ar });
type Media = { id: string; url: string } | null;
export type SectionSeed = { type: string; data: Record<string, unknown>; style: Record<string, unknown> };

const section = (type: string, data: Record<string, unknown> = {}, style: Record<string, unknown> = {}): SectionSeed => ({ type, data: { ...initialSectionData(type), ...data }, style });

/** Riyadh showroom location used by the demo store (replace in the Map section). */
const STORE_LOCATION = { lat: 24.7106, lng: 46.6799 };

export function aboutSections(image: Media, story: { eyebrow: object; heading: object; body: object }): SectionSeed[] {
  return [
    section("page_hero", {
      eyebrow: L("About us", "من نحن"),
      title: L("Technology, thoughtfully chosen.", "تقنية مختارة بعناية."),
      subtitle: L("A Saudi electronics store built on genuine products, honest prices and people who actually know tech.", "متجر إلكترونيات سعودي قائم على المنتجات الأصلية والأسعار العادلة وفريق يفهم التقنية فعلاً."),
      image,
      layout: image ? "split" : "plain",
    }),
    section(
      "stats",
      {
        items: [
          { value: "50K+", label: L("Happy customers", "عميل سعيد"), icon: "Users" },
          { value: "120K+", label: L("Orders delivered", "طلب تم توصيله"), icon: "PackageCheck" },
          { value: "13", label: L("Regions served", "منطقة نخدمها"), icon: "MapPinned" },
          { value: "4.8★", label: L("Average rating", "متوسط التقييم"), icon: "Star" },
        ],
      },
      { background: "surface" },
    ),
    section("image_text", { image, eyebrow: story.eyebrow, title: story.heading, body: story.body, imageSide: "end" }),
    section("features", {
      title: L("What we stand for", "ما نؤمن به"),
      items: [
        { icon: "BadgeCheck", title: L("Only genuine", "الأصلي فقط"), text: L("Every product from official channels, with local warranty.", "كل منتج من القنوات الرسمية مع كفالة محلية.") },
        { icon: "Scale", title: L("Honest prices", "أسعار عادلة"), text: L("No inflated 'was' prices — real discounts only.", "لا أسعار مضخمة — خصومات حقيقية فقط.") },
        { icon: "Truck", title: L("Fast delivery", "توصيل سريع"), text: L("Next day in Riyadh, Jeddah and Dammam.", "في اليوم التالي في الرياض وجدة والدمام.") },
        { icon: "HeartHandshake", title: L("Support that cares", "دعم يهتم"), text: L("Before and long after you buy.", "قبل الشراء وبعده بفترة طويلة.") },
      ],
    }),
    section("timeline", {
      title: L("Our story so far", "مسيرتنا حتى الآن"),
      items: [
        { year: "2019", title: L("A small shop in Riyadh", "متجر صغير في الرياض"), text: L("We started with one idea: buying a phone should feel as good as using one.", "بدأنا بفكرة واحدة: يجب أن يكون شراء الهاتف ممتعاً كاستخدامه.") },
        { year: "2021", title: L("Online across the Kingdom", "متجر إلكتروني لكل المملكة"), text: L("Our online store launched with delivery to every region.", "أطلقنا متجرنا الإلكتروني مع التوصيل لجميع المناطق.") },
        { year: "2023", title: L("Official partnerships", "شراكات رسمية"), text: L("Authorised reseller agreements with the brands you trust.", "اتفاقيات موزّع معتمد مع العلامات التي تثق بها.") },
        { year: "2026", title: L("Serving the GCC", "نخدم الخليج"), text: L("Fast shipping to all GCC countries.", "شحن سريع إلى جميع دول الخليج.") },
      ],
    }),
    section("cta", { title: L("Questions about a device?", "لديك سؤال عن جهاز؟"), subtitle: L("Our team is a message away.", "فريقنا على بُعد رسالة."), cta: L("Contact us", "تواصل معنا"), href: "/contact" }, { background: "surface", align: "center" }),
  ];
}

export function contactSections(): SectionSeed[] {
  return [
    section("contact", { title: L("How can we help?", "كيف يمكننا مساعدتك؟"), subtitle: L("Send us a message or reach us directly — we usually reply within a few hours.", "أرسل لنا رسالة أو تواصل معنا مباشرة — نرد عادةً خلال ساعات قليلة."), showMap: false }),
    section("map", {
      title: L("Visit our showroom", "زر معرضنا"),
      address: L("King Fahd Road, Al Olaya\nRiyadh 12214, Saudi Arabia", "طريق الملك فهد، العليا\nالرياض 12214، المملكة العربية السعودية"),
      lat: STORE_LOCATION.lat,
      lng: STORE_LOCATION.lng,
      zoom: 15,
      // Phone and hours are already shown by the contact cards and the hours section.
      showContact: false,
    }),
    section(
      "business_hours",
      {
        title: L("Opening hours", "ساعات العمل"),
        items: [
          { day: L("Saturday – Thursday", "السبت – الخميس"), hours: L("10:00 – 23:00", "10:00 – 23:00"), closed: false },
          { day: L("Friday", "الجمعة"), hours: L("16:00 – 23:00", "16:00 – 23:00"), closed: false },
        ],
        note: L("Online orders are accepted 24/7.", "نستقبل الطلبات الإلكترونية على مدار الساعة."),
      },
      { background: "surface" },
    ),
    section("cta", { title: L("Looking for a quick answer?", "تبحث عن إجابة سريعة؟"), subtitle: L("Most questions are answered in our help centre.", "معظم الأسئلة مجاب عنها في مركز المساعدة."), cta: L("Help & FAQ", "المساعدة والأسئلة الشائعة"), href: "/faq" }, { align: "center" }),
  ];
}

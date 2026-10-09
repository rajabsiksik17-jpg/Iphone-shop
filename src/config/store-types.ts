/**
 * Store types. A preset describes what a kind of store usually needs —
 * product attributes (with values), starter categories, which specs appear on
 * product cards, trust-badge icons and recommended homepage sections.
 * Applying a preset only ADDS what's missing (see server/admin/store-type);
 * nothing an admin created is changed or removed.
 *
 * Attribute keys are shared across presets (e.g. "color", "size", "material")
 * so switching or combining types never duplicates them.
 */
const L = (en: string, ar: string) => ({ en, ar });
type T = { en: string; ar: string };

export type PresetAttribute = {
  key: string;
  name: T;
  type: "SELECT" | "MULTISELECT" | "COLOR" | "TEXT" | "NUMBER" | "BOOLEAN";
  unit?: string;
  icon?: string;
  values?: (T & { hex?: string })[];
  filterable?: boolean;
  variant?: boolean;
  highlighted?: boolean;
};
export type PresetCategory = { name: T; icon?: string; children?: PresetCategory[] };
export type TrustConcept = "delivery" | "warranty" | "returns" | "payment";
/** Product card defaults for a type (applied to the type's profile; editable afterwards). */
export type CardPreset = { imageRatio?: "1/1" | "4/5" | "3/4"; showBrand?: boolean; showRating?: boolean; style?: "minimal" | "bordered" | "elevated" };
export type StoreTypePreset = {
  key: string;
  name: T;
  description: T;
  icon: string;
  /** Visual identity used by the template's banners and demo art. */
  theme?: { from: string; to: string; accent: string };
  /** Shopper-facing words for "product(s)" in this kind of store. */
  terms?: { product: T; products: T };
  card?: CardPreset;
  /** Icon for empty states (no results, empty category). */
  emptyIcon?: string;
  attributes: PresetAttribute[];
  categories: PresetCategory[];
  /** Attribute keys shown as compact specs on product cards (max 3 used). */
  cardAttributes: string[];
  icons: Record<TrustConcept, string>;
  /** Recommended homepage section types, in order. */
  homeSections: string[];
};

// ── Shared attributes ──
const color: PresetAttribute = {
  key: "color",
  name: L("Color", "اللون"),
  type: "COLOR",
  variant: true,
  values: [
    { ...L("Black", "أسود"), hex: "#111111" },
    { ...L("White", "أبيض"), hex: "#f5f5f5" },
    { ...L("Gray", "رمادي"), hex: "#8e8e93" },
    { ...L("Blue", "أزرق"), hex: "#2563eb" },
    { ...L("Red", "أحمر"), hex: "#dc2626" },
    { ...L("Green", "أخضر"), hex: "#16a34a" },
    { ...L("Beige", "بيج"), hex: "#e7d8c3" },
    { ...L("Pink", "وردي"), hex: "#ec4899" },
  ],
};
const sizeApparel: PresetAttribute = { key: "size", name: L("Size", "المقاس"), type: "SELECT", variant: true, values: ["XS", "S", "M", "L", "XL", "XXL"].map((v) => L(v, v)) };
const material = (values: [string, string][]): PresetAttribute => ({ key: "material", name: L("Material", "الخامة"), type: "SELECT", values: values.map(([e, a]) => L(e, a)) });
const gender: PresetAttribute = { key: "gender", name: L("Gender", "الفئة"), type: "SELECT", values: [L("Men", "رجالي"), L("Women", "نسائي"), L("Unisex", "للجنسين"), L("Kids", "أطفال")] };
const brandOrigin: PresetAttribute = { key: "origin", name: L("Country of origin", "بلد المنشأ"), type: "TEXT", filterable: false };
const weight: PresetAttribute = { key: "weight", name: L("Weight", "الوزن"), type: "TEXT", filterable: false, icon: "lucide:Weight" };
const dimensions: PresetAttribute = { key: "dimensions", name: L("Dimensions", "الأبعاد"), type: "TEXT", filterable: false, icon: "lucide:Ruler" };
const volume: PresetAttribute = { key: "volume", name: L("Volume", "الحجم"), type: "SELECT", unit: "ml", variant: true, values: ["30 ml", "50 ml", "100 ml", "150 ml", "200 ml"].map((v) => L(v, v.replace("ml", "مل"))) };
const ageRange: PresetAttribute = { key: "age-range", name: L("Age", "العمر"), type: "SELECT", values: [L("0–12 months", "0–12 شهراً"), L("1–3 years", "1–3 سنوات"), L("3–6 years", "3–6 سنوات"), L("6–12 years", "6–12 سنة"), L("12+ years", "12+ سنة")] };

const STANDARD_ICONS: Record<TrustConcept, string> = { delivery: "lucide:Truck", warranty: "lucide:ShieldCheck", returns: "lucide:RotateCcw", payment: "lucide:CreditCard" };
const RETAIL_HOME = ["hero_slider", "category_grid", "product_carousel", "promo_banners", "product_carousel", "features", "testimonials", "newsletter"];

export const STORE_TYPES: StoreTypePreset[] = [
  {
    key: "electronics",
    name: L("General electronics", "إلكترونيات عامة"),
    description: L("Phones, tablets, laptops, audio, wearables and accessories.", "جوالات وأجهزة لوحية ولابتوبات وصوتيات وأجهزة قابلة للارتداء وإكسسوارات."),
    theme: { from: "#05070d", to: "#1b2338", accent: "#6d8bd6" },
    icon: "Smartphone",
    attributes: [
      color,
      { key: "storage", name: L("Storage", "السعة"), type: "SELECT", variant: true, highlighted: true, icon: "lucide:HardDrive", values: ["64GB", "128GB", "256GB", "512GB", "1TB"].map((v) => L(v, v)) },
      { key: "ram", name: L("RAM", "الذاكرة"), type: "SELECT", variant: true, highlighted: true, icon: "lucide:MemoryStick", values: ["4GB", "6GB", "8GB", "12GB", "16GB"].map((v) => L(v, v)) },
      { key: "screen-size", name: L("Screen size", "حجم الشاشة"), type: "SELECT", highlighted: true, icon: "lucide:MonitorSmartphone", values: ['6.1"', '6.3"', '6.7"', '6.9"'].map((v) => L(v, v)) },
      { key: "battery", name: L("Battery", "البطارية"), type: "TEXT", filterable: false, highlighted: true, icon: "lucide:BatteryFull" },
      { key: "network", name: L("Network", "الشبكة"), type: "SELECT", values: [L("4G", "4G"), L("5G", "5G")] },
    ],
    categories: [
      { name: L("Smartphones", "الهواتف الذكية"), icon: "lucide:Smartphone" },
      { name: L("Tablets", "الأجهزة اللوحية"), icon: "lucide:Tablet" },
      { name: L("Laptops", "اللابتوبات"), icon: "lucide:Laptop" },
      { name: L("Accessories", "الإكسسوارات"), icon: "lucide:Cable" },
    ],
    cardAttributes: ["storage", "ram"],
    icons: STANDARD_ICONS,
    homeSections: ["hero_slider", "category_grid", "product_carousel", "brand_strip", "promo_banners", "product_carousel", "features", "testimonials", "newsletter"],
  },
  {
    key: "smartphones",
    name: L("Smartphones", "الهواتف الذكية"),
    description: L("Phones by brand, storage and network, plus cases and chargers.", "هواتف حسب الشركة والسعة والشبكة، مع الأغطية والشواحن."),
    icon: "Smartphone",
    theme: { from: "#0b0f19", to: "#1e1b4b", accent: "#8b5cf6" },
    attributes: [
      color,
      { key: "storage", name: L("Storage", "السعة"), type: "SELECT", variant: true, highlighted: true, icon: "lucide:HardDrive", values: ["64GB", "128GB", "256GB", "512GB", "1TB"].map((v) => L(v, v)) },
      { key: "ram", name: L("RAM", "الذاكرة"), type: "SELECT", highlighted: true, icon: "lucide:MemoryStick", values: ["4GB", "6GB", "8GB", "12GB", "16GB"].map((v) => L(v, v)) },
      { key: "screen-size", name: L("Screen size", "حجم الشاشة"), type: "SELECT", highlighted: true, icon: "lucide:MonitorSmartphone", values: ['6.1"', '6.3"', '6.7"', '6.9"'].map((v) => L(v, v)) },
      { key: "processor", name: L("Processor", "المعالج"), type: "TEXT", filterable: false, highlighted: true, icon: "lucide:Cpu" },
      { key: "camera", name: L("Main camera", "الكاميرا الرئيسية"), type: "TEXT", filterable: false, highlighted: true, icon: "lucide:Camera" },
      { key: "battery", name: L("Battery", "البطارية"), type: "TEXT", filterable: false, highlighted: true, icon: "lucide:BatteryFull" },
      { key: "network", name: L("Network", "الشبكة"), type: "SELECT", icon: "lucide:Signal", values: [L("4G", "4G"), L("5G", "5G")] },
      { key: "warranty-period", name: L("Warranty", "الضمان"), type: "SELECT", icon: "lucide:ShieldCheck", values: [L("1 year", "سنة"), L("2 years", "سنتان")] },
    ],
    categories: [
      { name: L("iPhone", "آيفون"), icon: "lucide:Smartphone" },
      { name: L("Android phones", "هواتف أندرويد"), icon: "lucide:Smartphone" },
      { name: L("Foldables", "الهواتف القابلة للطي"), icon: "lucide:SquareStack" },
      { name: L("Phone accessories", "إكسسوارات الجوال"), icon: "lucide:Cable", children: [{ name: L("Cases", "الأغطية") }, { name: L("Chargers", "الشواحن"), icon: "lucide:PlugZap" }] },
    ],
    cardAttributes: ["storage", "ram"],
    icons: STANDARD_ICONS,
    homeSections: ["hero_slider", "category_grid", "product_carousel", "brand_strip", "promo_banners", "product_carousel", "features", "newsletter"],
  },
  {
    key: "tablets",
    name: L("Tablets", "الأجهزة اللوحية"),
    description: L("Tablets for work, study and kids, with styluses and keyboards.", "أجهزة لوحية للعمل والدراسة والأطفال، مع الأقلام ولوحات المفاتيح."),
    icon: "Tablet",
    theme: { from: "#0f172a", to: "#164e63", accent: "#22d3ee" },
    attributes: [
      color,
      { key: "storage", name: L("Storage", "السعة"), type: "SELECT", variant: true, highlighted: true, icon: "lucide:HardDrive", values: ["64GB", "128GB", "256GB", "512GB", "1TB"].map((v) => L(v, v)) },
      { key: "screen-size", name: L("Screen size", "حجم الشاشة"), type: "SELECT", highlighted: true, icon: "lucide:Tablet", values: ['8.3"', '10.9"', '11"', '12.4"', '13"'].map((v) => L(v, v)) },
      { key: "connectivity", name: L("Connectivity", "الاتصال"), type: "SELECT", variant: true, icon: "lucide:Wifi", values: [L("Wi-Fi", "واي فاي"), L("Wi-Fi + Cellular", "واي فاي + خلوي")] },
      { key: "stylus", name: L("Stylus support", "يدعم القلم"), type: "BOOLEAN", icon: "lucide:PenLine" },
      { key: "processor", name: L("Processor", "المعالج"), type: "TEXT", filterable: false, highlighted: true, icon: "lucide:Cpu" },
    ],
    categories: [
      { name: L("iPad", "آيباد"), icon: "lucide:Tablet" },
      { name: L("Android tablets", "أجهزة أندرويد اللوحية"), icon: "lucide:Tablet" },
      { name: L("Kids tablets", "أجهزة لوحية للأطفال"), icon: "lucide:Baby" },
      { name: L("Tablet accessories", "إكسسوارات الأجهزة اللوحية"), icon: "lucide:Keyboard" },
    ],
    cardAttributes: ["storage", "screen-size", "connectivity"],
    icons: STANDARD_ICONS,
    homeSections: RETAIL_HOME,
  },
  {
    key: "tools",
    name: L("Tools & hardware", "العدد والأدوات"),
    description: L("Power tools, hand tools, garden and safety gear.", "عدد كهربائية ويدوية وأدوات الحديقة ومعدات السلامة."),
    icon: "Wrench",
    theme: { from: "#1c1917", to: "#713f12", accent: "#facc15" },
    attributes: [
      { key: "power-source", name: L("Power source", "مصدر الطاقة"), type: "SELECT", highlighted: true, icon: "lucide:BatteryCharging", values: [L("Cordless", "لاسلكي"), L("Corded", "سلكي"), L("Manual", "يدوي")] },
      { key: "voltage", name: L("Voltage", "الجهد"), type: "SELECT", highlighted: true, icon: "lucide:Zap", values: ["12V", "18V", "20V", "220V"].map((v) => L(v, v)) },
      { key: "tool-type", name: L("Tool type", "نوع الأداة"), type: "SELECT", values: [L("Drill", "دريل"), L("Saw", "منشار"), L("Grinder", "صاروخ"), L("Wrench set", "طقم مفاتيح"), L("Measuring", "قياس")] },
      material([["Steel", "فولاذ"], ["Aluminium", "ألمنيوم"], ["Plastic", "بلاستيك"]]),
      weight,
    ],
    categories: [{ name: L("Power tools", "العدد الكهربائية"), icon: "lucide:Drill" }, { name: L("Hand tools", "العدد اليدوية"), icon: "lucide:Wrench" }, { name: L("Garden", "الحديقة"), icon: "lucide:Shovel" }, { name: L("Safety", "السلامة"), icon: "lucide:HardHat" }],
    cardAttributes: ["power-source", "voltage"],
    icons: { ...STANDARD_ICONS, warranty: "lucide:ShieldCheck" },
    homeSections: ["hero_slider", "category_grid", "product_carousel", "brand_strip", "features", "newsletter"],
  },
  {
    key: "marketplace",
    name: L("General marketplace", "متجر عام متعدد الأقسام"),
    description: L("A bit of everything: electronics, fashion, home, beauty and more.", "كل شيء في مكان واحد: إلكترونيات وأزياء ومنزل وتجميل وأكثر."),
    icon: "Store",
    theme: { from: "#111827", to: "#1f2937", accent: "#f59e0b" },
    attributes: [color, { key: "condition", name: L("Condition", "الحالة"), type: "SELECT", values: [L("New", "جديد"), L("Used", "مستعمل"), L("Refurbished", "مجدد")] }, weight],
    categories: [
      { name: L("Electronics", "الإلكترونيات"), icon: "lucide:Smartphone" },
      { name: L("Fashion", "الأزياء"), icon: "lucide:Shirt" },
      { name: L("Home", "المنزل"), icon: "lucide:Sofa" },
      { name: L("Beauty", "التجميل"), icon: "lucide:Sparkles" },
      { name: L("Sports", "الرياضة"), icon: "lucide:Dumbbell" },
      { name: L("Kids", "الأطفال"), icon: "lucide:Baby" },
    ],
    cardAttributes: ["condition"],
    icons: STANDARD_ICONS,
    homeSections: ["hero_slider", "category_grid", "product_carousel", "promo_banners", "product_carousel", "brand_strip", "features", "newsletter"],
  },
  {
    key: "computers",
    name: L("Computers & laptops", "كمبيوتر ولابتوبات"),
    theme: { from: "#020617", to: "#1e293b", accent: "#38bdf8" },
    description: L("PCs, components, monitors, consoles and peripherals.", "حواسيب وقطع ومعالجات وشاشات وأجهزة ألعاب وملحقات."),
    icon: "Monitor",
    attributes: [
      { key: "processor", name: L("Processor", "المعالج"), type: "TEXT", filterable: false, highlighted: true, icon: "lucide:Cpu" },
      { key: "ram", name: L("RAM", "الذاكرة"), type: "SELECT", variant: true, highlighted: true, icon: "lucide:MemoryStick", values: ["8GB", "16GB", "32GB", "64GB"].map((v) => L(v, v)) },
      { key: "storage", name: L("Storage", "السعة"), type: "SELECT", variant: true, highlighted: true, icon: "lucide:HardDrive", values: ["256GB", "512GB", "1TB", "2TB"].map((v) => L(v, v)) },
      { key: "gpu", name: L("Graphics", "كرت الشاشة"), type: "TEXT", filterable: false, highlighted: true, icon: "lucide:Gpu" },
      { key: "platform", name: L("Platform", "المنصة"), type: "SELECT", values: [L("PC", "كمبيوتر"), L("PlayStation", "بلايستيشن"), L("Xbox", "إكس بوكس"), L("Nintendo", "نينتندو")] },
    ],
    categories: [
      { name: L("Laptops", "اللابتوبات"), icon: "lucide:Laptop" },
      { name: L("Desktops", "أجهزة مكتبية"), icon: "lucide:Monitor" },
      { name: L("Gaming", "الألعاب"), icon: "lucide:Gamepad2" },
      { name: L("Components", "القطع"), icon: "lucide:Cpu" },
    ],
    cardAttributes: ["processor", "ram", "storage"],
    icons: STANDARD_ICONS,
    homeSections: RETAIL_HOME,
  },
  {
    key: "fashion",
    name: L("Fashion & clothing", "أزياء وملابس"),
    theme: { from: "#1c1917", to: "#44403c", accent: "#f5d0a9" },
    card: { imageRatio: "3/4", showRating: false },
    terms: { product: L("Item", "قطعة"), products: L("Collection", "التشكيلة") },
    description: L("Clothing for men, women and kids, with sizes and colours.", "ملابس رجالية ونسائية وللأطفال بالمقاسات والألوان."),
    icon: "Shirt",
    attributes: [color, sizeApparel, gender, material([["Cotton", "قطن"], ["Linen", "كتان"], ["Polyester", "بوليستر"], ["Wool", "صوف"], ["Silk", "حرير"]]), { key: "fit", name: L("Fit", "القصة"), type: "SELECT", values: [L("Regular", "عادية"), L("Slim", "ضيقة"), L("Oversized", "واسعة")] }],
    categories: [
      { name: L("Women", "نساء"), icon: "lucide:Shirt", children: [{ name: L("Abayas", "عبايات") }, { name: L("Dresses", "فساتين") }, { name: L("Tops", "بلوزات") }] },
      { name: L("Men", "رجال"), icon: "lucide:Shirt", children: [{ name: L("Thobes", "ثياب") }, { name: L("Shirts", "قمصان") }, { name: L("Trousers", "بناطيل") }] },
      { name: L("Kids", "أطفال"), icon: "lucide:Baby" },
    ],
    cardAttributes: ["size", "material"],
    icons: { ...STANDARD_ICONS, warranty: "lucide:BadgeCheck" },
    homeSections: ["hero_slider", "category_grid", "product_carousel", "promo_banners", "product_carousel", "testimonials", "newsletter"],
  },
  {
    key: "shoes",
    name: L("Shoes & bags", "أحذية وحقائب"),
    theme: { from: "#0c0a09", to: "#292524", accent: "#fb923c" },
    card: { imageRatio: "4/5" },
    description: L("Footwear and bags with sizes, colours and materials.", "أحذية وحقائب بالمقاسات والألوان والخامات."),
    icon: "Footprints",
    attributes: [color, { key: "shoe-size", name: L("Shoe size", "مقاس الحذاء"), type: "SELECT", variant: true, values: ["36", "37", "38", "39", "40", "41", "42", "43", "44", "45"].map((v) => L(v, v)) }, gender, material([["Leather", "جلد"], ["Suede", "شامواه"], ["Canvas", "قماش"], ["Synthetic", "صناعي"]])],
    categories: [{ name: L("Sneakers", "أحذية رياضية"), icon: "lucide:Footprints" }, { name: L("Formal shoes", "أحذية رسمية") }, { name: L("Sandals", "صنادل") }, { name: L("Bags", "حقائب"), icon: "lucide:ShoppingBag" }],
    cardAttributes: ["shoe-size", "material"],
    icons: STANDARD_ICONS,
    homeSections: RETAIL_HOME,
  },
  {
    key: "beauty",
    name: L("Beauty & cosmetics", "تجميل ومستحضرات"),
    theme: { from: "#4a044e", to: "#831843", accent: "#f9a8d4" },
    card: { imageRatio: "4/5" },
    description: L("Make-up, skincare and haircare with skin types and shades.", "مكياج وعناية بالبشرة والشعر حسب نوع البشرة والدرجات."),
    icon: "Sparkles",
    attributes: [
      { key: "skin-type", name: L("Skin type", "نوع البشرة"), type: "MULTISELECT", values: [L("Normal", "عادية"), L("Dry", "جافة"), L("Oily", "دهنية"), L("Combination", "مختلطة"), L("Sensitive", "حساسة")] },
      { key: "shade", name: L("Shade", "الدرجة"), type: "COLOR", variant: true, values: [{ ...L("Fair", "فاتح"), hex: "#f3d5c0" }, { ...L("Medium", "متوسط"), hex: "#d6a77a" }, { ...L("Tan", "قمحي"), hex: "#b07b4f" }, { ...L("Deep", "داكن"), hex: "#7a4a2b" }] },
      volume,
      { key: "concern", name: L("Concern", "الاهتمام"), type: "MULTISELECT", values: [L("Hydration", "ترطيب"), L("Anti-aging", "مكافحة الشيخوخة"), L("Acne", "حب الشباب"), L("Brightening", "تفتيح")] },
      { key: "cruelty-free", name: L("Cruelty-free", "غير مختبر على الحيوانات"), type: "BOOLEAN" },
    ],
    categories: [{ name: L("Makeup", "المكياج"), icon: "lucide:Palette" }, { name: L("Skincare", "العناية بالبشرة"), icon: "lucide:Droplets" }, { name: L("Haircare", "العناية بالشعر") }, { name: L("Tools", "الأدوات") }],
    cardAttributes: ["volume", "skin-type"],
    icons: { ...STANDARD_ICONS, warranty: "lucide:BadgeCheck" },
    homeSections: ["hero_slider", "category_grid", "product_carousel", "brand_strip", "promo_banners", "testimonials", "newsletter"],
  },
  {
    key: "perfumes",
    name: L("Perfumes & oud", "عطور وعود"),
    theme: { from: "#1c1206", to: "#422006", accent: "#fbbf24" },
    card: { imageRatio: "4/5", showRating: true },
    terms: { product: L("Fragrance", "عطر"), products: L("Fragrances", "العطور") },
    description: L("Perfumes, oud, bakhoor and gift sets by scent family.", "عطور وعود وبخور وأطقم هدايا حسب العائلة العطرية."),
    icon: "SprayCan",
    attributes: [
      volume,
      { key: "scent-family", name: L("Scent family", "العائلة العطرية"), type: "MULTISELECT", values: [L("Oud", "عود"), L("Floral", "زهري"), L("Woody", "خشبي"), L("Musk", "مسك"), L("Citrus", "حمضي"), L("Oriental", "شرقي")] },
      { key: "concentration", name: L("Concentration", "التركيز"), type: "SELECT", highlighted: true, icon: "lucide:Droplet", values: [L("Eau de Parfum", "أو دو بارفان"), L("Eau de Toilette", "أو دو تواليت"), L("Parfum", "بارفان"), L("Perfume oil", "دهن عطر")] },
      gender,
      { key: "top-notes", name: L("Top notes", "النفحات العليا"), type: "TEXT", filterable: false, icon: "lucide:Wind" },
      { key: "heart-notes", name: L("Heart notes", "نفحات القلب"), type: "TEXT", filterable: false, icon: "lucide:Flower2" },
      { key: "base-notes", name: L("Base notes", "النفحات الأساسية"), type: "TEXT", filterable: false, icon: "lucide:TreePine" },
      { key: "longevity", name: L("Longevity", "الثبات"), type: "SELECT", highlighted: true, icon: "lucide:Timer", values: [L("Moderate (4–6 h)", "متوسط (4–6 ساعات)"), L("Long (6–8 h)", "طويل (6–8 ساعات)"), L("Very long (8 h+)", "طويل جداً (+8 ساعات)")] },
    ],
    categories: [{ name: L("Perfumes", "العطور"), icon: "lucide:SprayCan" }, { name: L("Oud & oils", "العود والدهن") }, { name: L("Bakhoor", "البخور"), icon: "lucide:Flame" }, { name: L("Gift sets", "أطقم الهدايا"), icon: "lucide:Gift" }],
    cardAttributes: ["volume", "concentration"],
    icons: { ...STANDARD_ICONS, warranty: "lucide:BadgeCheck" },
    homeSections: ["hero_slider", "category_grid", "product_carousel", "promo_banners", "brand_strip", "testimonials", "newsletter"],
  },
  {
    key: "jewelry",
    name: L("Jewellery", "مجوهرات"),
    theme: { from: "#0f0a00", to: "#3b2a05", accent: "#facc15" },
    card: { imageRatio: "1/1", showRating: false },
    description: L("Gold, silver and diamond jewellery with karat and metal.", "مجوهرات ذهب وفضة وألماس بالعيار ونوع المعدن."),
    icon: "Gem",
    attributes: [
      { key: "metal", name: L("Metal", "المعدن"), type: "SELECT", values: [L("Yellow gold", "ذهب أصفر"), L("White gold", "ذهب أبيض"), L("Rose gold", "ذهب وردي"), L("Silver", "فضة"), L("Platinum", "بلاتين")] },
      { key: "karat", name: L("Karat", "العيار"), type: "SELECT", highlighted: true, values: ["18K", "21K", "22K", "24K"].map((v) => L(v, v)) },
      { key: "stone", name: L("Stone", "الحجر"), type: "SELECT", values: [L("Diamond", "ألماس"), L("Pearl", "لؤلؤ"), L("Emerald", "زمرد"), L("Ruby", "ياقوت"), L("None", "بدون")] },
      { key: "ring-size", name: L("Ring size", "مقاس الخاتم"), type: "SELECT", variant: true, values: ["5", "6", "7", "8", "9", "10"].map((v) => L(v, v)) },
      weight,
    ],
    categories: [{ name: L("Rings", "خواتم"), icon: "lucide:Gem" }, { name: L("Necklaces", "قلائد") }, { name: L("Bracelets", "أساور") }, { name: L("Earrings", "أقراط") }],
    cardAttributes: ["metal", "karat"],
    icons: { ...STANDARD_ICONS, warranty: "lucide:BadgeCheck" },
    homeSections: ["hero_slider", "category_grid", "product_carousel", "promo_banners", "testimonials", "newsletter"],
  },
  {
    key: "watches",
    name: L("Watches", "ساعات"),
    theme: { from: "#0a0a0a", to: "#262626", accent: "#d4d4d8" },
    description: L("Wrist watches and smart watches by movement and strap.", "ساعات يد وساعات ذكية حسب الحركة والسوار."),
    icon: "Watch",
    attributes: [
      { key: "movement", name: L("Movement", "الحركة"), type: "SELECT", values: [L("Automatic", "أوتوماتيك"), L("Quartz", "كوارتز"), L("Smart", "ذكية")] },
      { key: "case-size", name: L("Case size", "حجم الإطار"), type: "SELECT", values: ["36mm", "40mm", "42mm", "44mm", "46mm"].map((v) => L(v, v)) },
      { key: "strap", name: L("Strap", "السوار"), type: "SELECT", values: [L("Leather", "جلد"), L("Metal", "معدن"), L("Rubber", "مطاط"), L("Fabric", "قماش")] },
      { key: "water-resistance", name: L("Water resistance", "مقاومة الماء"), type: "TEXT", filterable: false, icon: "lucide:Droplets" },
      gender,
    ],
    categories: [{ name: L("Men's watches", "ساعات رجالية"), icon: "lucide:Watch" }, { name: L("Women's watches", "ساعات نسائية") }, { name: L("Smart watches", "ساعات ذكية") }],
    cardAttributes: ["movement", "case-size"],
    icons: STANDARD_ICONS,
    homeSections: RETAIL_HOME,
  },
  {
    key: "furniture",
    name: L("Home & furniture", "المنزل والأثاث"),
    theme: { from: "#1c1917", to: "#57534e", accent: "#fcd34d" },
    card: { imageRatio: "4/5" },
    description: L("Furniture, lighting and decor with dimensions and materials.", "أثاث وإضاءة وديكور بالأبعاد والخامات."),
    icon: "Sofa",
    attributes: [color, material([["Wood", "خشب"], ["Metal", "معدن"], ["Fabric", "قماش"], ["Leather", "جلد"], ["Marble", "رخام"]]), dimensions, { key: "room", name: L("Room", "الغرفة"), type: "MULTISELECT", values: [L("Living room", "المجلس / الصالة"), L("Bedroom", "غرفة النوم"), L("Dining", "الطعام"), L("Office", "المكتب"), L("Outdoor", "خارجي")] }, { key: "assembly", name: L("Assembly required", "يحتاج تركيب"), type: "BOOLEAN" }],
    categories: [{ name: L("Living room", "الصالة"), icon: "lucide:Sofa" }, { name: L("Bedroom", "غرف النوم"), icon: "lucide:Bed" }, { name: L("Lighting", "الإضاءة"), icon: "lucide:Lamp" }, { name: L("Decor", "الديكور") }],
    cardAttributes: ["material", "dimensions"],
    icons: { ...STANDARD_ICONS, delivery: "lucide:PackageCheck" },
    homeSections: RETAIL_HOME,
  },
  {
    key: "home-kitchen",
    name: L("Home & kitchen", "المنزل والمطبخ"),
    theme: { from: "#022c22", to: "#065f46", accent: "#6ee7b7" },
    description: L("Appliances, cookware and household essentials.", "أجهزة منزلية وأواني ومستلزمات منزلية."),
    icon: "CookingPot",
    attributes: [color, { key: "kitchen-capacity", name: L("Capacity", "السعة"), type: "SELECT", values: [L("1 L", "1 لتر"), L("2 L", "2 لتر"), L("5 L", "5 لتر"), L("10 L", "10 لتر")] }, { key: "power", name: L("Power", "القدرة"), type: "TEXT", unit: "W", filterable: false, icon: "lucide:Zap" }, material([["Stainless steel", "ستانلس ستيل"], ["Ceramic", "سيراميك"], ["Glass", "زجاج"], ["Plastic", "بلاستيك"]])],
    categories: [{ name: L("Appliances", "الأجهزة"), icon: "lucide:Microwave" }, { name: L("Cookware", "أواني الطبخ"), icon: "lucide:CookingPot" }, { name: L("Storage", "التخزين") }, { name: L("Cleaning", "التنظيف") }],
    cardAttributes: ["kitchen-capacity", "power"],
    icons: STANDARD_ICONS,
    homeSections: RETAIL_HOME,
  },
  {
    key: "grocery",
    name: L("Grocery & supermarket", "بقالة وسوبرماركت"),
    theme: { from: "#052e16", to: "#166534", accent: "#bef264" },
    card: { imageRatio: "1/1", showRating: false, showBrand: true },
    emptyIcon: "lucide:ShoppingBasket",
    description: L("Fresh and packaged food with weight, dietary and origin.", "أغذية طازجة ومعلبة بالوزن والنظام الغذائي والمنشأ."),
    icon: "ShoppingBasket",
    attributes: [
      { key: "pack-size", name: L("Weight / volume", "الوزن / الحجم"), type: "SELECT", variant: true, highlighted: true, icon: "lucide:Weight", values: [L("250 g", "250 غ"), L("500 g", "500 غ"), L("1 kg", "1 كغ"), L("5 kg", "5 كغ"), L("330 ml", "330 مل"), L("1 L", "1 لتر")] },
      { key: "dietary", name: L("Dietary", "النظام الغذائي"), type: "MULTISELECT", values: [L("Organic", "عضوي"), L("Gluten-free", "خالٍ من الجلوتين"), L("Vegan", "نباتي"), L("Sugar-free", "خالٍ من السكر")] },
      brandOrigin,
      { key: "storage-type", name: L("Storage", "طريقة الحفظ"), type: "SELECT", icon: "lucide:Snowflake", values: [L("Ambient", "حرارة الغرفة"), L("Chilled", "مبرد"), L("Frozen", "مجمد")] },
      { key: "ingredients", name: L("Ingredients", "المكونات"), type: "TEXT", filterable: false, icon: "lucide:ListChecks" },
      { key: "allergens", name: L("Allergens", "مسببات الحساسية"), type: "MULTISELECT", values: [L("Nuts", "مكسرات"), L("Milk", "حليب"), L("Gluten", "جلوتين"), L("Eggs", "بيض"), L("Soy", "صويا")] },
    ],
    categories: [{ name: L("Fresh", "طازج"), icon: "lucide:Apple" }, { name: L("Pantry", "المخزن"), icon: "lucide:Wheat" }, { name: L("Beverages", "المشروبات"), icon: "lucide:CupSoda" }, { name: L("Snacks", "الوجبات الخفيفة"), icon: "lucide:Cookie" }],
    cardAttributes: ["pack-size", "dietary"],
    icons: { delivery: "lucide:Truck", warranty: "lucide:Leaf", returns: "lucide:RotateCcw", payment: "lucide:CreditCard" },
    homeSections: ["hero_slider", "category_grid", "product_carousel", "promo_banners", "product_carousel", "features", "newsletter"],
  },
  {
    key: "pharmacy",
    name: L("Health & personal care", "الصحة والعناية الشخصية"),
    theme: { from: "#042f2e", to: "#115e59", accent: "#5eead4" },
    description: L("Health products, vitamins and personal care.", "منتجات صحية وفيتامينات وعناية شخصية."),
    icon: "Pill",
    attributes: [{ key: "form", name: L("Form", "الشكل"), type: "SELECT", values: [L("Tablets", "أقراص"), L("Capsules", "كبسولات"), L("Syrup", "شراب"), L("Cream", "كريم"), L("Spray", "بخاخ")] }, { key: "pack-count", name: L("Count", "العدد"), type: "SELECT", variant: true, values: ["30", "60", "90", "120"].map((v) => L(v, v)) }, ageRange],
    categories: [{ name: L("Vitamins", "الفيتامينات"), icon: "lucide:Pill" }, { name: L("Personal care", "العناية الشخصية") }, { name: L("Mother & baby", "الأم والطفل"), icon: "lucide:Baby" }, { name: L("Medical devices", "الأجهزة الطبية"), icon: "lucide:Stethoscope" }],
    cardAttributes: ["form", "pack-count"],
    icons: { ...STANDARD_ICONS, warranty: "lucide:BadgeCheck" },
    homeSections: ["hero_slider", "category_grid", "product_carousel", "features", "newsletter"],
  },
  {
    key: "books",
    name: L("Books & education", "كتب وتعليم"),
    theme: { from: "#172554", to: "#1e3a8a", accent: "#fde68a" },
    card: { imageRatio: "3/4", showBrand: false },
    terms: { product: L("Title", "كتاب"), products: L("Books", "الكتب") },
    description: L("Books, e-books and stationery by author, language and format.", "كتب وقرطاسية حسب المؤلف واللغة والشكل."),
    icon: "BookOpen",
    attributes: [{ key: "author", name: L("Author", "المؤلف"), type: "TEXT", filterable: false }, { key: "language", name: L("Language", "اللغة"), type: "SELECT", values: [L("Arabic", "العربية"), L("English", "الإنجليزية")] }, { key: "format", name: L("Format", "الشكل"), type: "SELECT", variant: true, values: [L("Paperback", "غلاف ورقي"), L("Hardcover", "غلاف مقوى"), L("E-book", "كتاب إلكتروني")] }, { key: "pages", name: L("Pages", "عدد الصفحات"), type: "NUMBER", filterable: false }],
    categories: [{ name: L("Fiction", "روايات"), icon: "lucide:BookOpen" }, { name: L("Self-development", "تطوير الذات") }, { name: L("Kids' books", "كتب الأطفال") }, { name: L("Stationery", "القرطاسية"), icon: "lucide:PenTool" }],
    cardAttributes: ["author", "format"],
    icons: STANDARD_ICONS,
    homeSections: ["hero_slider", "category_grid", "product_carousel", "product_carousel", "testimonials", "newsletter"],
  },
  {
    key: "toys",
    name: L("Baby, kids & toys", "الأطفال والرضع والألعاب"),
    theme: { from: "#1e1b4b", to: "#4338ca", accent: "#fde047" },
    description: L("Toys, games and baby products by age.", "ألعاب ومنتجات أطفال حسب العمر."),
    icon: "Blocks",
    attributes: [ageRange, { key: "toy-type", name: L("Type", "النوع"), type: "SELECT", values: [L("Educational", "تعليمية"), L("Building", "تركيب"), L("Dolls", "دمى"), L("Outdoor", "خارجية"), L("Puzzles", "ألغاز")] }, { key: "batteries", name: L("Batteries required", "يحتاج بطاريات"), type: "BOOLEAN" }, gender],
    categories: [{ name: L("Baby", "الرضع"), icon: "lucide:Baby" }, { name: L("Educational", "تعليمية"), icon: "lucide:Blocks" }, { name: L("Outdoor play", "اللعب الخارجي") }, { name: L("Games & puzzles", "الألعاب والألغاز"), icon: "lucide:Puzzle" }],
    cardAttributes: ["age-range"],
    icons: { ...STANDARD_ICONS, warranty: "lucide:BadgeCheck" },
    homeSections: RETAIL_HOME,
  },
  {
    key: "sports",
    name: L("Sports & fitness", "رياضة ولياقة"),
    theme: { from: "#0c0a09", to: "#7c2d12", accent: "#f97316" },
    description: L("Sportswear, equipment and supplements.", "ملابس ومعدات ومكملات رياضية."),
    icon: "Dumbbell",
    attributes: [color, sizeApparel, { key: "sport", name: L("Sport", "الرياضة"), type: "MULTISELECT", values: [L("Running", "الجري"), L("Football", "كرة القدم"), L("Gym", "الجيم"), L("Padel", "البادل"), L("Swimming", "السباحة")] }, gender],
    categories: [{ name: L("Sportswear", "ملابس رياضية"), icon: "lucide:Shirt" }, { name: L("Equipment", "معدات"), icon: "lucide:Dumbbell" }, { name: L("Supplements", "مكملات") }],
    cardAttributes: ["size", "sport"],
    icons: STANDARD_ICONS,
    homeSections: RETAIL_HOME,
  },
  {
    key: "automotive",
    name: L("Automotive", "السيارات وقطع الغيار"),
    theme: { from: "#09090b", to: "#3f3f46", accent: "#ef4444" },
    description: L("Parts and accessories with vehicle compatibility.", "قطع وإكسسوارات مع توافق المركبات."),
    icon: "Car",
    attributes: [{ key: "make", name: L("Make", "الشركة المصنعة"), type: "MULTISELECT", values: [L("Toyota", "تويوتا"), L("Hyundai", "هيونداي"), L("Nissan", "نيسان"), L("Ford", "فورد"), L("Chevrolet", "شفروليه"), L("Lexus", "لكزس")] }, { key: "model-year", name: L("Model year", "سنة الصنع"), type: "TEXT", filterable: false }, { key: "part-number", name: L("Part number", "رقم القطعة"), type: "TEXT", filterable: false }, { key: "condition", name: L("Condition", "الحالة"), type: "SELECT", values: [L("New", "جديد"), L("Used", "مستعمل"), L("Refurbished", "مجدد")] }],
    categories: [{ name: L("Engine parts", "قطع المحرك"), icon: "lucide:Cog" }, { name: L("Tyres & wheels", "الإطارات والجنوط"), icon: "lucide:CircleDot" }, { name: L("Accessories", "الإكسسوارات"), icon: "lucide:Car" }, { name: L("Oils & fluids", "الزيوت والسوائل"), icon: "lucide:Droplet" }],
    cardAttributes: ["make", "condition"],
    icons: STANDARD_ICONS,
    homeSections: ["hero_slider", "category_grid", "product_carousel", "brand_strip", "features", "newsletter"],
  },
  {
    key: "pets",
    name: L("Pet supplies", "مستلزمات الحيوانات الأليفة"),
    theme: { from: "#1e1b4b", to: "#7c3aed", accent: "#fcd34d" },
    description: L("Food, accessories and care by pet type.", "أطعمة وإكسسوارات ورعاية حسب نوع الحيوان."),
    icon: "PawPrint",
    attributes: [
      { key: "pet-type", name: L("Pet", "الحيوان"), type: "MULTISELECT", highlighted: true, icon: "lucide:PawPrint", values: [L("Cat", "قط"), L("Dog", "كلب"), L("Bird", "طائر"), L("Fish", "سمك")] },
      { key: "life-stage", name: L("Life stage", "المرحلة العمرية"), type: "SELECT", values: [L("Young", "صغير"), L("Adult", "بالغ"), L("Senior", "كبير")] },
      { key: "pack-size", name: L("Weight / volume", "الوزن / الحجم"), type: "SELECT", variant: true, values: [L("1 kg", "1 كغ"), L("2 kg", "2 كغ"), L("10 kg", "10 كغ")] },
      { key: "pet-product", name: L("Product type", "نوع المنتج"), type: "SELECT", values: [L("Food", "طعام"), L("Treats", "مكافآت"), L("Toys", "ألعاب"), L("Grooming", "عناية"), L("Accessories", "إكسسوارات")] },
      { key: "ingredients", name: L("Ingredients", "المكونات"), type: "TEXT", filterable: false, icon: "lucide:ListChecks" },
    ],
    categories: [{ name: L("Cats", "القطط"), icon: "lucide:Cat" }, { name: L("Dogs", "الكلاب"), icon: "lucide:Dog" }, { name: L("Birds & fish", "الطيور والأسماك"), icon: "lucide:Fish" }],
    cardAttributes: ["pet-type", "pack-size"],
    icons: STANDARD_ICONS,
    homeSections: RETAIL_HOME,
  },
  {
    key: "flowers-gifts",
    name: L("Gifts & flowers", "هدايا وزهور"),
    theme: { from: "#500724", to: "#9d174d", accent: "#fda4af" },
    description: L("Bouquets, gift boxes and occasions with same-day delivery.", "باقات وصناديق هدايا ومناسبات مع توصيل في نفس اليوم."),
    icon: "Flower2",
    attributes: [{ key: "occasion", name: L("Occasion", "المناسبة"), type: "MULTISELECT", values: [L("Birthday", "عيد ميلاد"), L("Wedding", "زواج"), L("New baby", "مولود جديد"), L("Graduation", "تخرج"), L("Get well", "سلامتك"), L("Eid", "العيد")] }, { key: "arrangement", name: L("Arrangement", "التنسيق"), type: "SELECT", values: [L("Bouquet", "باقة"), L("Box", "صندوق"), L("Vase", "مزهرية"), L("Basket", "سلة")] }, color],
    categories: [{ name: L("Bouquets", "الباقات"), icon: "lucide:Flower2" }, { name: L("Gift boxes", "صناديق الهدايا"), icon: "lucide:Gift" }, { name: L("Chocolates", "الشوكولاتة") }, { name: L("Balloons", "البالونات") }],
    cardAttributes: ["arrangement", "occasion"],
    icons: { delivery: "lucide:Clock", warranty: "lucide:Flower2", returns: "lucide:RotateCcw", payment: "lucide:CreditCard" },
    homeSections: ["hero_slider", "category_grid", "product_carousel", "promo_banners", "testimonials", "newsletter"],
  },
  {
    key: "digital",
    name: L("Digital products", "منتجات رقمية"),
    theme: { from: "#0f172a", to: "#312e81", accent: "#818cf8" },
    description: L("Gift cards, software licences and digital downloads.", "بطاقات هدايا وتراخيص برامج وتحميلات رقمية."),
    icon: "Download",
    attributes: [{ key: "platform", name: L("Platform", "المنصة"), type: "SELECT", values: [L("PlayStation", "بلايستيشن"), L("Xbox", "إكس بوكس"), L("Steam", "ستيم"), L("iTunes", "آيتونز"), L("Google Play", "جوجل بلاي")] }, { key: "region", name: L("Region", "المنطقة"), type: "SELECT", values: [L("Saudi Arabia", "السعودية"), L("UAE", "الإمارات"), L("Global", "عالمي")] }, { key: "denomination", name: L("Value", "القيمة"), type: "SELECT", variant: true, values: ["50", "100", "200", "500"].map((v) => L(`${v} SAR`, `${v} ريال`)) }, { key: "delivery-type", name: L("Delivery", "التسليم"), type: "SELECT", values: [L("Instant code", "كود فوري"), L("Email", "بريد إلكتروني")] }],
    categories: [{ name: L("Gift cards", "بطاقات الهدايا"), icon: "lucide:Ticket" }, { name: L("Game credits", "رصيد الألعاب"), icon: "lucide:Gamepad2" }, { name: L("Software", "البرامج"), icon: "lucide:AppWindow" }],
    cardAttributes: ["platform", "region"],
    icons: { delivery: "lucide:Zap", warranty: "lucide:ShieldCheck", returns: "lucide:Info", payment: "lucide:CreditCard" },
    homeSections: ["hero_slider", "category_grid", "product_carousel", "brand_strip", "features", "newsletter"],
  },
  {
    key: "restaurant",
    name: L("Food & beverages", "أطعمة ومشروبات"),
    theme: { from: "#1c0a00", to: "#7c2d12", accent: "#fb923c" },
    card: { imageRatio: "1/1", showRating: true },
    terms: { product: L("Dish", "صنف"), products: L("Menu", "القائمة") },
    description: L("Menu items, combos and add-ons with spice level and size.", "أصناف القائمة والوجبات والإضافات بدرجة الحرارة والحجم."),
    icon: "UtensilsCrossed",
    attributes: [{ key: "portion", name: L("Size", "الحجم"), type: "SELECT", variant: true, values: [L("Small", "صغير"), L("Medium", "وسط"), L("Large", "كبير")] }, { key: "spice", name: L("Spice level", "درجة الحرارة"), type: "SELECT", values: [L("Mild", "خفيف"), L("Medium", "متوسط"), L("Hot", "حار")] }, { key: "dietary", name: L("Dietary", "النظام الغذائي"), type: "MULTISELECT", values: [L("Vegetarian", "نباتي"), L("Gluten-free", "خالٍ من الجلوتين"), L("Healthy", "صحي")] }, { key: "calories", name: L("Calories", "السعرات"), type: "NUMBER", unit: "kcal", filterable: false, icon: "lucide:Flame" }],
    categories: [{ name: L("Mains", "الأطباق الرئيسية"), icon: "lucide:UtensilsCrossed" }, { name: L("Drinks", "المشروبات"), icon: "lucide:Coffee" }, { name: L("Desserts", "الحلويات"), icon: "lucide:CakeSlice" }],
    cardAttributes: ["portion", "calories"],
    icons: { delivery: "lucide:Bike", warranty: "lucide:ChefHat", returns: "lucide:RotateCcw", payment: "lucide:CreditCard" },
    homeSections: ["hero_slider", "category_grid", "product_carousel", "promo_banners", "newsletter"],
  },
  {
    key: "handmade",
    name: L("Handmade & crafts", "أعمال يدوية"),
    theme: { from: "#292524", to: "#78350f", accent: "#fcd34d" },
    description: L("Handmade goods, crafts and personalised items.", "منتجات يدوية وحرف ومنتجات مخصصة."),
    icon: "Scissors",
    attributes: [color, material([["Wool", "صوف"], ["Clay", "طين"], ["Wood", "خشب"], ["Leather", "جلد"], ["Resin", "ريزن"]]), { key: "personalisable", name: L("Personalisable", "قابل للتخصيص"), type: "BOOLEAN" }, dimensions],
    categories: [{ name: L("Home decor", "ديكور المنزل") }, { name: L("Accessories", "الإكسسوارات") }, { name: L("Gifts", "الهدايا"), icon: "lucide:Gift" }],
    cardAttributes: ["material"],
    icons: { ...STANDARD_ICONS, warranty: "lucide:HandHeart" },
    homeSections: ["hero_slider", "category_grid", "product_carousel", "image_text", "testimonials", "newsletter"],
  },
  {
    key: "optics",
    name: L("Eyewear & optics", "نظارات وبصريات"),
    theme: { from: "#0f172a", to: "#0e7490", accent: "#67e8f9" },
    description: L("Glasses, sunglasses and contact lenses.", "نظارات طبية وشمسية وعدسات لاصقة."),
    icon: "Glasses",
    attributes: [{ key: "frame-shape", name: L("Frame shape", "شكل الإطار"), type: "SELECT", values: [L("Round", "دائري"), L("Square", "مربع"), L("Aviator", "طيار"), L("Cat-eye", "عين القطة")] }, { key: "lens-type", name: L("Lens", "العدسة"), type: "SELECT", values: [L("Polarised", "مستقطبة"), L("Blue-light", "حماية من الضوء الأزرق"), L("Prescription", "طبية")] }, color, gender],
    categories: [{ name: L("Sunglasses", "نظارات شمسية"), icon: "lucide:Glasses" }, { name: L("Eyeglasses", "نظارات طبية") }, { name: L("Contact lenses", "عدسات لاصقة"), icon: "lucide:Eye" }],
    cardAttributes: ["frame-shape", "lens-type"],
    icons: STANDARD_ICONS,
    homeSections: RETAIL_HOME,
  },
];

/** A store that doesn't fit a preset: name, icons and attributes are configured by hand. */
export const CUSTOM_STORE_TYPE = "custom";

export const TRUST_CONCEPTS: { key: TrustConcept; name: T }[] = [
  { key: "delivery", name: L("Delivery", "التوصيل") },
  { key: "warranty", name: L("Quality / warranty", "الجودة / الضمان") },
  { key: "returns", name: L("Returns", "الإرجاع") },
  { key: "payment", name: L("Secure payment", "الدفع الآمن") },
];

export const storeTypeByKey = (key: string) => STORE_TYPES.find((t) => t.key === key);

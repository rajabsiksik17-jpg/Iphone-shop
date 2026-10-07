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
export type StoreTypePreset = {
  key: string;
  name: T;
  description: T;
  icon: string;
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
    name: L("Phones & electronics", "جوالات وإلكترونيات"),
    description: L("Smartphones, tablets, laptops, wearables and accessories.", "جوالات وأجهزة لوحية ولابتوبات وأجهزة قابلة للارتداء وإكسسوارات."),
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
    key: "computers",
    name: L("Computers & gaming", "حاسبات وألعاب"),
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
    description: L("Perfumes, oud, bakhoor and gift sets by scent family.", "عطور وعود وبخور وأطقم هدايا حسب العائلة العطرية."),
    icon: "SprayCan",
    attributes: [
      volume,
      { key: "scent-family", name: L("Scent family", "العائلة العطرية"), type: "MULTISELECT", values: [L("Oud", "عود"), L("Floral", "زهري"), L("Woody", "خشبي"), L("Musk", "مسك"), L("Citrus", "حمضي"), L("Oriental", "شرقي")] },
      { key: "concentration", name: L("Concentration", "التركيز"), type: "SELECT", values: [L("Eau de Parfum", "أو دو بارفان"), L("Eau de Toilette", "أو دو تواليت"), L("Parfum", "بارفان"), L("Perfume oil", "دهن عطر")] },
      gender,
    ],
    categories: [{ name: L("Perfumes", "العطور"), icon: "lucide:SprayCan" }, { name: L("Oud & oils", "العود والدهن") }, { name: L("Bakhoor", "البخور"), icon: "lucide:Flame" }, { name: L("Gift sets", "أطقم الهدايا"), icon: "lucide:Gift" }],
    cardAttributes: ["volume", "concentration"],
    icons: { ...STANDARD_ICONS, warranty: "lucide:BadgeCheck" },
    homeSections: ["hero_slider", "category_grid", "product_carousel", "promo_banners", "brand_strip", "testimonials", "newsletter"],
  },
  {
    key: "jewelry",
    name: L("Jewellery", "مجوهرات"),
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
    name: L("Furniture & decor", "أثاث وديكور"),
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
    name: L("Grocery & food", "بقالة وأغذية"),
    description: L("Fresh and packaged food with weight, dietary and origin.", "أغذية طازجة ومعلبة بالوزن والنظام الغذائي والمنشأ."),
    icon: "ShoppingBasket",
    attributes: [{ key: "pack-size", name: L("Pack size", "حجم العبوة"), type: "SELECT", variant: true, values: [L("250 g", "250 غ"), L("500 g", "500 غ"), L("1 kg", "1 كغ"), L("5 kg", "5 كغ")] }, { key: "dietary", name: L("Dietary", "النظام الغذائي"), type: "MULTISELECT", values: [L("Organic", "عضوي"), L("Gluten-free", "خالٍ من الجلوتين"), L("Vegan", "نباتي"), L("Sugar-free", "خالٍ من السكر")] }, brandOrigin, { key: "storage-type", name: L("Storage", "طريقة الحفظ"), type: "SELECT", values: [L("Ambient", "حرارة الغرفة"), L("Chilled", "مبرد"), L("Frozen", "مجمد")] }],
    categories: [{ name: L("Fresh", "طازج"), icon: "lucide:Apple" }, { name: L("Pantry", "المخزن"), icon: "lucide:Wheat" }, { name: L("Beverages", "المشروبات"), icon: "lucide:CupSoda" }, { name: L("Snacks", "الوجبات الخفيفة"), icon: "lucide:Cookie" }],
    cardAttributes: ["pack-size", "dietary"],
    icons: { delivery: "lucide:Truck", warranty: "lucide:Leaf", returns: "lucide:RotateCcw", payment: "lucide:CreditCard" },
    homeSections: ["hero_slider", "category_grid", "product_carousel", "promo_banners", "product_carousel", "features", "newsletter"],
  },
  {
    key: "pharmacy",
    name: L("Pharmacy & health", "صيدلية وصحة"),
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
    name: L("Books & stationery", "كتب وقرطاسية"),
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
    name: L("Toys & kids", "ألعاب وأطفال"),
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
    name: L("Car parts & accessories", "قطع وإكسسوارات السيارات"),
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
    name: L("Pet supplies", "مستلزمات الحيوانات"),
    description: L("Food, accessories and care by pet type.", "أطعمة وإكسسوارات ورعاية حسب نوع الحيوان."),
    icon: "PawPrint",
    attributes: [{ key: "pet-type", name: L("Pet", "الحيوان"), type: "MULTISELECT", values: [L("Cat", "قط"), L("Dog", "كلب"), L("Bird", "طائر"), L("Fish", "سمك")] }, { key: "life-stage", name: L("Life stage", "المرحلة العمرية"), type: "SELECT", values: [L("Young", "صغير"), L("Adult", "بالغ"), L("Senior", "كبير")] }, { key: "pack-size", name: L("Pack size", "حجم العبوة"), type: "SELECT", variant: true, values: [L("1 kg", "1 كغ"), L("2 kg", "2 كغ"), L("10 kg", "10 كغ")] }],
    categories: [{ name: L("Cats", "القطط"), icon: "lucide:Cat" }, { name: L("Dogs", "الكلاب"), icon: "lucide:Dog" }, { name: L("Birds & fish", "الطيور والأسماك"), icon: "lucide:Fish" }],
    cardAttributes: ["pet-type", "pack-size"],
    icons: STANDARD_ICONS,
    homeSections: RETAIL_HOME,
  },
  {
    key: "flowers-gifts",
    name: L("Flowers & gifts", "زهور وهدايا"),
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
    name: L("Restaurant & café", "مطعم ومقهى"),
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

/**
 * Store-type templates: the ready-made demo catalog each store type starts
 * with — brands, products (with specs, variants and stock), hero copy and the
 * art used for its images. Definitions only; instantiation lives in
 * server/admin/store-profiles. Every record a template creates is tagged
 * `source = DEMO` and `templateRef = "<type>/<kind>/<ref>"`, so instantiating
 * twice never duplicates anything and merchant data is never touched.
 *
 * Products reference the store type's preset categories by position
 * ("2" = third top-level category, "3.1" = its second child) and attribute
 * values by their English label. tests/store-templates.test.ts checks that
 * every reference resolves.
 *
 * Bump a type's `version` when its template changes; profiles initialised
 * from an older version are offered the additions (never overwrites).
 */
import type { ArtKind } from "@/server/templates/art";

type T = { en: string; ar: string };
const L = (en: string, ar: string): T => ({ en, ar });

export type SpecValue = string | string[] | number | boolean | T;
export type TemplateProduct = {
  ref: string;
  name: T;
  short: T;
  brand: number;
  cat: string;
  /** Prices in SAR (converted to the store's base currency on instantiation). */
  price: number;
  sale?: number;
  art: ArtKind;
  color: string;
  specs?: Record<string, SpecValue>;
  /** One variation axis: attribute key + values (English labels) and optional price deltas (SAR). */
  variants?: { attr: string; values: string[]; delta?: Record<string, number> };
  stock?: number;
  featured?: boolean;
};
export type StoreTemplate = {
  version: number;
  brands: { ref: string; name: string; color: string }[];
  /** Art for category tiles, in category order. */
  categoryArt: ArtKind[];
  hero: { heading: T; body: T; art: ArtKind; color: string };
  products: TemplateProduct[];
};

const P = (ref: string, name: T, short: T, brand: number, cat: string, price: number, art: ArtKind, color: string, specs?: Record<string, SpecValue>, extra: Partial<TemplateProduct> = {}): TemplateProduct => ({ ref, name, short, brand, cat, price, art, color, specs, ...extra });

export const STORE_TEMPLATES: Record<string, StoreTemplate> = {
  electronics: {
    version: 1,
    brands: [{ ref: "nova", name: "Nova", color: "#4f46e5" }, { ref: "volta", name: "Volta", color: "#0ea5e9" }, { ref: "pulse", name: "Pulse", color: "#111827" }],
    categoryArt: ["phone", "tablet", "laptop", "earbuds"],
    hero: { heading: L("Smart tech for every day", "تقنية ذكية لكل يوم"), body: L("Phones, laptops and audio from trusted brands — with fast delivery.", "جوالات ولابتوبات وصوتيات من علامات موثوقة — مع توصيل سريع."), art: "phone-pro", color: "#7d7f82" },
    products: [
      P("nova-x5", L("Nova X5 5G", "نوفا X5 5G"), L("6.7-inch AMOLED, 50 MP camera and all-day battery.", "شاشة AMOLED مقاس 6.7 إنش وكاميرا 50 ميجابكسل وبطارية تدوم طوال اليوم."), 0, "0", 2599, "phone-pro", "#1f2937", { color: "Black", ram: "8GB", "screen-size": '6.7"', battery: L("5,000 mAh", "5,000 مللي أمبير"), network: "5G" }, { sale: 2399, variants: { attr: "storage", values: ["128GB", "256GB"], delta: { "256GB": 300 } }, featured: true }),
      P("volta-tab-11", L("Volta Tab 11", "فولتا تاب 11"), L("11-inch tablet for streaming, study and work.", "جهاز لوحي 11 إنش للمشاهدة والدراسة والعمل."), 1, "1", 1399, "tablet", "#64748b", { color: "Gray", storage: "128GB", ram: "6GB", battery: L("8,000 mAh", "8,000 مللي أمبير") }),
      P("pulse-book-14", L("Pulse Book 14", "بلس بوك 14"), L("Thin 14-inch laptop with 16GB memory and a fast SSD.", "لابتوب نحيف 14 إنش بذاكرة 16 جيجابايت وقرص SSD سريع."), 2, "2", 3299, "laptop", "#9ca3af", { color: "Gray", storage: "512GB", ram: "16GB" }, { featured: true }),
      P("nova-buds", L("Nova Buds ANC", "نوفا بادز ANC"), L("Wireless earbuds with active noise cancellation.", "سماعات لاسلكية بعزل نشط للضوضاء."), 0, "3", 349, "earbuds", "#f8fafc", { color: "White", battery: L("30 h with case", "30 ساعة مع العلبة") }, { sale: 299 }),
      P("volta-65w-charger", L("Volta 65W GaN charger", "شاحن فولتا GaN بقدرة 65 واط"), L("Charges a laptop, tablet and phone from one plug.", "يشحن اللابتوب والجهاز اللوحي والجوال من مقبس واحد."), 1, "3", 149, "charger", "#fafafa", { color: "White" }),
      P("pulse-watch-2", L("Pulse Watch 2", "بلس ووتش 2"), L("Health tracking, GPS and a week of battery.", "تتبع صحي وGPS وبطارية تدوم أسبوعاً."), 2, "3", 899, "watch", "#111827", { color: "Black", battery: L("7 days", "7 أيام") }),
    ],
  },
  smartphones: {
    version: 1,
    brands: [{ ref: "apex", name: "Apex", color: "#111827" }, { ref: "orbit", name: "Orbit", color: "#1d4ed8" }, { ref: "lumo", name: "Lumo", color: "#7c3aed" }],
    categoryArt: ["phone-pro", "phone", "fold", "case"],
    hero: { heading: L("The new Apex 15 Pro", "آبكس 15 برو الجديد"), body: L("Pro cameras, all-day battery and next-day delivery in major cities.", "كاميرات احترافية وبطارية تدوم طوال اليوم وتوصيل في اليوم التالي للمدن الرئيسية."), art: "phone-pro", color: "#e46a2e" },
    products: [
      P("apex-15-pro", L("Apex 15 Pro", "آبكس 15 برو"), L("6.3-inch display, triple 48 MP cameras, titanium frame.", "شاشة 6.3 إنش وثلاث كاميرات 48 ميجابكسل وإطار من التيتانيوم."), 0, "0", 4699, "phone-pro", "#d4d4d8", { color: "Gray", ram: "8GB", "screen-size": '6.3"', processor: L("A-series 6-core", "معالج سداسي النواة"), camera: L("48 MP triple", "ثلاث كاميرات 48 ميجابكسل"), battery: L("3,600 mAh", "3,600 مللي أمبير"), network: "5G", "warranty-period": "1 year" }, { variants: { attr: "storage", values: ["256GB", "512GB", "1TB"], delta: { "512GB": 800, "1TB": 1800 } }, featured: true }),
      P("orbit-s9", L("Orbit S9", "أوربت S9"), L("Big 6.7-inch screen and a 200 MP zoom camera.", "شاشة كبيرة 6.7 إنش وكاميرا 200 ميجابكسل مع تقريب."), 1, "1", 3299, "phone-pro", "#1e3a8a", { color: "Blue", storage: "256GB", ram: "12GB", "screen-size": '6.7"', camera: L("200 MP", "200 ميجابكسل"), battery: L("5,000 mAh", "5,000 مللي أمبير"), network: "5G", "warranty-period": "2 years" }, { sale: 2999 }),
      P("lumo-fold-2", L("Lumo Fold 2", "لومو فولد 2"), L("A phone that opens into a tablet.", "جوال يتحول إلى جهاز لوحي."), 2, "2", 6499, "fold", "#312e81", { color: "Black", storage: "512GB", ram: "12GB", network: "5G", "warranty-period": "2 years" }, { featured: true }),
      P("orbit-a5", L("Orbit A5", "أوربت A5"), L("Everyday phone with a long-lasting battery.", "جوال يومي ببطارية طويلة العمر."), 1, "1", 999, "phone", "#10b981", { color: "Green", storage: "128GB", ram: "6GB", "screen-size": '6.7"', battery: L("6,000 mAh", "6,000 مللي أمبير"), network: "4G", "warranty-period": "1 year" }, { sale: 849 }),
      P("apex-clear-case", L("Apex 15 Pro clear case", "غطاء شفاف لآبكس 15 برو"), L("Slim, drop-tested and magnet-ready.", "نحيف ومختبر ضد السقوط ويدعم المغناطيس."), 0, "3.0", 99, "case", "#e5e7eb", { color: "White" }),
      P("lumo-45w-charger", L("Lumo 45W fast charger", "شاحن لومو السريع 45 واط"), L("Super-fast USB-C charging with cable.", "شحن فائق السرعة USB-C مع كابل."), 2, "3.1", 129, "charger", "#fafafa", { color: "White" }),
    ],
  },
  tablets: {
    version: 1,
    brands: [{ ref: "apex", name: "Apex", color: "#111827" }, { ref: "orbit", name: "Orbit", color: "#1d4ed8" }, { ref: "kiddo", name: "Kiddo", color: "#f59e0b" }],
    categoryArt: ["tablet", "tablet", "tablet", "case"],
    hero: { heading: L("A tablet for every desk", "جهاز لوحي لكل مكتب"), body: L("Draw, study and stream — keyboards and pens included in bundles.", "ارسم وادرس وشاهد — مع لوحات المفاتيح والأقلام في الحزم."), art: "tablet", color: "#93c5fd" },
    products: [
      P("apex-pad-air", L("Apex Pad Air 11", "آبكس باد إير 11"), L("Light 11-inch tablet with pen support.", "جهاز لوحي خفيف 11 إنش يدعم القلم."), 0, "0", 2599, "tablet", "#93c5fd", { color: "Blue", storage: "128GB", "screen-size": '11"', stylus: true, processor: L("M-series", "معالج M") }, { variants: { attr: "connectivity", values: ["Wi-Fi", "Wi-Fi + Cellular"], delta: { "Wi-Fi + Cellular": 600 } }, featured: true }),
      P("apex-pad-pro-13", L("Apex Pad Pro 13", "آبكس باد برو 13"), L("13-inch pro display for creators.", "شاشة احترافية 13 إنش للمبدعين."), 0, "0", 5299, "tablet", "#3f3f46", { color: "Gray", storage: "256GB", "screen-size": '13"', connectivity: "Wi-Fi", stylus: true }),
      P("orbit-tab-s", L("Orbit Tab S 12.4", "أوربت تاب S 12.4"), L("Big AMOLED screen and a pen in the box.", "شاشة AMOLED كبيرة وقلم داخل العلبة."), 1, "1", 1999, "tablet", "#1f2937", { color: "Black", storage: "256GB", "screen-size": '12.4"', connectivity: "Wi-Fi", stylus: true }, { sale: 1799 }),
      P("kiddo-tab-8", L("Kiddo Tab 8", "كيدو تاب 8"), L("Kid-proof tablet with parental controls.", "جهاز لوحي مقاوم للأطفال مع رقابة أبوية."), 2, "2", 499, "tablet", "#f59e0b", { color: "Blue", storage: "64GB", "screen-size": '8.3"', connectivity: "Wi-Fi", stylus: false }),
      P("apex-folio-keyboard", L("Folio keyboard case", "غطاء مع لوحة مفاتيح"), L("Backlit keys and a built-in trackpad.", "مفاتيح مضيئة ولوحة لمس مدمجة."), 0, "3", 699, "case", "#f5f5f5", { color: "White" }),
      P("orbit-usb-c-hub", L("USB-C hub 6-in-1", "موزع USB-C ستة في واحد"), L("HDMI, USB-A, SD and 100W pass-through.", "HDMI وUSB-A وSD وشحن 100 واط."), 1, "3", 199, "charger", "#d4d4d8", { color: "Gray" }),
    ],
  },
  computers: {
    version: 1,
    brands: [{ ref: "vertex", name: "Vertex", color: "#0f172a" }, { ref: "corelab", name: "Corelab", color: "#0284c7" }, { ref: "kairo", name: "Kairo", color: "#dc2626" }],
    categoryArt: ["laptop", "box", "gamepad", "powerbank"],
    hero: { heading: L("Power for work and play", "قوة للعمل واللعب"), body: L("Ultrabooks, gaming rigs and upgrades — configured your way.", "لابتوبات نحيفة وأجهزة ألعاب وترقيات — بالمواصفات التي تريدها."), art: "laptop", color: "#9ca3af" },
    products: [
      P("vertex-ultrabook-14", L("Vertex Ultrabook 14", "فيرتكس ألترابوك 14"), L("1.2 kg, 18-hour battery, Core Ultra 7.", "وزن 1.2 كغ وبطارية 18 ساعة ومعالج Core Ultra 7."), 0, "0", 4299, "laptop", "#d1d5db", { processor: L("Core Ultra 7", "Core Ultra 7"), storage: "1TB", gpu: L("Integrated Arc", "Arc مدمج") }, { variants: { attr: "ram", values: ["16GB", "32GB"], delta: { "32GB": 700 } }, featured: true }),
      P("kairo-gaming-16", L("Kairo Gaming 16", "كايرو للألعاب 16"), L("RTX 4070 graphics and a 240 Hz display.", "كرت RTX 4070 وشاشة 240 هرتز."), 2, "2", 6999, "laptop", "#111827", { processor: L("Ryzen 9", "Ryzen 9"), ram: "32GB", storage: "1TB", gpu: L("RTX 4070 8GB", "RTX 4070 8GB"), platform: "PC" }, { sale: 6499 }),
      P("corelab-mini-pc", L("Corelab Mini PC", "كورلاب ميني PC"), L("A full desktop the size of a book.", "كمبيوتر مكتبي كامل بحجم كتاب."), 1, "1", 2499, "box", "#1f2937", { processor: L("Core i7", "Core i7"), ram: "16GB", storage: "512GB" }),
      P("kairo-pro-controller", L("Kairo Pro controller", "يد تحكم كايرو برو"), L("Wireless controller with back paddles.", "يد تحكم لاسلكية بأزرار خلفية."), 2, "2", 299, "gamepad", "#0f172a", { platform: "PC" }),
      P("corelab-nvme-1tb", L("Corelab NVMe SSD 1TB", "قرص كورلاب NVMe سعة 1TB"), L("7,000 MB/s for instant load times.", "7,000 ميجابايت/ث لتحميل فوري."), 1, "3", 349, "powerbank", "#27272a", { storage: "1TB" }),
      P("vertex-headset", L("Vertex wireless headset", "سماعة فيرتكس اللاسلكية"), L("Low-latency gaming audio with a clear mic.", "صوت ألعاب منخفض التأخير مع ميكروفون نقي."), 0, "2", 449, "headphones", "#111827", { platform: "PC" }),
    ],
  },
  fashion: {
    version: 1,
    brands: [{ ref: "layal", name: "Layal", color: "#111111" }, { ref: "sadu", name: "Sadu", color: "#9a3412" }, { ref: "mira", name: "Mira", color: "#be185d" }],
    categoryArt: ["robe", "robe", "tshirt"],
    hero: { heading: L("The new season edit", "تشكيلة الموسم الجديد"), body: L("Abayas, thobes and everyday essentials in breathable fabrics.", "عبايات وثياب وأساسيات يومية بأقمشة مريحة."), art: "robe", color: "#111111" },
    products: [
      P("layal-classic-abaya", L("Classic crepe abaya", "عباية كريب كلاسيكية"), L("Flowing cut with hand-finished edges.", "قصة انسيابية بحواف مشغولة يدوياً."), 0, "0.0", 449, "robe", "#111111", { color: "Black", gender: "Women", material: "Silk", fit: "Regular" }, { sale: 379, variants: { attr: "size", values: ["S", "M", "L", "XL"] }, featured: true }),
      P("layal-linen-dress", L("Linen midi dress", "فستان كتان متوسط الطول"), L("Light linen for warm days.", "كتان خفيف للأيام الدافئة."), 0, "0.1", 329, "robe", "#e7d8c3", { color: "Beige", gender: "Women", material: "Linen" }, { variants: { attr: "size", values: ["S", "M", "L"] } }),
      P("mira-oversized-tee", L("Oversized cotton tee", "تيشيرت قطني واسع"), L("Heavyweight cotton, relaxed fit.", "قطن ثقيل بقصة مريحة."), 2, "0.2", 99, "tshirt", "#f5f5f5", { color: "White", gender: "Unisex", material: "Cotton", fit: "Oversized" }, { variants: { attr: "size", values: ["S", "M", "L", "XL"] } }),
      P("sadu-summer-thobe", L("Summer thobe", "ثوب صيفي"), L("Breathable cotton blend, tailored collar.", "مزيج قطني مريح بياقة مفصّلة."), 1, "1.0", 249, "robe", "#f5f5f5", { color: "White", gender: "Men", material: "Cotton", fit: "Regular" }, { variants: { attr: "size", values: ["M", "L", "XL", "XXL"] }, featured: true }),
      P("sadu-oxford-shirt", L("Oxford shirt", "قميص أكسفورد"), L("A smart shirt that works every day.", "قميص أنيق يناسب كل يوم."), 1, "1.1", 159, "tshirt", "#2563eb", { color: "Blue", gender: "Men", material: "Cotton", fit: "Slim" }, { variants: { attr: "size", values: ["M", "L", "XL"] } }),
      P("mira-kids-tee", L("Kids graphic tee", "تيشيرت أطفال مطبوع"), L("Soft cotton with a playful print.", "قطن ناعم بطبعة مرحة."), 2, "2", 69, "tshirt", "#ec4899", { color: "Pink", gender: "Kids", material: "Cotton" }, { variants: { attr: "size", values: ["XS", "S"] } }),
    ],
  },
  shoes: {
    version: 1,
    brands: [{ ref: "stride", name: "Stride", color: "#2563eb" }, { ref: "atlas", name: "Atlas", color: "#3f2a1d" }, { ref: "nomad", name: "Nomad", color: "#111111" }],
    categoryArt: ["shoe", "shoe", "shoe", "bag"],
    hero: { heading: L("Step into comfort", "خطوات مريحة"), body: L("Runners, classics and bags — free exchanges on sizes.", "أحذية جري وكلاسيكية وحقائب — استبدال المقاس مجاناً."), art: "shoe", color: "#2563eb" },
    products: [
      P("stride-runner-pro", L("Stride Runner Pro", "سترايد رنر برو"), L("Responsive foam for daily miles.", "رغوة مرنة للجري اليومي."), 0, "0", 449, "shoe", "#2563eb", { color: "Blue", gender: "Unisex", material: "Synthetic" }, { sale: 389, variants: { attr: "shoe-size", values: ["40", "41", "42", "43", "44"] }, featured: true }),
      P("stride-court-classic", L("Court classic sneaker", "حذاء رياضي كلاسيكي"), L("Clean leather upper, all-day comfort.", "جلد ناعم وراحة طوال اليوم."), 0, "0", 349, "shoe", "#f5f5f5", { color: "White", gender: "Unisex", material: "Leather" }, { variants: { attr: "shoe-size", values: ["39", "40", "41", "42", "43"] } }),
      P("atlas-oxford", L("Atlas leather oxford", "حذاء أكسفورد جلد"), L("Hand-polished calf leather.", "جلد عجل ملمّع يدوياً."), 1, "1", 549, "shoe", "#3f2a1d", { color: "Black", gender: "Men", material: "Leather" }, { variants: { attr: "shoe-size", values: ["41", "42", "43", "44"] } }),
      P("nomad-slide", L("Nomad slide sandal", "صندل نوماد"), L("Cushioned footbed for summer.", "نعل مبطن للصيف."), 2, "2", 149, "shoe", "#111111", { color: "Black", gender: "Unisex", material: "Synthetic" }, { variants: { attr: "shoe-size", values: ["40", "41", "42", "43"] } }),
      P("atlas-leather-tote", L("Leather tote", "حقيبة جلد كبيرة"), L("Roomy tote with an inner laptop sleeve.", "حقيبة واسعة مع جيب داخلي للابتوب."), 1, "3", 399, "bag", "#b45309", { color: "Beige", gender: "Women", material: "Leather" }),
      P("nomad-backpack", L("Canvas backpack", "حقيبة ظهر قماش"), L("Water-resistant canvas, 20 L.", "قماش مقاوم للماء بسعة 20 لتراً."), 2, "3", 249, "bag", "#1f2937", { color: "Gray", gender: "Unisex", material: "Canvas" }),
    ],
  },
  beauty: {
    version: 1,
    brands: [{ ref: "velvet", name: "Velvet", color: "#be123c" }, { ref: "dew", name: "Dew", color: "#0284c7" }, { ref: "noor", name: "Noor", color: "#b45309" }],
    categoryArt: ["lipstick", "jar", "bottle", "bag"],
    hero: { heading: L("Glow, naturally", "إشراقة طبيعية"), body: L("Skincare and makeup chosen for our climate.", "عناية بالبشرة ومكياج مختار لمناخنا."), art: "jar", color: "#f5e1c8" },
    products: [
      P("velvet-matte-lipstick", L("Velvet matte lipstick", "أحمر شفاه مطفي من فيلفت"), L("Long-wear colour that never dries lips.", "لون ثابت لا يجفف الشفاه."), 0, "0", 89, "lipstick", "#be123c", { "cruelty-free": true }, { featured: true }),
      P("velvet-skin-foundation", L("Second-skin foundation", "كريم أساس طبيعي"), L("Light, buildable coverage with SPF 20.", "تغطية خفيفة قابلة للزيادة مع SPF 20."), 0, "0", 159, "bottle", "#d6a77a", { volume: "30 ml", "skin-type": ["Normal", "Combination"], "cruelty-free": true }, { variants: { attr: "shade", values: ["Fair", "Medium", "Tan", "Deep"] } }),
      P("dew-hydra-serum", L("Hydra serum", "سيروم الترطيب"), L("Hyaluronic acid for plump, calm skin.", "حمض الهيالورونيك لبشرة ممتلئة وهادئة."), 1, "1", 189, "bottle", "#93c5fd", { volume: "30 ml", "skin-type": ["Dry", "Normal"], concern: ["Hydration"] }, { sale: 159, featured: true }),
      P("dew-night-cream", L("Renewing night cream", "كريم الليل المجدد"), L("Retinol and peptides while you sleep.", "ريتينول وببتيدات أثناء النوم."), 1, "1", 219, "jar", "#f5e1c8", { volume: "50 ml", concern: ["Anti-aging"] }),
      P("noor-argan-shampoo", L("Argan repair shampoo", "شامبو الأرغان المرمم"), L("Sulphate-free care for dry hair.", "عناية خالية من الكبريتات للشعر الجاف."), 2, "2", 79, "bottle", "#fbbf24", { volume: "200 ml" }),
      P("noor-brush-set", L("Brush set with pouch", "طقم فرش مع حقيبة"), L("Eight soft brushes for face and eyes.", "ثماني فرش ناعمة للوجه والعينين."), 2, "3", 129, "bag", "#f9a8d4", { "cruelty-free": true }),
    ],
  },
  perfumes: {
    version: 1,
    brands: [{ ref: "majd", name: "Oud Al Majd", color: "#3b2416" }, { ref: "lumiere", name: "Maison Lumière", color: "#9d174d" }, { ref: "ambar", name: "Ambar", color: "#b45309" }],
    categoryArt: ["bottle", "bottle", "jar", "gift"],
    hero: { heading: L("Royal oud, made to last", "عود ملكي يدوم"), body: L("Rich oud, musk and amber — gift-wrapped on request.", "عود ومسك وعنبر فاخر — مع تغليف هدايا عند الطلب."), art: "bottle", color: "#3b2416" },
    products: [
      P("majd-royal-oud", L("Royal Oud", "العود الملكي"), L("Cambodian oud with saffron and rose.", "عود كمبودي مع الزعفران والورد."), 0, "0", 649, "bottle", "#3b2416", { "scent-family": ["Oud", "Woody"], concentration: "Parfum", gender: "Unisex", "top-notes": L("Saffron, pink pepper", "زعفران، فلفل وردي"), "heart-notes": L("Taif rose", "ورد طائفي"), "base-notes": L("Oud, amber", "عود، عنبر"), longevity: "Very long (8 h+)" }, { sale: 549, variants: { attr: "volume", values: ["50 ml", "100 ml"], delta: { "100 ml": 250 } }, featured: true }),
      P("lumiere-rose-blanche", L("Rose Blanche", "روز بلانش"), L("A soft white-rose floral with musk.", "عطر زهري ناعم بالورد الأبيض والمسك."), 1, "0", 489, "bottle", "#f9a8d4", { "scent-family": ["Floral", "Musk"], concentration: "Eau de Parfum", gender: "Women", "top-notes": L("Pear, bergamot", "إجاص، برغموت"), "heart-notes": L("White rose, peony", "ورد أبيض، فاوانيا"), "base-notes": L("White musk", "مسك أبيض"), longevity: "Long (6–8 h)" }, { variants: { attr: "volume", values: ["50 ml", "100 ml"], delta: { "100 ml": 180 } } }),
      P("lumiere-citrus-homme", L("Citrus Homme", "سيتروس أوم"), L("Fresh citrus and vetiver for daytime.", "حمضيات منعشة مع نجيل الهند للنهار."), 1, "0", 399, "bottle", "#60a5fa", { volume: "100 ml", "scent-family": ["Citrus"], concentration: "Eau de Toilette", gender: "Men", "top-notes": L("Lemon, grapefruit", "ليمون، جريب فروت"), "heart-notes": L("Lavender", "خزامى"), "base-notes": L("Vetiver", "نجيل الهند"), longevity: "Moderate (4–6 h)" }),
      P("ambar-white-musk-oil", L("White musk perfume oil", "دهن المسك الأبيض"), L("Alcohol-free, soft and clean.", "خالٍ من الكحول وناعم ونظيف."), 2, "1", 159, "bottle", "#fef3c7", { "scent-family": ["Musk"], concentration: "Perfume oil", gender: "Unisex", longevity: "Long (6–8 h)" }),
      P("majd-cambodi-bakhoor", L("Cambodi bakhoor", "بخور كمبودي"), L("Hand-pressed bakhoor for majlis and home.", "بخور مضغوط يدوياً للمجلس والمنزل."), 0, "2", 249, "jar", "#78350f", { "scent-family": ["Oud", "Oriental"] }),
      P("ambar-gift-trio", L("Signature gift trio", "طقم الهدايا الثلاثي"), L("Three travel sprays in a gift box.", "ثلاثة عطور للسفر في علبة هدايا."), 2, "3", 599, "gift", "#b45309", { "scent-family": ["Oriental", "Floral"], concentration: "Eau de Parfum", gender: "Unisex" }, { sale: 499, featured: true }),
    ],
  },
  jewelry: {
    version: 1,
    brands: [{ ref: "lulu", name: "Lulu", color: "#64748b" }, { ref: "dahab", name: "Dahab", color: "#a16207" }, { ref: "zamrud", name: "Zamrud", color: "#047857" }],
    categoryArt: ["ring", "necklace", "necklace", "ring"],
    hero: { heading: L("Gold that tells your story", "ذهب يحكي قصتك"), body: L("21K and 18K pieces with certificates of authenticity.", "قطع عيار 21 و18 مع شهادات أصالة."), art: "ring", color: "#eab308" },
    products: [
      P("dahab-21k-band", L("21K classic band", "خاتم ذهب 21 كلاسيكي"), L("Polished band in solid 21K gold.", "خاتم مصقول من ذهب عيار 21 صافٍ."), 1, "0", 1899, "ring", "#eab308", { metal: "Yellow gold", karat: "21K", stone: "None", weight: L("4.2 g", "4.2 غ") }, { variants: { attr: "ring-size", values: ["6", "7", "8"] }, featured: true }),
      P("lulu-pearl-pendant", L("Pearl pendant", "قلادة اللؤلؤ"), L("Freshwater pearl on an 18K chain.", "لؤلؤة طبيعية على سلسلة عيار 18."), 0, "1", 1299, "necklace", "#e5e7eb", { metal: "White gold", karat: "18K", stone: "Pearl" }),
      P("zamrud-emerald-ring", L("Emerald solitaire ring", "خاتم زمرد منفرد"), L("A vivid emerald in 18K gold.", "زمردة نابضة بالحياة في ذهب عيار 18."), 2, "0", 3499, "ring", "#059669", { metal: "Yellow gold", karat: "18K", stone: "Emerald" }, { variants: { attr: "ring-size", values: ["6", "7"] } }),
      P("dahab-rope-chain", L("21K rope chain", "سلسلة حبل عيار 21"), L("Timeless twisted chain, 50 cm.", "سلسلة مجدولة خالدة بطول 50 سم."), 1, "1", 2499, "necklace", "#eab308", { metal: "Yellow gold", karat: "21K", weight: L("8.5 g", "8.5 غ") }),
      P("lulu-tennis-bracelet", L("Diamond tennis bracelet", "سوار تنس بالألماس"), L("A line of brilliant-cut diamonds.", "صف من الألماس بقطع بريليانت."), 0, "2", 4299, "necklace", "#d4d4d8", { metal: "White gold", karat: "18K", stone: "Diamond" }, { sale: 3899 }),
      P("zamrud-ruby-studs", L("Ruby stud earrings", "أقراط الياقوت"), L("Small rubies set in rose gold.", "ياقوت صغير مرصّع بالذهب الوردي."), 2, "3", 1599, "ring", "#dc2626", { metal: "Rose gold", karat: "18K", stone: "Ruby" }),
    ],
  },
  watches: {
    version: 1,
    brands: [{ ref: "meridian", name: "Meridian", color: "#0f172a" }, { ref: "sahra", name: "Sahra", color: "#9d174d" }, { ref: "pulse", name: "Pulse", color: "#111827" }],
    categoryArt: ["watch", "watch", "band"],
    hero: { heading: L("Time, beautifully kept", "وقت بأناقة"), body: L("Automatic, quartz and smart watches with official warranty.", "ساعات أوتوماتيك وكوارتز وذكية بضمان رسمي."), art: "watch", color: "#0f172a" },
    products: [
      P("meridian-diver-42", L("Meridian Diver 42", "ميريديان دايفر 42"), L("Automatic diver with ceramic bezel.", "ساعة غوص أوتوماتيكية بإطار سيراميك."), 0, "0", 1899, "watch", "#0f172a", { movement: "Automatic", "case-size": "42mm", strap: "Metal", "water-resistance": L("200 m", "200 م"), gender: "Men" }, { featured: true }),
      P("meridian-chrono-44", L("Meridian Chrono 44", "ميريديان كرونو 44"), L("Chronograph on a leather strap.", "كرونوغراف بسوار جلد."), 0, "0", 1499, "watch", "#78350f", { movement: "Quartz", "case-size": "44mm", strap: "Leather", "water-resistance": L("100 m", "100 م"), gender: "Men" }),
      P("sahra-petite-36", L("Sahra Petite 36", "صحراء بيتيت 36"), L("Slim mother-of-pearl dial.", "ميناء رفيع من الصدف."), 1, "1", 899, "watch", "#f9a8d4", { movement: "Quartz", "case-size": "36mm", strap: "Metal", "water-resistance": L("30 m", "30 م"), gender: "Women" }, { sale: 799 }),
      P("sahra-classic-40", L("Sahra Classic 40", "صحراء كلاسيك 40"), L("Automatic movement, open case back.", "حركة أوتوماتيكية وظهر مكشوف."), 1, "1", 1199, "watch", "#e7d8c3", { movement: "Automatic", "case-size": "40mm", strap: "Leather", gender: "Women" }),
      P("pulse-fit-smart", L("Pulse Fit smart watch", "ساعة بلس فِت الذكية"), L("Heart rate, sleep and GPS.", "نبض القلب والنوم وGPS."), 2, "2", 799, "watch", "#111827", { movement: "Smart", "case-size": "44mm", strap: "Rubber", "water-resistance": L("50 m", "50 م"), gender: "Unisex" }, { sale: 699, featured: true }),
      P("pulse-active-band", L("Pulse Active band", "سوار بلس أكتيف"), L("Fitness band with 14-day battery.", "سوار لياقة ببطارية 14 يوماً."), 2, "2", 299, "band", "#22c55e", { movement: "Smart", "case-size": "40mm", strap: "Rubber", gender: "Unisex" }),
    ],
  },
  furniture: {
    version: 1,
    brands: [{ ref: "dar", name: "Dar", color: "#57534e" }, { ref: "nakhla", name: "Nakhla", color: "#166534" }, { ref: "luma", name: "Luma", color: "#d97706" }],
    categoryArt: ["sofa", "sofa", "lamp", "vase"],
    hero: { heading: L("Make home your favourite place", "اجعل منزلك مكانك المفضل"), body: L("Sofas, lighting and decor with white-glove delivery.", "كنب وإضاءة وديكور مع توصيل وتركيب."), art: "sofa", color: "#9ca3af" },
    products: [
      P("dar-three-seater", L("Three-seater sofa", "كنبة ثلاثية"), L("Deep seats in soft-touch fabric.", "مقاعد عميقة بقماش ناعم."), 0, "0", 3499, "sofa", "#9ca3af", { color: "Gray", material: "Fabric", dimensions: L("220 × 90 × 85 cm", "220 × 90 × 85 سم"), room: ["Living room"], assembly: false }, { sale: 2999, featured: true }),
      P("dar-leather-armchair", L("Leather armchair", "كرسي جلد"), L("Mid-century lines in full-grain leather.", "تصميم كلاسيكي بجلد طبيعي."), 0, "0", 1899, "sofa", "#78350f", { color: "Beige", material: "Leather", dimensions: L("80 × 85 × 80 cm", "80 × 85 × 80 سم"), room: ["Living room", "Office"] }),
      P("nakhla-upholstered-bed", L("Upholstered bed frame", "سرير منجد"), L("Queen size with padded headboard.", "مقاس كوين مع لوح رأس مبطن."), 1, "1", 2799, "sofa", "#d6c4a8", { color: "Beige", material: "Fabric", room: ["Bedroom"], assembly: true }),
      P("luma-arc-floor-lamp", L("Arc floor lamp", "مصباح أرضي مقوس"), L("Warm light over your favourite chair.", "إضاءة دافئة فوق كرسيك المفضل."), 2, "2", 599, "lamp", "#f5f5f4", { color: "White", material: "Metal", room: ["Living room"] }),
      P("luma-marble-table-lamp", L("Marble table lamp", "مصباح طاولة رخام"), L("Marble base with a linen shade.", "قاعدة رخام وغطاء كتان."), 2, "2", 249, "lamp", "#d97706", { material: "Marble", room: ["Bedroom", "Office"] }),
      P("nakhla-ceramic-vase", L("Glazed ceramic vase", "مزهرية سيراميك مزججة"), L("Hand-glazed, 35 cm tall.", "مزججة يدوياً بارتفاع 35 سم."), 1, "3", 189, "vase", "#0e7490", { color: "Blue", dimensions: L("35 cm", "35 سم") }),
    ],
  },
  "home-kitchen": {
    version: 1,
    brands: [{ ref: "sahm", name: "Sahm", color: "#111827" }, { ref: "bayt", name: "Bayt", color: "#b91c1c" }, { ref: "kitchenly", name: "Kitchenly", color: "#2563eb" }],
    categoryArt: ["pot", "pot", "jar", "bottle"],
    hero: { heading: L("Cook more, clean less", "اطبخ أكثر ونظّف أقل"), body: L("Smart appliances and cookware that last.", "أجهزة ذكية وأواني تدوم."), art: "pot", color: "#b91c1c" },
    products: [
      P("sahm-air-fryer", L("Air fryer 5 L", "قلاية هوائية 5 لتر"), L("Crispy results with 80% less oil.", "نتائج مقرمشة بزيت أقل 80%."), 0, "0", 499, "pot", "#111827", { color: "Black", "kitchen-capacity": "5 L", power: L("1,700 W", "1,700 واط"), material: "Plastic" }, { sale: 429, featured: true }),
      P("sahm-steel-kettle", L("Steel kettle", "غلاية ستانلس"), L("Boils in under three minutes.", "تغلي في أقل من ثلاث دقائق."), 0, "0", 149, "pot", "#e5e7eb", { color: "Gray", "kitchen-capacity": "2 L", power: L("2,200 W", "2,200 واط"), material: "Stainless steel" }),
      P("bayt-ceramic-set", L("Ceramic cookware set (8 pcs)", "طقم أواني سيراميك (8 قطع)"), L("Non-stick, oven-safe, PFAS-free.", "غير لاصق ومناسب للفرن وخالٍ من PFAS."), 1, "1", 699, "pot", "#b91c1c", { color: "Red", material: "Ceramic" }),
      P("bayt-glass-containers", L("Glass food containers", "علب حفظ زجاجية"), L("Set of 5 with snap lids.", "طقم من 5 بأغطية محكمة."), 1, "2", 129, "jar", "#a5f3fc", { "kitchen-capacity": "1 L", material: "Glass" }),
      P("kitchenly-spin-mop", L("Spin mop & bucket", "ممسحة دوارة مع دلو"), L("Hands-free wringing.", "عصر بدون لمس."), 2, "3", 99, "can", "#2563eb", { color: "Blue", "kitchen-capacity": "10 L", material: "Plastic" }),
      P("kitchenly-surface-spray", L("Multi-surface cleaner", "منظف متعدد الأسطح"), L("Plant-based, fresh citrus scent.", "نباتي برائحة حمضيات منعشة."), 2, "3", 29, "bottle", "#22c55e", { "kitchen-capacity": "1 L" }),
    ],
  },
  grocery: {
    version: 1,
    brands: [{ ref: "alwadi", name: "Al Wadi", color: "#166534" }, { ref: "greenbasket", name: "Green Basket", color: "#65a30d" }, { ref: "sunny", name: "Sunny", color: "#f97316" }],
    categoryArt: ["produce", "box", "can", "jar"],
    hero: { heading: L("Fresh groceries, delivered today", "بقالة طازجة تصلك اليوم"), body: L("Fruit, pantry staples and drinks — order by 2 pm for same-day delivery.", "فواكه ومؤن ومشروبات — اطلب قبل 2 ظهراً للتوصيل في نفس اليوم."), art: "produce", color: "#dc2626" },
    products: [
      P("greenbasket-red-apples", L("Organic red apples", "تفاح أحمر عضوي"), L("Crisp and sweet, picked this week.", "مقرمش وحلو، مقطوف هذا الأسبوع."), 1, "0", 19, "produce", "#dc2626", { "pack-size": "1 kg", dietary: ["Organic"], origin: L("Lebanon", "لبنان"), "storage-type": "Chilled" }, { featured: true, stock: 120 }),
      P("alwadi-basmati-rice", L("Premium basmati rice", "أرز بسمتي فاخر"), L("Extra-long grain, aged for aroma.", "حبة طويلة جداً معتّقة للنكهة."), 0, "1", 59, "box", "#f59e0b", { "pack-size": "5 kg", origin: L("India", "الهند"), "storage-type": "Ambient", ingredients: L("100% basmati rice", "أرز بسمتي 100%") }, { sale: 49, stock: 80 }),
      P("alwadi-olive-oil", L("Extra virgin olive oil", "زيت زيتون بكر ممتاز"), L("Cold-pressed, first harvest.", "معصور على البارد من القطفة الأولى."), 0, "1", 69, "oil", "#65a30d", { "pack-size": "1 L", origin: L("Jordan", "الأردن"), "storage-type": "Ambient" }, { stock: 60 }),
      P("sunny-orange-juice", L("Fresh orange juice", "عصير برتقال طازج"), L("Not from concentrate, no added sugar.", "غير مركّز وبدون سكر مضاف."), 2, "2", 7, "can", "#f97316", { "pack-size": "330 ml", dietary: ["Sugar-free"], "storage-type": "Chilled", ingredients: L("Orange juice", "عصير برتقال") }, { stock: 200 }),
      P("sunny-sparkling-water", L("Sparkling water", "مياه غازية"), L("Lightly sparkling mineral water.", "مياه معدنية غازية خفيفة."), 2, "2", 3, "can", "#0ea5e9", { "pack-size": "330 ml", "storage-type": "Ambient" }, { stock: 300 }),
      P("alwadi-mixed-nuts", L("Roasted mixed nuts", "مكسرات مشكلة محمصة"), L("Almonds, cashews and pistachios.", "لوز وكاجو وفستق."), 0, "3", 39, "jar", "#a16207", { "pack-size": "500 g", allergens: ["Nuts"], "storage-type": "Ambient", ingredients: L("Almonds, cashews, pistachios, salt", "لوز، كاجو، فستق، ملح") }, { stock: 90 }),
    ],
  },
  pharmacy: {
    version: 1,
    brands: [{ ref: "vitaplus", name: "Vita+", color: "#f59e0b" }, { ref: "care", name: "Care", color: "#0d9488" }, { ref: "shifa", name: "Shifa", color: "#2563eb" }],
    categoryArt: ["pills", "bottle", "baby", "box"],
    hero: { heading: L("Everyday health, delivered", "صحتك اليومية تصلك"), body: L("Vitamins, personal care and baby essentials from licensed suppliers.", "فيتامينات وعناية شخصية ومستلزمات أطفال من موردين مرخصين."), art: "pills", color: "#0ea5e9" },
    products: [
      P("vitaplus-d3", L("Vitamin D3 1000 IU", "فيتامين د3 1000 وحدة"), L("Supports bones and immunity.", "يدعم العظام والمناعة."), 0, "0", 59, "pills", "#f59e0b", { form: "Capsules" }, { variants: { attr: "pack-count", values: ["30", "60", "90"], delta: { "60": 30, "90": 55 } }, featured: true }),
      P("vitaplus-omega-3", L("Omega-3 fish oil", "أوميغا 3 زيت السمك"), L("High-strength EPA and DHA.", "تركيز عالٍ من EPA وDHA."), 0, "0", 89, "pills", "#0ea5e9", { form: "Capsules", "pack-count": "60" }, { sale: 75 }),
      P("care-sensitive-toothpaste", L("Sensitive toothpaste", "معجون أسنان للأسنان الحساسة"), L("Long-lasting relief and enamel care.", "راحة تدوم وحماية للمينا."), 1, "1", 19, "box", "#22c55e", { form: "Cream" }),
      P("shifa-anti-colic-bottle", L("Anti-colic baby bottle", "رضاعة مضادة للمغص"), L("Vented, BPA-free, 260 ml.", "بفتحة تهوية وخالية من BPA، 260 مل."), 2, "2", 49, "baby", "#93c5fd", { "age-range": "0–12 months" }),
      P("shifa-digital-thermometer", L("Digital thermometer", "ميزان حرارة رقمي"), L("10-second reading, flexible tip.", "قراءة خلال 10 ثوانٍ بطرف مرن."), 2, "3", 79, "box", "#ef4444", {}),
      P("care-hand-sanitizer", L("Hand sanitiser spray", "بخاخ معقم لليدين"), L("70% alcohol with aloe.", "كحول 70% مع الصبار."), 1, "1", 15, "bottle", "#a7f3d0", { form: "Spray" }),
    ],
  },
  books: {
    version: 1,
    brands: [{ ref: "riwaya", name: "Riwaya Press", color: "#7c2d12" }, { ref: "qalam", name: "Dar Al Qalam", color: "#1e3a8a" }, { ref: "owl", name: "Little Owl", color: "#db2777" }],
    categoryArt: ["book", "book", "book", "book"],
    hero: { heading: L("Find your next favourite book", "اعثر على كتابك المفضل القادم"), body: L("Arabic and English titles, signed editions and stationery.", "عناوين عربية وإنجليزية وطبعات موقّعة وقرطاسية."), art: "book", color: "#7c2d12" },
    products: [
      P("riwaya-desert-stars", L("Stars over the Desert", "نجوم فوق الصحراء"), L("A family saga across three generations.", "ملحمة عائلية عبر ثلاثة أجيال."), 0, "0", 59, "book", "#7c2d12", { author: L("Sara Al-Harbi", "سارة الحربي"), language: "Arabic", pages: 320 }, { variants: { attr: "format", values: ["Paperback", "Hardcover"], delta: { Hardcover: 30 } }, featured: true }),
      P("riwaya-city-of-salt", L("The Salt City", "مدينة الملح"), L("A mystery set on the old trade routes.", "لغز على طرق التجارة القديمة."), 0, "0", 69, "book", "#1e3a8a", { author: L("Omar Haddad", "عمر حداد"), language: "Arabic", format: "Paperback", pages: 410 }),
      P("qalam-habits", L("Habits That Stick", "عادات تدوم"), L("Small changes that compound.", "تغييرات صغيرة تتراكم."), 1, "1", 55, "book", "#059669", { author: L("Lina Kareem", "لينا كريم"), language: "English", format: "Paperback", pages: 256 }, { sale: 45 }),
      P("qalam-time-mastery", L("Mastering Your Time", "إتقان الوقت"), L("Practical planning for busy people.", "تخطيط عملي للمشغولين."), 1, "1", 49, "book", "#f59e0b", { author: L("Yousef Nasser", "يوسف ناصر"), language: "Arabic", format: "Paperback", pages: 198 }),
      P("owl-alphabet-adventures", L("Alphabet Adventures", "مغامرات الحروف"), L("A picture book for early readers.", "كتاب مصور للقرّاء الصغار."), 2, "2", 35, "book", "#ec4899", { author: L("Huda Salem", "هدى سالم"), language: "Arabic", format: "Hardcover", pages: 32 }),
      P("owl-notebook-set", L("Dotted notebook set (3)", "طقم دفاتر منقطة (3)"), L("A5, 120 gsm, lay-flat binding.", "مقاس A5 وورق 120 غرام وتجليد مسطح."), 2, "3", 29, "book", "#64748b", {}),
    ],
  },
  toys: {
    version: 1,
    brands: [{ ref: "kiddo", name: "Kiddo", color: "#f59e0b" }, { ref: "bloom", name: "Bloom", color: "#16a34a" }, { ref: "playbox", name: "PlayBox", color: "#7c3aed" }],
    categoryArt: ["baby", "blocks", "ball", "box"],
    hero: { heading: L("Play, learn, grow", "العب وتعلّم وانمُ"), body: L("Safe, age-tested toys and baby essentials.", "ألعاب آمنة مختبرة حسب العمر ومستلزمات الأطفال."), art: "blocks", color: "#3b82f6" },
    products: [
      P("kiddo-baby-bottle-set", L("Baby bottle starter set", "طقم رضاعات للمولود"), L("Three bottles, two teats and a brush.", "ثلاث رضاعات وحلمتان وفرشاة."), 0, "0", 79, "baby", "#f9a8d4", { "age-range": "0–12 months" }),
      P("bloom-alphabet-blocks", L("Alphabet wooden blocks", "مكعبات الحروف الخشبية"), L("30 blocks in Arabic and English letters.", "30 مكعباً بالحروف العربية والإنجليزية."), 1, "1", 99, "blocks", "#3b82f6", { "age-range": "1–3 years", "toy-type": "Building", batteries: false }, { featured: true }),
      P("playbox-stem-robot", L("Code-a-bot STEM robot", "روبوت البرمجة التعليمي"), L("Learn coding through play.", "تعلّم البرمجة من خلال اللعب."), 2, "1", 249, "blocks", "#8b5cf6", { "age-range": "6–12 years", "toy-type": "Educational", batteries: true }, { sale: 219 }),
      P("bloom-kick-ball", L("Soft kick ball", "كرة ركل ناعمة"), L("Lightweight and safe for the garden.", "خفيفة وآمنة للحديقة."), 1, "2", 49, "ball", "#ef4444", { "age-range": "3–6 years", "toy-type": "Outdoor" }),
      P("playbox-500-puzzle", L("500-piece city puzzle", "أحجية المدينة 500 قطعة"), L("A family puzzle evening.", "أمسية أحجيات للعائلة."), 2, "3", 59, "box", "#0ea5e9", { "age-range": "12+ years", "toy-type": "Puzzles" }),
      P("kiddo-plush-bunny", L("Plush bunny", "أرنب محشو"), L("Super-soft, machine-washable.", "ناعم جداً وقابل للغسل."), 0, "0", 69, "gift", "#fbbf24", { "age-range": "0–12 months", "toy-type": "Dolls" }),
    ],
  },
  sports: {
    version: 1,
    brands: [{ ref: "stride", name: "Stride", color: "#2563eb" }, { ref: "ironline", name: "Ironline", color: "#ef4444" }, { ref: "fuel", name: "Fuel", color: "#16a34a" }],
    categoryArt: ["tshirt", "dumbbell", "jar"],
    hero: { heading: L("Train harder, recover faster", "تمرّن بقوة وتعافَ أسرع"), body: L("Sportswear, home-gym gear and supplements.", "ملابس رياضية ومعدات منزلية ومكملات."), art: "dumbbell", color: "#ef4444" },
    products: [
      P("stride-dry-fit-tee", L("Dry-fit training tee", "تيشيرت تمرين سريع الجفاف"), L("Sweat-wicking and ultra-light.", "يطرد العرق وخفيف جداً."), 0, "0", 119, "tshirt", "#0f172a", { color: "Black", sport: ["Running", "Gym"], gender: "Men" }, { variants: { attr: "size", values: ["S", "M", "L", "XL"] }, featured: true }),
      P("stride-training-leggings", L("Training leggings", "ليقنز تمرين"), L("High-rise, squat-proof fabric.", "خصر عالٍ وقماش معتم."), 0, "0", 149, "tshirt", "#831843", { color: "Pink", sport: ["Gym", "Running"], gender: "Women" }, { variants: { attr: "size", values: ["XS", "S", "M", "L"] } }),
      P("ironline-dumbbells-10kg", L("Hex dumbbells 2 × 10 kg", "دمبلز سداسية 2 × 10 كغ"), L("Rubber-coated, floor-friendly.", "مغطاة بالمطاط وآمنة للأرضيات."), 1, "1", 249, "dumbbell", "#ef4444", { sport: ["Gym"] }),
      P("ironline-padel-balls", L("Padel balls (3)", "كرات بادل (3)"), L("Tournament-grade pressure.", "ضغط بمستوى البطولات."), 1, "1", 39, "ball", "#facc15", { sport: ["Padel"] }),
      P("fuel-whey-protein", L("Whey protein 2 kg", "بروتين واي 2 كغ"), L("24 g protein per scoop, chocolate.", "24 غ بروتين لكل مغرفة، شوكولاتة."), 2, "2", 249, "jar", "#1f2937", { sport: ["Gym"] }, { sale: 219 }),
      P("fuel-shaker", L("Shaker bottle", "زجاجة خلط"), L("Leak-proof, 700 ml.", "مانعة للتسرب، 700 مل."), 2, "2", 29, "can", "#22c55e", { color: "Green" }),
    ],
  },
  automotive: {
    version: 1,
    brands: [{ ref: "torque", name: "Torque", color: "#ef4444" }, { ref: "roadmax", name: "RoadMax", color: "#18181b" }, { ref: "lumina", name: "Lumina", color: "#0ea5e9" }],
    categoryArt: ["box", "tire", "lamp", "oil"],
    hero: { heading: L("The right part, the first time", "القطعة الصحيحة من أول مرة"), body: L("Check compatibility by make and year before you buy.", "تحقق من التوافق حسب الشركة وسنة الصنع قبل الشراء."), art: "tire", color: "#a1a1aa" },
    products: [
      P("roadmax-all-season", L("All-season tyre 205/55 R16", "إطار لكل المواسم 205/55 R16"), L("Quiet ride with strong wet grip.", "قيادة هادئة وثبات قوي على الطرق المبللة."), 1, "1", 389, "tire", "#a1a1aa", { make: ["Toyota", "Hyundai", "Nissan"], "part-number": L("205/55 R16", "205/55 R16"), condition: "New" }, { featured: true }),
      P("torque-5w30", L("Synthetic oil 5W-30 (4 L)", "زيت صناعي 5W-30 (4 لتر)"), L("Full synthetic for modern engines.", "صناعي بالكامل للمحركات الحديثة."), 0, "3", 149, "oil", "#f59e0b", { make: ["Toyota", "Lexus", "Nissan"], condition: "New" }, { sale: 129 }),
      P("torque-brake-pads", L("Ceramic brake pads (front)", "فحمات فرامل سيراميك (أمامي)"), L("Low dust, low noise.", "غبار أقل وضوضاء أقل."), 0, "0", 199, "box", "#ef4444", { make: ["Toyota"], "model-year": L("2018–2024", "2018–2024"), "part-number": L("BP-2045", "BP-2045"), condition: "New" }),
      P("lumina-led-headlight", L("LED headlight bulbs (pair)", "لمبات LED أمامية (زوج)"), L("6,000 K bright white, plug-and-play.", "إضاءة بيضاء 6,000 كلفن وتركيب سهل."), 2, "2", 249, "lamp", "#e5e7eb", { make: ["Hyundai", "Ford"], condition: "New" }),
      P("torque-air-filter", L("Engine air filter", "فلتر هواء المحرك"), L("OEM-grade filtration.", "ترشيح بجودة الوكالة."), 0, "0", 79, "box", "#3f3f46", { make: ["Toyota", "Lexus"], condition: "New" }),
      P("lumina-dash-cam", L("Dash camera 2K", "كاميرا داش 2K"), L("Night vision and parking mode.", "رؤية ليلية ووضع المراقبة أثناء الوقوف."), 2, "2", 349, "powerbank", "#111827", { condition: "New" }),
    ],
  },
  pets: {
    version: 1,
    brands: [{ ref: "whisker", name: "Whisker", color: "#f97316" }, { ref: "fetch", name: "Fetch", color: "#2563eb" }, { ref: "paws", name: "Paws", color: "#0d9488" }],
    categoryArt: ["petfood", "petfood", "petfood"],
    hero: { heading: L("Everything your pet loves", "كل ما يحبه حيوانك الأليف"), body: L("Food, treats, toys and grooming — delivered to your door.", "طعام ومكافآت وألعاب وعناية — حتى باب منزلك."), art: "petfood", color: "#f97316" },
    products: [
      P("whisker-adult-cat-food", L("Adult cat food — chicken", "طعام قطط بالغة — دجاج"), L("Complete nutrition with real chicken.", "تغذية متكاملة بالدجاج الحقيقي."), 0, "0", 79, "petfood", "#f97316", { "pet-type": ["Cat"], "life-stage": "Adult", "pet-product": "Food", ingredients: L("Chicken, rice, fish oil", "دجاج، أرز، زيت سمك") }, { variants: { attr: "pack-size", values: ["1 kg", "2 kg", "10 kg"], delta: { "2 kg": 50, "10 kg": 260 } }, featured: true }),
      P("whisker-cat-treats", L("Crunchy cat treats", "مكافآت قطط مقرمشة"), L("Dental care in every bite.", "عناية بالأسنان في كل قطعة."), 0, "0", 29, "petfood", "#a855f7", { "pet-type": ["Cat"], "pet-product": "Treats" }),
      P("fetch-puppy-food", L("Puppy food — lamb", "طعام جراء — لحم ضأن"), L("For healthy growth and strong bones.", "لنمو صحي وعظام قوية."), 1, "1", 159, "petfood", "#2563eb", { "pet-type": ["Dog"], "life-stage": "Young", "pack-size": "2 kg", "pet-product": "Food" }, { sale: 139 }),
      P("fetch-rope-toy", L("Tug rope toy", "لعبة حبل للشد"), L("Tough cotton rope for active dogs.", "حبل قطني متين للكلاب النشيطة."), 1, "1", 35, "ball", "#ef4444", { "pet-type": ["Dog"], "pet-product": "Toys" }),
      P("paws-grooming-brush", L("Self-cleaning grooming brush", "فرشاة تمشيط ذاتية التنظيف"), L("Removes loose fur in minutes.", "تزيل الشعر المتساقط في دقائق."), 2, "1", 49, "box", "#14b8a6", { "pet-type": ["Cat", "Dog"], "pet-product": "Grooming" }),
      P("paws-bird-seed", L("Bird seed mix", "خليط بذور للطيور"), L("For canaries and finches.", "للكناري والعصافير."), 2, "2", 39, "petfood", "#84cc16", { "pet-type": ["Bird"], "pack-size": "1 kg", "pet-product": "Food" }),
    ],
  },
  "flowers-gifts": {
    version: 1,
    brands: [{ ref: "roseco", name: "Rose & Co", color: "#e11d48" }, { ref: "hadiya", name: "Hadiya", color: "#059669" }, { ref: "choco", name: "Choco Lane", color: "#78350f" }],
    categoryArt: ["bouquet", "gift", "box", "ball"],
    hero: { heading: L("Gifts that arrive today", "هدايا تصل اليوم"), body: L("Fresh bouquets and curated boxes with same-day delivery.", "باقات طازجة وصناديق مختارة مع التوصيل في نفس اليوم."), art: "bouquet", color: "#e11d48" },
    products: [
      P("roseco-red-bouquet", L("Red roses bouquet", "باقة ورد أحمر"), L("Twenty-one long-stem roses.", "واحد وعشرون وردة طويلة الساق."), 0, "0", 299, "bouquet", "#e11d48", { occasion: ["Birthday", "Wedding"], arrangement: "Bouquet", color: "Red" }, { featured: true }),
      P("roseco-pastel-bouquet", L("Pastel garden bouquet", "باقة الحديقة الهادئة"), L("Peonies and spray roses.", "فاوانيا وورد صغير."), 0, "0", 249, "bouquet", "#f9a8d4", { occasion: ["New baby"], arrangement: "Bouquet", color: "Pink" }),
      P("hadiya-eid-box", L("Eid gift box", "صندوق هدايا العيد"), L("Dates, sweets and a card.", "تمر وحلويات وبطاقة إهداء."), 1, "1", 349, "gift", "#059669", { occasion: ["Eid"], arrangement: "Box" }, { sale: 299 }),
      P("hadiya-graduation-box", L("Graduation gift box", "صندوق هدايا التخرج"), L("Flowers, chocolates and a keepsake.", "ورد وشوكولاتة وتذكار."), 1, "1", 279, "gift", "#1e3a8a", { occasion: ["Graduation"], arrangement: "Box" }),
      P("choco-premium-box", L("Premium chocolate box (24)", "علبة شوكولاتة فاخرة (24)"), L("Hand-made pralines.", "برالين مصنوع يدوياً."), 2, "2", 189, "box", "#78350f", { occasion: ["Birthday"], arrangement: "Box" }),
      P("hadiya-balloon-bundle", L("Balloon bundle", "باقة بالونات"), L("Five helium balloons with ribbon.", "خمس بالونات هيليوم مع شريط."), 1, "3", 99, "ball", "#60a5fa", { occasion: ["Birthday", "New baby"], color: "Blue" }),
    ],
  },
  digital: {
    version: 1,
    brands: [{ ref: "cardhub", name: "CardHub", color: "#1d4ed8" }, { ref: "gamevault", name: "GameVault", color: "#16a34a" }, { ref: "softkey", name: "SoftKey", color: "#ea580c" }],
    categoryArt: ["card", "gamepad", "card"],
    hero: { heading: L("Codes delivered in seconds", "أكواد تصلك خلال ثوانٍ"), body: L("Gift cards, game credit and software licences — instant email delivery.", "بطاقات هدايا ورصيد ألعاب وتراخيص برامج — تسليم فوري بالبريد."), art: "card", color: "#1d4ed8" },
    products: [
      P("cardhub-psn", L("PlayStation Store card", "بطاقة متجر بلايستيشن"), L("Top up your wallet instantly.", "اشحن محفظتك فوراً."), 0, "0", 50, "card", "#1d4ed8", { platform: "PlayStation", region: "Saudi Arabia", "delivery-type": "Instant code" }, { variants: { attr: "denomination", values: ["50 SAR", "100 SAR", "200 SAR"], delta: { "100 SAR": 50, "200 SAR": 150 } }, featured: true, stock: 500 }),
      P("cardhub-itunes", L("App Store & iTunes card", "بطاقة آب ستور وآيتونز"), L("Apps, games, music and more.", "تطبيقات وألعاب وموسيقى وأكثر."), 0, "0", 100, "card", "#ec4899", { platform: "iTunes", region: "Saudi Arabia", "delivery-type": "Instant code", denomination: "100 SAR" }, { stock: 500 }),
      P("gamevault-xbox", L("Xbox credit", "رصيد إكس بوكس"), L("Games, add-ons and Game Pass.", "ألعاب وإضافات واشتراك Game Pass."), 1, "1", 100, "card", "#16a34a", { platform: "Xbox", region: "UAE", "delivery-type": "Instant code", denomination: "100 SAR" }, { stock: 500 }),
      P("gamevault-steam", L("Steam wallet code", "كود محفظة ستيم"), L("Works on any Steam account.", "يعمل على أي حساب ستيم."), 1, "1", 200, "card", "#0f172a", { platform: "Steam", region: "Global", "delivery-type": "Instant code", denomination: "200 SAR" }, { stock: 500 }),
      P("softkey-office", L("Office suite — 1-year licence", "حزمة أوفيس — ترخيص سنة"), L("For 1 PC or Mac, email delivery.", "لجهاز كمبيوتر أو ماك واحد، تسليم بالبريد."), 2, "2", 399, "card", "#ea580c", { region: "Global", "delivery-type": "Email" }, { sale: 349, stock: 500 }),
      P("softkey-antivirus", L("Antivirus — 3 devices", "مضاد فيروسات — 3 أجهزة"), L("One year of protection.", "حماية لمدة سنة."), 2, "2", 149, "card", "#10b981", { region: "Global", "delivery-type": "Email" }, { stock: 500 }),
    ],
  },
  restaurant: {
    version: 1,
    brands: [{ ref: "house", name: "House Kitchen", color: "#b45309" }, { ref: "cafe", name: "Corner Café", color: "#78350f" }, { ref: "bakery", name: "Sweet Bakery", color: "#db2777" }],
    categoryArt: ["plate", "cup", "plate"],
    hero: { heading: L("Hot food, at your door", "أكل ساخن حتى بابك"), body: L("Order mains, drinks and desserts for delivery or pickup.", "اطلب الأطباق والمشروبات والحلويات للتوصيل أو الاستلام."), art: "plate", color: "#f59e0b" },
    products: [
      P("house-chicken-kabsa", L("Chicken kabsa", "كبسة دجاج"), L("Spiced rice with roast chicken and salad.", "أرز متبّل مع دجاج مشوي وسلطة."), 0, "0", 45, "plate", "#f59e0b", { spice: "Medium", calories: 780 }, { variants: { attr: "portion", values: ["Small", "Medium", "Large"], delta: { Medium: 10, Large: 20 } }, featured: true, stock: 999 }),
      P("house-grilled-halloumi", L("Grilled halloumi plate", "طبق حلومي مشوي"), L("With za'atar bread and greens.", "مع خبز بالزعتر وخضار."), 0, "0", 32, "plate", "#84cc16", { spice: "Mild", dietary: ["Vegetarian"], calories: 520 }, { stock: 999 }),
      P("cafe-spanish-latte", L("Spanish latte", "سبانش لاتيه"), L("Espresso, milk and condensed milk.", "إسبريسو وحليب وحليب مكثف."), 1, "1", 18, "cup", "#a16207", { calories: 210 }, { variants: { attr: "portion", values: ["Small", "Medium", "Large"], delta: { Medium: 3, Large: 6 } }, stock: 999 }),
      P("cafe-lemon-mint", L("Fresh lemon & mint", "ليمون ونعناع طازج"), L("Blended to order.", "يُحضّر عند الطلب."), 1, "1", 15, "cup", "#65a30d", { dietary: ["Healthy"], calories: 120 }, { stock: 999 }),
      P("bakery-kunafa", L("Cream kunafa", "كنافة بالقشطة"), L("Crispy, warm and freshly baked.", "مقرمشة ودافئة ومخبوزة طازجة."), 2, "2", 28, "plate", "#f97316", { calories: 450 }, { sale: 24, stock: 999 }),
      P("bakery-date-cake", L("Date cake slice", "شريحة كيك التمر"), L("Sticky date sponge with caramel.", "كيك التمر الطري مع الكراميل."), 2, "2", 22, "plate", "#78350f", { calories: 380 }, { stock: 999 }),
    ],
  },
  handmade: {
    version: 1,
    brands: [{ ref: "fikhar", name: "Fikhar", color: "#c2410c" }, { ref: "sadustudio", name: "Sadu Studio", color: "#b91c1c" }, { ref: "naqsh", name: "Naqsh", color: "#92400e" }],
    categoryArt: ["vase", "bag", "gift"],
    hero: { heading: L("Made by hand, made to keep", "صُنع باليد ليبقى"), body: L("Pottery, weaving and woodwork by local makers.", "فخار ونسيج وأعمال خشبية من حرفيين محليين."), art: "vase", color: "#c2410c" },
    products: [
      P("fikhar-clay-vase", L("Terracotta vase", "مزهرية فخار"), L("Wheel-thrown and kiln-fired.", "مشكّلة على الدولاب ومحروقة في الفرن."), 0, "0", 159, "vase", "#c2410c", { material: "Clay", dimensions: L("30 cm", "30 سم") }, { featured: true }),
      P("sadu-woven-cushion", L("Sadu woven cushion", "وسادة سدو منسوجة"), L("Traditional Sadu patterns in wool.", "نقوش السدو التقليدية من الصوف."), 1, "0", 129, "bag", "#b91c1c", { color: "Red", material: "Wool" }),
      P("naqsh-wooden-tray", L("Engraved wooden tray", "صينية خشبية منقوشة"), L("Personalise it with a name.", "خصّصها بالاسم."), 2, "0", 189, "box", "#92400e", { material: "Wood", personalisable: true }),
      P("sadu-leather-wallet", L("Hand-stitched wallet", "محفظة مخيطة يدوياً"), L("Vegetable-tanned leather.", "جلد مدبوغ نباتياً."), 1, "1", 149, "bag", "#78350f", { material: "Leather", personalisable: true }),
      P("naqsh-resin-keychain", L("Resin keychain", "ميدالية ريزن"), L("Each one is unique.", "كل قطعة فريدة."), 2, "1", 39, "ring", "#0ea5e9", { material: "Resin" }),
      P("fikhar-gift-set", L("Coffee cup gift set", "طقم فناجين هدية"), L("Six hand-glazed cups.", "ستة فناجين مزججة يدوياً."), 0, "2", 249, "gift", "#c2410c", { material: "Clay" }, { sale: 219 }),
    ],
  },
  optics: {
    version: 1,
    brands: [{ ref: "visio", name: "Visio", color: "#111827" }, { ref: "mirage", name: "Mirage", color: "#ca8a04" }, { ref: "clara", name: "Clara", color: "#0ea5e9" }],
    categoryArt: ["glasses", "glasses", "bottle"],
    hero: { heading: L("See and be seen", "رؤية واضحة وإطلالة مميزة"), body: L("Polarised sunglasses and prescription frames.", "نظارات شمسية مستقطبة وإطارات طبية."), art: "glasses", color: "#ca8a04" },
    products: [
      P("mirage-aviator", L("Classic aviator", "نظارة طيار كلاسيكية"), L("Polarised lenses, gold frame.", "عدسات مستقطبة وإطار ذهبي."), 1, "0", 599, "glasses", "#ca8a04", { "frame-shape": "Aviator", "lens-type": "Polarised", gender: "Unisex" }, { featured: true }),
      P("mirage-cat-eye", L("Cat-eye sunglasses", "نظارة شمسية عين القطة"), L("Bold acetate with UV400.", "أسيتات جريئة مع حماية UV400."), 1, "0", 549, "glasses", "#be185d", { "frame-shape": "Cat-eye", "lens-type": "Polarised", gender: "Women", color: "Pink" }, { sale: 479 }),
      P("visio-round-frames", L("Round blue-light frames", "إطار دائري لحجب الضوء الأزرق"), L("Screen-ready lenses included.", "عدسات مناسبة للشاشات مرفقة."), 0, "1", 449, "glasses", "#111827", { "frame-shape": "Round", "lens-type": "Blue-light", gender: "Unisex", color: "Black" }),
      P("visio-square-frames", L("Square prescription frames", "إطار طبي مربع"), L("Lightweight titanium.", "تيتانيوم خفيف."), 0, "1", 399, "glasses", "#1e3a8a", { "frame-shape": "Square", "lens-type": "Prescription", gender: "Men", color: "Blue" }),
      P("clara-daily-lenses", L("Daily contact lenses (30)", "عدسات لاصقة يومية (30)"), L("Breathable and comfortable all day.", "تسمح بمرور الهواء ومريحة طوال اليوم."), 2, "2", 129, "box", "#0ea5e9", {}),
      P("clara-lens-solution", L("Lens solution 360 ml", "محلول العدسات 360 مل"), L("Cleans, rinses and stores.", "ينظف ويشطف ويحفظ."), 2, "2", 39, "bottle", "#93c5fd", {}),
    ],
  },
  tools: {
    version: 1,
    brands: [{ ref: "forge", name: "Forge", color: "#f59e0b" }, { ref: "brick", name: "Brick", color: "#3f3f46" }, { ref: "tekno", name: "Tekno", color: "#16a34a" }],
    categoryArt: ["drill", "wrench", "wrench", "box"],
    hero: { heading: L("Built for the job", "مصممة للعمل الجاد"), body: L("Cordless power tools, hand tools and safety gear.", "عدد كهربائية لاسلكية وعدد يدوية ومعدات سلامة."), art: "drill", color: "#f59e0b" },
    products: [
      P("forge-cordless-drill", L("18V cordless drill", "دريل لاسلكي 18 فولت"), L("Two batteries and a fast charger.", "بطاريتان وشاحن سريع."), 0, "0", 549, "drill", "#f59e0b", { "power-source": "Cordless", voltage: "18V", "tool-type": "Drill", weight: L("1.6 kg", "1.6 كغ") }, { sale: 479, featured: true }),
      P("forge-angle-grinder", L("Angle grinder 900W", "صاروخ تجليخ 900 واط"), L("115 mm disc, soft start.", "قرص 115 مم وتشغيل ناعم."), 0, "0", 399, "drill", "#ef4444", { "power-source": "Corded", voltage: "220V", "tool-type": "Grinder" }),
      P("brick-wrench-set", L("Combination wrench set (12)", "طقم مفاتيح مركبة (12)"), L("Chrome-vanadium steel.", "فولاذ كروم فاناديوم."), 1, "1", 199, "wrench", "#a1a1aa", { "power-source": "Manual", "tool-type": "Wrench set", material: "Steel" }),
      P("brick-laser-measure", L("Laser distance meter 50 m", "جهاز قياس ليزر 50 م"), L("Accurate to ±2 mm.", "دقة ±2 مم."), 1, "1", 249, "box", "#facc15", { "power-source": "Cordless", "tool-type": "Measuring" }),
      P("tekno-garden-shears", L("Garden pruning shears", "مقص تقليم الحديقة"), L("Sharp bypass blades.", "شفرات حادة."), 2, "2", 89, "wrench", "#16a34a", { "power-source": "Manual", material: "Steel" }),
      P("tekno-safety-helmet", L("Safety helmet", "خوذة سلامة"), L("Adjustable, vented shell.", "قابلة للتعديل مع فتحات تهوية."), 2, "3", 69, "box", "#f97316", { material: "Plastic" }),
    ],
  },
  marketplace: {
    version: 1,
    brands: [{ ref: "nova", name: "Nova", color: "#4f46e5" }, { ref: "layal", name: "Layal", color: "#111111" }, { ref: "dar", name: "Dar", color: "#57534e" }],
    categoryArt: ["phone", "tshirt", "sofa", "bottle", "dumbbell", "blocks"],
    hero: { heading: L("Everything you need, in one place", "كل ما تحتاجه في مكان واحد"), body: L("Thousands of products across every department.", "آلاف المنتجات في جميع الأقسام."), art: "gift", color: "#f59e0b" },
    products: [
      P("nova-wireless-earbuds", L("Wireless earbuds", "سماعات لاسلكية"), L("24-hour battery with case.", "بطارية 24 ساعة مع العلبة."), 0, "0", 249, "earbuds", "#f8fafc", { color: "White", condition: "New" }, { sale: 199, featured: true }),
      P("layal-everyday-tote", L("Everyday tote", "حقيبة يومية"), L("Fits a laptop and more.", "تتسع للابتوب وأكثر."), 1, "1", 199, "bag", "#b45309", { color: "Beige", condition: "New" }),
      P("dar-table-lamp", L("Table lamp", "مصباح طاولة"), L("Warm, dimmable light.", "إضاءة دافئة قابلة للتعتيم."), 2, "2", 179, "lamp", "#e7d8c3", { color: "Beige", condition: "New" }),
      P("glow-face-serum", L("Glow face serum", "سيروم النضارة"), L("Vitamin C for brighter skin.", "فيتامين سي لبشرة أكثر إشراقاً."), 1, "3", 129, "bottle", "#fda4af", { condition: "New" }),
      P("adjustable-dumbbell", L("Adjustable dumbbell 24 kg", "دمبل قابل للتعديل 24 كغ"), L("Fifteen weights in one.", "خمسة عشر وزناً في واحد."), 2, "4", 799, "dumbbell", "#8b5cf6", { condition: "New", weight: L("24 kg", "24 كغ") }, { featured: true }),
      P("building-blocks-500", L("Building blocks (500)", "مكعبات بناء (500)"), L("Endless creative builds.", "إبداع بلا حدود."), 0, "5", 99, "blocks", "#3b82f6", { condition: "New" }),
    ],
  },
};

export const templateFor = (key: string): StoreTemplate | undefined => STORE_TEMPLATES[key];
export const TEMPLATE_STATS = (key: string) => {
  const t = STORE_TEMPLATES[key];
  return t ? { brands: t.brands.length, products: t.products.length, version: t.version } : { brands: 0, products: 0, version: 0 };
};

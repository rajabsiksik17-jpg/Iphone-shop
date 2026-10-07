import { PRIVACY_PAGE, TERMS_PAGE } from "./legal-content";
/** Demo/starter content. Legal texts are starting templates — have them reviewed for your business. */
const L = (en: string, ar: string) => ({ en, ar });

export const ANNOUNCEMENTS = [
  { text: L("Free delivery across Saudi Arabia on orders over 299 SAR", "توصيل مجاني لجميع مناطق المملكة للطلبات فوق 299 ريال"), icon: "Truck", url: "/shipping-policy" },
  { text: L("iPhone 17 Pro is here — order today, delivered tomorrow in Riyadh", "وصل آيفون 17 برو — اطلب اليوم واستلم غداً في الرياض"), icon: "Sparkles", url: "/product/iphone-17-pro" },
  { text: L("Genuine products with official local warranty", "منتجات أصلية مع كفالة محلية رسمية"), icon: "ShieldCheck" },
  { text: L("Pay cash on delivery, by mada card or bank transfer", "ادفع نقداً عند الاستلام أو ببطاقة مدى أو بالتحويل البنكي"), icon: "CreditCard" },
  { text: L("14-day hassle-free returns", "إرجاع سهل خلال 14 يوماً"), icon: "RotateCcw", url: "/refund-policy" },
];

export const FAQ_CATEGORIES = [
  { slug: "orders", name: L("Orders & delivery", "الطلبات والتوصيل") },
  { slug: "products", name: L("Products & warranty", "المنتجات والكفالة") },
  { slug: "payments", name: L("Payments", "الدفع") },
];

export const FAQS = [
  { cat: "orders", q: L("How long does delivery take?", "كم يستغرق التوصيل؟"), a: L("Orders in Riyadh, Jeddah and Dammam placed before 4 pm are usually delivered the next working day. Other cities take 2–5 working days. You'll get tracking details by email as soon as your order ships.", "عادةً ما تصل الطلبات في الرياض وجدة والدمام قبل الساعة 4 مساءً في يوم العمل التالي، وتستغرق باقي المدن من 2 إلى 5 أيام عمل. ستصلك تفاصيل التتبع بالبريد فور شحن طلبك.") },
  { cat: "orders", q: L("Can I change or cancel my order?", "هل يمكنني تعديل أو إلغاء طلبي؟"), a: L("Yes — as long as it hasn't shipped. Start a live chat or contact us with your order number and we'll update it.", "نعم — طالما لم يتم شحنه بعد. ابدأ محادثة مباشرة أو تواصل معنا مع رقم الطلب وسنقوم بتعديله.") },
  { cat: "orders", q: L("Do you deliver outside Saudi Arabia?", "هل توصلون خارج المملكة؟"), a: L("We ship to all GCC countries and selected international destinations. Shipping options and costs are shown at checkout once you enter your address.", "نشحن إلى دول الخليج ووجهات دولية مختارة. تظهر خيارات وتكاليف الشحن عند إدخال العنوان في صفحة الدفع.") },
  { cat: "products", q: L("Are your products genuine?", "هل منتجاتكم أصلية؟"), a: L("Always. Every device is sourced from official distributors and comes sealed with the manufacturer's local warranty.", "دائماً. يتم توريد كل جهاز من الموزعين الرسميين ويأتي مغلقاً مع كفالة الشركة المصنعة المحلية.") },
  { cat: "products", q: L("How does the warranty work?", "كيف تعمل الكفالة؟"), a: L("Warranty is provided by the brand's authorised service centres in Saudi Arabia. Keep your order confirmation — it's your proof of purchase. We're happy to help you arrange service.", "تُقدَّم الكفالة من مراكز الصيانة المعتمدة للعلامة في المملكة. احتفظ بتأكيد الطلب فهو إثبات الشراء، ويسعدنا مساعدتك في ترتيب الصيانة.") },
  { cat: "payments", q: L("Which payment methods do you accept?", "ما طرق الدفع المتاحة؟"), a: L("Cash on delivery, bank transfer, and — when enabled — card payments through a secure hosted checkout. We never see or store your card details.", "الدفع عند الاستلام، والتحويل البنكي، والدفع بالبطاقة عند تفعيله عبر صفحة دفع آمنة. لا نطّلع على بيانات بطاقتك ولا نخزّنها.") },
  { cat: "payments", q: L("Can I pay in instalments?", "هل يمكنني الدفع بالتقسيط؟"), a: L("Instalment plans depend on your bank's card programme. Contact us before ordering and we'll tell you what's available.", "تعتمد خطط التقسيط على برنامج بطاقة البنك الخاص بك. تواصل معنا قبل الطلب لنخبرك بالخيارات المتاحة.") },
];

const legal = (titleEn: string, titleAr: string, en: string, ar: string) => ({ title: L(titleEn, titleAr), body: L(en, ar) });

export const LEGAL_PAGES: Record<string, { title: { en: string; ar: string }; body: { en: string; ar: string }; excerpt?: { en: string; ar: string } }> = {
  "privacy-policy": PRIVACY_PAGE,
  "terms-and-conditions": TERMS_PAGE,
  "refund-policy": legal(
    "Refund & Returns Policy",
    "سياسة الإرجاع والاسترداد",
    `<p>We want you to love what you buy. If something isn't right, you can return it within <strong>14 days</strong> of delivery.</p><h2>Conditions</h2><ul><li>Unopened items in original packaging: full refund.</li><li>Opened devices: accepted if defective (handled under warranty) or as required by law.</li><li>Hygiene items (earbuds) can be returned only if sealed.</li></ul><h2>How to return</h2><p>Contact us with your order number. We'll arrange a pickup from your address or tell you where to send the item.</p><h2>Refund timing</h2><p>Refunds are issued to the original payment method within 5 working days of receiving the item. Card refunds may take a few extra days to appear.</p>`,
    `<p>نريدك أن تحب ما تشتريه. إذا لم يكن المنتج مناسباً يمكنك إرجاعه خلال <strong>14 يوماً</strong> من الاستلام.</p><h2>الشروط</h2><ul><li>المنتجات غير المفتوحة بالتغليف الأصلي: استرداد كامل.</li><li>الأجهزة المفتوحة: تُقبل في حال وجود عيب (ضمن الكفالة) أو وفق ما يقتضيه القانون.</li><li>السماعات تُرجع فقط إذا كانت مغلقة.</li></ul><h2>طريقة الإرجاع</h2><p>تواصل معنا مع رقم الطلب وسنرتب الاستلام من عنوانك أو نخبرك بمكان الإرسال.</p><h2>مدة الاسترداد</h2><p>يتم الاسترداد لوسيلة الدفع الأصلية خلال 5 أيام عمل من استلام المنتج.</p>`,
  ),
  "shipping-policy": legal(
    "Shipping Policy",
    "سياسة الشحن",
    `<h2>Saudi Arabia</h2><ul><li><strong>Standard delivery:</strong> 25 SAR, free on orders over 299 SAR. 2–5 working days.</li><li><strong>Express (Riyadh, Jeddah, Dammam):</strong> 45 SAR, next working day for orders before 4 pm.</li><li><strong>Store pickup:</strong> free.</li></ul><h2>GCC & international</h2><p>Rates and delivery estimates are calculated at checkout. Duties and import taxes may apply and are the recipient's responsibility.</p><h2>Tracking</h2><p>You'll receive tracking details by email when your order ships.</p>`,
    `<h2>داخل المملكة</h2><ul><li><strong>التوصيل العادي:</strong> 25 ريالاً، ومجاني للطلبات فوق 299 ريالاً. من 2 إلى 5 أيام عمل.</li><li><strong>التوصيل السريع (الرياض، جدة، الدمام):</strong> 45 ريالاً، في يوم العمل التالي للطلبات قبل الساعة 4 مساءً.</li><li><strong>الاستلام من المتجر:</strong> مجاناً.</li></ul><h2>الخليج والشحن الدولي</h2><p>تُحسب الأسعار ومدة التوصيل عند الدفع، وقد تُطبق رسوم جمركية على المستلم.</p>`,
  ),
  "cookie-policy": legal(
    "Cookie Policy",
    "سياسة ملفات تعريف الارتباط",
    `<h2>Essential cookies</h2><p>Required for the store to work: your session, cart and security protections. These can't be switched off.</p><h2>Analytics & marketing</h2><p>Google Analytics and advertising pixels (if enabled by the store) load <strong>only after you accept</strong> in the cookie banner. You can change your choice any time from the footer link “Cookie preferences”.</p>`,
    `<h2>ملفات أساسية</h2><p>ضرورية لعمل المتجر: الجلسة والسلة والحماية الأمنية، ولا يمكن تعطيلها.</p><h2>التحليلات والتسويق</h2><p>لا يتم تحميل Google Analytics وبكسلات الإعلانات (إن كانت مفعلة) <strong>إلا بعد موافقتك</strong> عبر شريط الموافقة. يمكنك تغيير اختيارك في أي وقت من رابط \"تفضيلات ملفات تعريف الارتباط\" أسفل الصفحة.</p>`,
  ),
};

export const ABOUT = {
  title: L("About Nuqta", "عن نقطة"),
  eyebrow: L("Our story", "قصتنا"),
  heading: L("Technology, thoughtfully chosen.", "تقنية مختارة بعناية."),
  body: L(
    "<p>Nuqta started in Riyadh with a simple idea: buying a phone should feel as good as using one. We carry genuine devices from the brands we trust, price them honestly, and back every order with people who actually know tech.</p><p>Whether you're upgrading your iPhone, choosing your first Galaxy, or just need the right cable, we'll help you get it right — and get it to your door fast.</p>",
    "<p>بدأت نقطة في الرياض بفكرة بسيطة: يجب أن يكون شراء الهاتف ممتعاً كاستخدامه. نوفر أجهزة أصلية من العلامات التي نثق بها، بأسعار عادلة، ويدعم كل طلب فريق يفهم التقنية فعلاً.</p><p>سواء كنت تحدّث آيفونك أو تختار أول جالكسي لك أو تحتاج فقط الكابل المناسب، سنساعدك على الاختيار الصحيح ونوصله إلى بابك بسرعة.</p>",
  ),
};

export const SOCIAL_PLATFORMS = [
  "instagram", "facebook", "tiktok", "x", "youtube", "whatsapp", "telegram", "snapchat", "linkedin", "pinterest", "threads", "discord", "reddit",
];

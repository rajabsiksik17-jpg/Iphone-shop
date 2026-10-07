// Default legal texts shipped before the expanded versions; the content upgrade
// replaces a page body only when it still matches one of these (never edits).
const L = (en: string, ar: string) => ({ en, ar });
const legal = (titleEn: string, titleAr: string, en: string, ar: string) => ({ title: L(titleEn, titleAr), body: L(en, ar) });

export const LEGACY_LEGAL = {
  privacy: legal(
    "Privacy Policy",
    "سياسة الخصوصية",
    `<h2>What we collect</h2><p>We collect only what we need to run the store: your name, contact details and delivery address when you order; account details if you register; and basic, privacy-friendly usage statistics. Card payments are processed by our payment provider — we never receive or store your full card number.</p><h2>How we use it</h2><ul><li>To process and deliver your orders and provide support.</li><li>To send transactional emails (order confirmations, shipping updates).</li><li>To send marketing emails <strong>only if you opted in</strong>; you can unsubscribe at any time.</li><li>To keep the store secure and prevent fraud.</li></ul><h2>Cookies & analytics</h2><p>Essential cookies keep you signed in and remember your cart. Analytics and advertising tags load only after you consent via the cookie banner.</p><h2>Your rights</h2><p>You can request a copy of your data or ask us to delete your account from <em>My account → Privacy</em>, or by contacting us.</p><h2>Contact</h2><p>Questions? Reach us through the contact page.</p>`,
    `<h2>ما الذي نجمعه</h2><p>نجمع فقط ما نحتاجه لتشغيل المتجر: اسمك وبيانات التواصل وعنوان التوصيل عند الطلب، وبيانات الحساب عند التسجيل، وإحصاءات استخدام أساسية تحترم الخصوصية. تتم معالجة الدفع بالبطاقة لدى مزوّد الدفع — ولا نستلم رقم بطاقتك الكامل أو نخزّنه.</p><h2>كيف نستخدمها</h2><ul><li>لمعالجة طلباتك وتوصيلها وتقديم الدعم.</li><li>لإرسال الرسائل المتعلقة بالطلبات (تأكيد الطلب وتحديثات الشحن).</li><li>لإرسال الرسائل التسويقية <strong>فقط إذا وافقت</strong>، ويمكنك إلغاء الاشتراك في أي وقت.</li><li>للحفاظ على أمان المتجر ومنع الاحتيال.</li></ul><h2>ملفات تعريف الارتباط والتحليلات</h2><p>ملفات تعريف الارتباط الأساسية تُبقيك مسجلاً وتتذكر سلتك. أدوات التحليل والإعلانات لا تعمل إلا بعد موافقتك عبر شريط الموافقة.</p><h2>حقوقك</h2><p>يمكنك طلب نسخة من بياناتك أو حذف حسابك من <em>حسابي ← الخصوصية</em> أو بالتواصل معنا.</p>`,
  ),
  terms: legal(
    "Terms & Conditions",
    "الشروط والأحكام",
    `<h2>Orders</h2><p>Placing an order is an offer to buy. We confirm acceptance when your order is processed. If an item becomes unavailable or a pricing error occurs, we'll contact you and you won't be charged for items we can't supply.</p><h2>Prices</h2><p>Prices are shown in Saudi Riyal and include 15% VAT unless stated otherwise. Converted prices in other currencies are estimates; you are charged in the currency shown at payment.</p><h2>Delivery & risk</h2><p>Delivery times are estimates. Risk passes to you on delivery.</p><h2>Returns</h2><p>See our Refund Policy.</p><h2>Liability</h2><p>Nothing in these terms limits rights you have under the consumer protection laws of the Kingdom of Saudi Arabia.</p>`,
    `<h2>الطلبات</h2><p>يُعدّ تقديم الطلب عرضاً للشراء، ونؤكد القبول عند معالجة الطلب. إذا أصبح منتج غير متوفر أو حدث خطأ في السعر، سنتواصل معك ولن تُحاسب على ما لا يمكننا توفيره.</p><h2>الأسعار</h2><p>الأسعار بالريال السعودي وتشمل ضريبة القيمة المضافة 15% ما لم يُذكر خلاف ذلك. الأسعار المحوّلة بعملات أخرى تقديرية، ويتم الخصم بالعملة الظاهرة عند الدفع.</p><h2>التوصيل</h2><p>مواعيد التوصيل تقديرية، وتنتقل المسؤولية إليك عند الاستلام.</p><h2>الإرجاع</h2><p>راجع سياسة الاسترجاع.</p>`,
  ),
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
  cookies: legal(
    "Cookie Policy",
    "سياسة ملفات تعريف الارتباط",
    `<h2>Essential cookies</h2><p>Required for the store to work: your session, cart and security protections. These can't be switched off.</p><h2>Analytics & marketing</h2><p>Google Analytics and advertising pixels (if enabled by the store) load <strong>only after you accept</strong> in the cookie banner. You can change your choice any time from the footer link “Cookie preferences”.</p>`,
    `<h2>ملفات أساسية</h2><p>ضرورية لعمل المتجر: الجلسة والسلة والحماية الأمنية، ولا يمكن تعطيلها.</p><h2>التحليلات والتسويق</h2><p>لا يتم تحميل Google Analytics وبكسلات الإعلانات (إن كانت مفعلة) <strong>إلا بعد موافقتك</strong> عبر شريط الموافقة. يمكنك تغيير اختيارك في أي وقت من رابط \"تفضيلات ملفات تعريف الارتباط\" أسفل الصفحة.</p>`,
  ),
};


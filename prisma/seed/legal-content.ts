/**
 * Starter legal pages. Generic e-commerce wording the store owner is expected
 * to review and adapt in Admin → Pages — it is a starting point, not legal
 * advice. Each <h2> becomes an entry in the page's table of contents.
 */
const L = (en: string, ar: string) => ({ en, ar });

const PRIVACY_EN = `
<p>This policy explains what personal information we collect when you use our store, why we collect it, and the choices you have. By using the store you agree to the practices described here.</p>
<h2>Information we collect</h2>
<ul>
<li><strong>Information you give us:</strong> your name, phone number, email address and delivery address when you place an order, create an account, contact us or subscribe to our newsletter.</li>
<li><strong>Order information:</strong> the products you buy, order amounts, delivery preferences and order history.</li>
<li><strong>Technical information:</strong> basic device and browser data, IP address and pages visited, used to keep the store secure and working.</li>
</ul>
<h2>How we use your information</h2>
<ul>
<li>To process, deliver and support your orders.</li>
<li>To send transactional messages such as order confirmations and shipping updates.</li>
<li>To answer your questions and provide customer service.</li>
<li>To prevent fraud and protect the store and our customers.</li>
<li>To improve our products, services and website.</li>
</ul>
<h2>Account information</h2>
<p>If you create an account we store your profile, saved addresses, wishlist and order history so you can check out faster and track your orders. Passwords are stored only in a securely hashed form.</p>
<h2>Orders and payments</h2>
<p>Card payments are processed by our payment provider over an encrypted connection. We never receive or store your full card number. For cash on delivery and bank transfer we keep only the information needed to confirm payment.</p>
<h2>Cookies</h2>
<p>We use essential cookies to keep you signed in, remember your cart, language and currency, and protect the store. Optional cookies are used only with your consent. See our Cookie Policy for details.</p>
<h2>Analytics</h2>
<p>With your consent we may use analytics tools to understand how the store is used, in aggregate. You can withdraw consent at any time from the cookie preferences link.</p>
<h2>Communications</h2>
<p>We send marketing emails or messages only if you opted in. Every marketing message contains a way to unsubscribe. Transactional messages about your orders are always sent.</p>
<h2>Sharing your information</h2>
<p>We share information only with service providers who help us run the store — such as delivery companies, payment providers and email services — and only as needed for that purpose, or when required by law. We do not sell your personal information.</p>
<h2>Data security</h2>
<p>We use reasonable technical and organisational measures to protect your information, including encrypted connections and restricted staff access. No method of transmission or storage is completely secure, but we work to protect your data.</p>
<h2>Data retention</h2>
<p>We keep personal information for as long as your account is active or as needed to provide our services, and for the period required by applicable tax, accounting and legal obligations.</p>
<h2>Your rights</h2>
<p>You may request access to, correction of, or deletion of your personal information, and you may object to marketing at any time. Signed-in customers can manage much of this from their account; otherwise contact us and we will respond within a reasonable time.</p>
<h2>Changes to this policy</h2>
<p>We may update this policy from time to time. The date at the top of this page shows when it was last updated.</p>
<h2>Contact us</h2>
<p>If you have questions about this policy or your personal information, please contact us through the Contact page.</p>`;

const PRIVACY_AR = `
<p>توضح هذه السياسة المعلومات الشخصية التي نجمعها عند استخدامك للمتجر، وسبب جمعها، والخيارات المتاحة لك. باستخدامك للمتجر فإنك توافق على الممارسات الموضحة هنا.</p>
<h2>المعلومات التي نجمعها</h2>
<ul>
<li><strong>معلومات تقدّمها لنا:</strong> الاسم ورقم الجوال والبريد الإلكتروني وعنوان التوصيل عند تقديم طلب أو إنشاء حساب أو التواصل معنا أو الاشتراك في النشرة البريدية.</li>
<li><strong>معلومات الطلبات:</strong> المنتجات التي تشتريها وقيمة الطلبات وتفضيلات التوصيل وسجل الطلبات.</li>
<li><strong>معلومات تقنية:</strong> بيانات أساسية عن الجهاز والمتصفح وعنوان IP والصفحات التي تزورها، لضمان أمان المتجر وعمله بشكل صحيح.</li>
</ul>
<h2>كيف نستخدم معلوماتك</h2>
<ul>
<li>لمعالجة طلباتك وتوصيلها وتقديم الدعم المتعلق بها.</li>
<li>لإرسال الرسائل المتعلقة بالطلبات مثل تأكيد الطلب وتحديثات الشحن.</li>
<li>للرد على استفساراتك وتقديم خدمة العملاء.</li>
<li>لمنع الاحتيال وحماية المتجر وعملائنا.</li>
<li>لتحسين منتجاتنا وخدماتنا وموقعنا.</li>
</ul>
<h2>معلومات الحساب</h2>
<p>عند إنشاء حساب نحفظ ملفك الشخصي وعناوينك المحفوظة وقائمة المفضلة وسجل الطلبات لتسهيل الشراء ومتابعة طلباتك. تُحفظ كلمات المرور بصيغة مشفّرة فقط.</p>
<h2>الطلبات والدفع</h2>
<p>تتم معالجة الدفع بالبطاقة لدى مزوّد الدفع عبر اتصال مشفّر، ولا نستلم رقم بطاقتك الكامل أو نخزّنه. وفي الدفع عند الاستلام أو التحويل البنكي نحتفظ فقط بالمعلومات اللازمة لتأكيد الدفع.</p>
<h2>ملفات تعريف الارتباط</h2>
<p>نستخدم ملفات تعريف ارتباط أساسية لإبقائك مسجلاً وتذكّر سلتك واللغة والعملة وحماية المتجر. أما الملفات الاختيارية فلا تُستخدم إلا بموافقتك. راجع سياسة ملفات تعريف الارتباط للتفاصيل.</p>
<h2>التحليلات</h2>
<p>قد نستخدم بموافقتك أدوات تحليل لفهم طريقة استخدام المتجر بشكل إجمالي، ويمكنك سحب موافقتك في أي وقت من رابط تفضيلات ملفات تعريف الارتباط.</p>
<h2>المراسلات</h2>
<p>لا نرسل رسائل تسويقية إلا إذا وافقت على ذلك، وتحتوي كل رسالة تسويقية على طريقة لإلغاء الاشتراك. أما الرسائل المتعلقة بطلباتك فتُرسل دائماً.</p>
<h2>مشاركة المعلومات</h2>
<p>نشارك المعلومات فقط مع مزوّدي الخدمات الذين يساعدوننا في تشغيل المتجر — مثل شركات التوصيل ومزوّدي الدفع وخدمات البريد — وبالقدر اللازم لذلك، أو عندما يقتضي القانون ذلك. لا نبيع معلوماتك الشخصية.</p>
<h2>أمان البيانات</h2>
<p>نطبّق إجراءات تقنية وتنظيمية معقولة لحماية معلوماتك، منها الاتصالات المشفّرة وتقييد وصول الموظفين. لا توجد وسيلة نقل أو تخزين آمنة تماماً، لكننا نعمل على حماية بياناتك.</p>
<h2>الاحتفاظ بالبيانات</h2>
<p>نحتفظ بالمعلومات الشخصية طالما كان حسابك نشطاً أو بالقدر اللازم لتقديم خدماتنا، وللمدة التي تتطلبها الالتزامات الضريبية والمحاسبية والنظامية.</p>
<h2>حقوقك</h2>
<p>يحق لك طلب الاطلاع على معلوماتك الشخصية أو تصحيحها أو حذفها، والاعتراض على الرسائل التسويقية في أي وقت. يمكنك إدارة الكثير من ذلك من حسابك، أو التواصل معنا وسنرد خلال مدة معقولة.</p>
<h2>التعديلات على هذه السياسة</h2>
<p>قد نحدّث هذه السياسة من وقت لآخر، ويوضح التاريخ أعلى الصفحة آخر تحديث لها.</p>
<h2>تواصل معنا</h2>
<p>إذا كانت لديك أسئلة حول هذه السياسة أو معلوماتك الشخصية، يرجى التواصل معنا عبر صفحة تواصل معنا.</p>`;

const TERMS_EN = `
<p>These terms govern your use of our store and any purchase you make. Please read them carefully. By using the store or placing an order you agree to these terms.</p>
<h2>Accounts</h2>
<p>You may shop as a guest or create an account. You are responsible for keeping your login details confidential and for activity on your account. Please provide accurate information and keep it up to date.</p>
<h2>Products</h2>
<p>We make every effort to describe and display products accurately. Colours and images may vary slightly depending on your screen. All products are genuine and covered by the manufacturer's warranty where stated.</p>
<h2>Pricing</h2>
<p>Prices are shown in Saudi Riyal (SAR) and include VAT unless stated otherwise. Prices shown in other currencies are converted for convenience and are estimates. We may change prices at any time, but changes do not affect orders already confirmed. If a product is listed at an obviously incorrect price, we may cancel the order and refund any payment.</p>
<h2>Orders</h2>
<p>Placing an order is an offer to buy. We accept your order when we confirm it or ship it. We may decline or cancel an order — for example if an item is unavailable, payment cannot be verified, or we suspect fraud — and we will refund any amount already paid.</p>
<h2>Payments</h2>
<p>We accept the payment methods shown at checkout. Card payments are processed securely by our payment provider. For cash on delivery, please have the exact amount ready when your order arrives.</p>
<h2>Shipping and delivery</h2>
<p>Delivery times are estimates and may vary. Risk in the products passes to you on delivery. See our Shipping Policy for rates and timings.</p>
<h2>Returns and refunds</h2>
<p>You may return eligible products according to our Return &amp; Refund Policy. Refunds are made to the original payment method once the returned item has been received and checked.</p>
<h2>Your responsibilities</h2>
<p>You agree not to misuse the store, interfere with its security, submit false information or orders, or use it for any unlawful purpose.</p>
<h2>Intellectual property</h2>
<p>All content on the store — including text, images, logos and design — belongs to us or our licensors and may not be copied or used without permission. Brand names and trademarks belong to their respective owners.</p>
<h2>Limitation of liability</h2>
<p>To the extent permitted by law, we are not liable for indirect or consequential losses arising from your use of the store. Nothing in these terms limits your rights under applicable consumer protection laws.</p>
<h2>Changes to these terms</h2>
<p>We may update these terms from time to time. The version published on this page at the time of your order applies to that order.</p>
<h2>Contact us</h2>
<p>If you have questions about these terms, please contact us through the Contact page.</p>`;

const TERMS_AR = `
<p>تنظّم هذه الشروط استخدامك لمتجرنا وأي عملية شراء تقوم بها، فيرجى قراءتها بعناية. باستخدامك للمتجر أو تقديمك لطلب فإنك توافق على هذه الشروط.</p>
<h2>الحسابات</h2>
<p>يمكنك الشراء كزائر أو إنشاء حساب. أنت مسؤول عن الحفاظ على سرية بيانات الدخول وعن أي نشاط يتم عبر حسابك، ويرجى تقديم معلومات صحيحة وتحديثها عند الحاجة.</p>
<h2>المنتجات</h2>
<p>نحرص على وصف المنتجات وعرضها بدقة، وقد تختلف الألوان والصور قليلاً حسب شاشتك. جميع المنتجات أصلية ومشمولة بكفالة الشركة المصنعة حيثما ذُكر ذلك.</p>
<h2>الأسعار</h2>
<p>الأسعار معروضة بالريال السعودي وتشمل ضريبة القيمة المضافة ما لم يُذكر خلاف ذلك. الأسعار المعروضة بعملات أخرى محوّلة للتسهيل وهي تقديرية. يحق لنا تعديل الأسعار في أي وقت دون أن يؤثر ذلك على الطلبات المؤكدة. وإذا ظهر منتج بسعر خاطئ بشكل واضح فيحق لنا إلغاء الطلب واسترداد أي مبلغ مدفوع.</p>
<h2>الطلبات</h2>
<p>يُعدّ تقديم الطلب عرضاً للشراء، ونقبله عند تأكيده أو شحنه. يحق لنا رفض الطلب أو إلغاؤه — مثلاً عند عدم توفر المنتج أو تعذّر التحقق من الدفع أو الاشتباه في الاحتيال — مع استرداد أي مبلغ مدفوع.</p>
<h2>الدفع</h2>
<p>نقبل وسائل الدفع الظاهرة في صفحة الدفع، وتتم معالجة الدفع بالبطاقة بشكل آمن لدى مزوّد الدفع. وعند اختيار الدفع عند الاستلام يرجى تجهيز المبلغ عند وصول الطلب.</p>
<h2>الشحن والتوصيل</h2>
<p>مواعيد التوصيل تقديرية وقد تختلف، وتنتقل مسؤولية المنتجات إليك عند الاستلام. راجع سياسة الشحن لمعرفة الأسعار والمدد.</p>
<h2>الإرجاع والاسترداد</h2>
<p>يمكنك إرجاع المنتجات المؤهلة وفق سياسة الإرجاع والاسترداد، ويتم الاسترداد إلى وسيلة الدفع الأصلية بعد استلام المنتج المرتجع وفحصه.</p>
<h2>مسؤوليات المستخدم</h2>
<p>تتعهد بعدم إساءة استخدام المتجر أو التأثير على أمانه أو تقديم معلومات أو طلبات غير صحيحة أو استخدامه لأي غرض غير نظامي.</p>
<h2>الملكية الفكرية</h2>
<p>جميع محتويات المتجر — من نصوص وصور وشعارات وتصميم — مملوكة لنا أو للمرخِّصين لنا، ولا يجوز نسخها أو استخدامها دون إذن. وأسماء العلامات التجارية مملوكة لأصحابها.</p>
<h2>حدود المسؤولية</h2>
<p>في الحدود التي يسمح بها النظام، لا نتحمل المسؤولية عن الخسائر غير المباشرة الناتجة عن استخدامك للمتجر. ولا يحدّ أي شيء في هذه الشروط من حقوقك وفق أنظمة حماية المستهلك المعمول بها.</p>
<h2>التعديلات على الشروط</h2>
<p>قد نحدّث هذه الشروط من وقت لآخر، وتنطبق على كل طلب النسخةُ المنشورة في هذه الصفحة وقت تقديمه.</p>
<h2>تواصل معنا</h2>
<p>إذا كانت لديك أسئلة حول هذه الشروط، يرجى التواصل معنا عبر صفحة تواصل معنا.</p>`;

const clean = (s: string) => s.trim().replace(/\n/g, "");

export const PRIVACY_PAGE = {
  title: L("Privacy Policy", "سياسة الخصوصية"),
  excerpt: L("How we collect, use and protect your personal information.", "كيف نجمع معلوماتك الشخصية ونستخدمها ونحميها."),
  body: L(clean(PRIVACY_EN), clean(PRIVACY_AR)),
};

export const TERMS_PAGE = {
  title: L("Terms & Conditions", "الشروط والأحكام"),
  excerpt: L("The terms that apply when you use our store and place an order.", "الشروط التي تنطبق عند استخدامك للمتجر وتقديم الطلبات."),
  body: L(clean(TERMS_EN), clean(TERMS_AR)),
};

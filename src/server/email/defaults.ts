import type { LocalizedText } from "@/lib/i18n-text";

/**
 * Built-in transactional templates. Seeded into the database (where admins can
 * edit them) and used as fallback if a row is missing. Bodies are a safe HTML
 * subset; {{variables}} are escaped, while *_block variables are pre-rendered.
 */
export type TemplateDef = {
  key: string;
  audience: "customer" | "staff";
  variables: string[];
  subject: LocalizedText;
  body: LocalizedText;
};

const common = ["store_name", "customer_name", "store_url"];
const orderVars = [...common, "order_number", "order_total", "order_status", "payment_method", "order_url", "order_items_block", "action_block"];

export const EMAIL_TEMPLATES: TemplateDef[] = [
  {
    key: "welcome",
    audience: "customer",
    variables: [...common, "action_block"],
    subject: { en: "Welcome to {{store_name}}", ar: "أهلاً بك في {{store_name}}" },
    body: {
      en: "<h2>Welcome, {{customer_name}}!</h2><p>Your account is ready. Track orders, save favourites to your wishlist and check out faster next time.</p>{{action_block}}<p>If you ever need help, just reply to this email.</p>",
      ar: "<h2>أهلاً {{customer_name}}!</h2><p>حسابك جاهز. تابع طلباتك، احفظ منتجاتك المفضلة، وأكمل الشراء بشكل أسرع في المرة القادمة.</p>{{action_block}}<p>إن احتجت أي مساعدة، فقط قم بالرد على هذه الرسالة.</p>",
    },
  },
  {
    key: "order_confirmation",
    audience: "customer",
    variables: orderVars,
    subject: { en: "Order {{order_number}} confirmed", ar: "تم تأكيد طلبك {{order_number}}" },
    body: {
      en: "<h2>Thanks for your order, {{customer_name}}!</h2><p>We've received order <strong>{{order_number}}</strong> and will let you know as soon as it ships.</p>{{order_items_block}}<p><strong>Total:</strong> {{order_total}}<br><strong>Payment:</strong> {{payment_method}}</p>{{action_block}}",
      ar: "<h2>شكراً لطلبك يا {{customer_name}}!</h2><p>استلمنا طلبك رقم <strong>{{order_number}}</strong> وسنخبرك فور شحنه.</p>{{order_items_block}}<p><strong>الإجمالي:</strong> {{order_total}}<br><strong>طريقة الدفع:</strong> {{payment_method}}</p>{{action_block}}",
    },
  },
  {
    key: "payment_confirmation",
    audience: "customer",
    variables: orderVars,
    subject: { en: "Payment received for {{order_number}}", ar: "تم استلام الدفعة للطلب {{order_number}}" },
    body: {
      en: "<h2>Payment received</h2><p>Hi {{customer_name}}, we've received your payment of <strong>{{order_total}}</strong> for order {{order_number}}. We're preparing it now.</p>{{action_block}}",
      ar: "<h2>تم استلام الدفعة</h2><p>مرحباً {{customer_name}}، استلمنا دفعتك بقيمة <strong>{{order_total}}</strong> للطلب {{order_number}}. نقوم بتجهيزه الآن.</p>{{action_block}}",
    },
  },
  {
    key: "order_status",
    audience: "customer",
    variables: [...orderVars, "tracking_number", "tracking_url"],
    subject: { en: "Order {{order_number}}: {{order_status}}", ar: "الطلب {{order_number}}: {{order_status}}" },
    body: {
      en: "<h2>Your order is now {{order_status}}</h2><p>Hi {{customer_name}}, there's an update on order <strong>{{order_number}}</strong>.</p>{{action_block}}",
      ar: "<h2>حالة طلبك الآن: {{order_status}}</h2><p>مرحباً {{customer_name}}، هناك تحديث على طلبك <strong>{{order_number}}</strong>.</p>{{action_block}}",
    },
  },
  {
    key: "order_shipped",
    audience: "customer",
    variables: [...orderVars, "tracking_number", "tracking_url", "carrier"],
    subject: { en: "Your order {{order_number}} is on its way", ar: "طلبك {{order_number}} في الطريق إليك" },
    body: {
      en: "<h2>It's on the way! 🚚</h2><p>Hi {{customer_name}}, order <strong>{{order_number}}</strong> has shipped.</p><p>Carrier: {{carrier}}<br>Tracking number: <strong>{{tracking_number}}</strong></p>{{action_block}}",
      ar: "<h2>طلبك في الطريق! 🚚</h2><p>مرحباً {{customer_name}}، تم شحن طلبك <strong>{{order_number}}</strong>.</p><p>شركة الشحن: {{carrier}}<br>رقم التتبع: <strong>{{tracking_number}}</strong></p>{{action_block}}",
    },
  },
  {
    key: "order_completed",
    audience: "customer",
    variables: orderVars,
    subject: { en: "Order {{order_number}} delivered", ar: "تم توصيل طلبك {{order_number}}" },
    body: {
      en: "<h2>Delivered ✨</h2><p>Hi {{customer_name}}, we hope you love your purchase. Reviews help other shoppers — tell us what you think.</p>{{action_block}}",
      ar: "<h2>تم التوصيل ✨</h2><p>مرحباً {{customer_name}}، نتمنى أن تنال مشترياتك إعجابك. تقييمك يساعد المتسوقين الآخرين — شاركنا رأيك.</p>{{action_block}}",
    },
  },
  {
    key: "order_cancelled",
    audience: "customer",
    variables: orderVars,
    subject: { en: "Order {{order_number}} cancelled", ar: "تم إلغاء الطلب {{order_number}}" },
    body: {
      en: "<h2>Order cancelled</h2><p>Hi {{customer_name}}, order <strong>{{order_number}}</strong> has been cancelled. If you were charged, a refund will be issued to your original payment method.</p>{{action_block}}",
      ar: "<h2>تم إلغاء الطلب</h2><p>مرحباً {{customer_name}}، تم إلغاء طلبك <strong>{{order_number}}</strong>. إن تم الخصم من حسابك فسيتم استرداد المبلغ لوسيلة الدفع الأصلية.</p>{{action_block}}",
    },
  },
  {
    key: "order_refunded",
    audience: "customer",
    variables: [...orderVars, "refund_amount"],
    subject: { en: "Refund issued for {{order_number}}", ar: "تم استرداد مبلغ للطلب {{order_number}}" },
    body: {
      en: "<h2>Refund issued</h2><p>Hi {{customer_name}}, we've refunded <strong>{{refund_amount}}</strong> for order {{order_number}}. Depending on your bank it may take a few days to appear.</p>",
      ar: "<h2>تم الاسترداد</h2><p>مرحباً {{customer_name}}، قمنا باسترداد <strong>{{refund_amount}}</strong> للطلب {{order_number}}. قد يستغرق ظهوره بضعة أيام حسب البنك.</p>",
    },
  },
  {
    key: "password_reset",
    audience: "customer",
    variables: [...common, "action_block", "expires_minutes"],
    subject: { en: "Reset your {{store_name}} password", ar: "إعادة تعيين كلمة المرور في {{store_name}}" },
    body: {
      en: "<h2>Reset your password</h2><p>We received a request to reset your password. This link expires in {{expires_minutes}} minutes and can be used once.</p>{{action_block}}<p>If you didn't request this, you can safely ignore this email.</p>",
      ar: "<h2>إعادة تعيين كلمة المرور</h2><p>تلقينا طلباً لإعادة تعيين كلمة المرور. تنتهي صلاحية هذا الرابط خلال {{expires_minutes}} دقيقة ويمكن استخدامه مرة واحدة.</p>{{action_block}}<p>إن لم تطلب ذلك، يمكنك تجاهل هذه الرسالة بأمان.</p>",
    },
  },
  {
    key: "admin_otp",
    audience: "staff",
    variables: [...common, "otp_code", "expires_minutes", "ip"],
    subject: { en: "{{otp_code}} is your {{store_name}} admin sign-in code", ar: "{{otp_code}} هو رمز دخول لوحة تحكم {{store_name}}" },
    body: {
      en: "<h2>Your sign-in code</h2><p style=\"font-size:32px;font-weight:700;letter-spacing:8px\">{{otp_code}}</p><p>It expires in {{expires_minutes}} minutes. Requested from IP {{ip}}.</p><p>If this wasn't you, change your password immediately.</p>",
      ar: "<h2>رمز تسجيل الدخول</h2><p style=\"font-size:32px;font-weight:700;letter-spacing:8px\">{{otp_code}}</p><p>تنتهي صلاحيته خلال {{expires_minutes}} دقيقة. تم الطلب من العنوان {{ip}}.</p><p>إن لم تكن أنت، قم بتغيير كلمة المرور فوراً.</p>",
    },
  },
  {
    key: "staff_alert",
    audience: "staff",
    variables: ["store_name", "alert_title", "alert_body", "action_block"],
    subject: { en: "[{{store_name}}] {{alert_title}}", ar: "[{{store_name}}] {{alert_title}}" },
    body: {
      en: "<h2>{{alert_title}}</h2><p>{{alert_body}}</p>{{action_block}}",
      ar: "<h2>{{alert_title}}</h2><p>{{alert_body}}</p>{{action_block}}",
    },
  },
  {
    key: "contact_receipt",
    audience: "customer",
    variables: [...common, "subject"],
    subject: { en: "We received your message", ar: "استلمنا رسالتك" },
    body: {
      en: "<h2>Thanks for reaching out, {{customer_name}}</h2><p>We've received your message and a member of our team will reply as soon as possible.</p>",
      ar: "<h2>شكراً لتواصلك يا {{customer_name}}</h2><p>استلمنا رسالتك وسيقوم أحد أعضاء فريقنا بالرد في أقرب وقت ممكن.</p>",
    },
  },
  {
    key: "test_email",
    audience: "staff",
    variables: ["store_name"],
    subject: { en: "Test email from {{store_name}}", ar: "رسالة تجريبية من {{store_name}}" },
    body: {
      en: "<h2>It works! ✅</h2><p>Your SMTP settings are configured correctly and {{store_name}} can send email.</p>",
      ar: "<h2>الإعدادات تعمل! ✅</h2><p>تم إعداد SMTP بشكل صحيح ويمكن لمتجر {{store_name}} إرسال البريد.</p>",
    },
  },
];

export const templateDef = (key: string) => EMAIL_TEMPLATES.find((t) => t.key === key);

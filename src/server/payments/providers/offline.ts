import "server-only";
import type { PaymentProvider } from "../types";

const titleFields = (en: string, ar: string) => [
  { key: "title_en", type: "text" as const, placeholder: en, label: { en: "Checkout title (English)", ar: "العنوان في صفحة الدفع (إنجليزي)" } },
  { key: "title_ar", type: "text" as const, placeholder: ar, label: { en: "Checkout title (Arabic)", ar: "العنوان في صفحة الدفع (عربي)" } },
];

export const cashOnDelivery: PaymentProvider = {
  key: "cod",
  category: "payments",
  name: "Cash on Delivery",
  icon: "lucide:banknote",
  availability: "available",
  description: { en: "Customer pays the courier in cash (or card, if your courier supports it) on delivery.", ar: "يدفع العميل نقداً (أو بالبطاقة إن توفر لدى المندوب) عند الاستلام." },
  fields: [
    ...titleFields("Cash on delivery", "الدفع عند الاستلام"),
    { key: "instructions_en", type: "textarea", label: { en: "Instructions (English)", ar: "التعليمات (إنجليزي)" } },
    { key: "instructions_ar", type: "textarea", label: { en: "Instructions (Arabic)", ar: "التعليمات (عربي)" } },
    { key: "maxOrderTotal", type: "number", label: { en: "Maximum order total (major units, optional)", ar: "الحد الأعلى لقيمة الطلب (اختياري)" } },
  ],
  async test() {
    return { ok: true, message: "Offline method — nothing to connect." };
  },
  payment: {
    async init() {
      return { type: "offline" };
    },
  },
};

export const bankTransfer: PaymentProvider = {
  key: "bank_transfer",
  category: "payments",
  name: "Bank transfer / CliQ",
  icon: "lucide:landmark",
  availability: "available",
  description: { en: "Customer transfers to your bank account or CliQ alias; you mark the order paid once received.", ar: "يحوّل العميل إلى حسابك البنكي أو اسم CliQ، وتقوم بتعليم الطلب كمدفوع عند الاستلام." },
  fields: [
    ...titleFields("Bank transfer / CliQ", "تحويل بنكي / كليك"),
    { key: "instructions_en", type: "textarea", required: true, label: { en: "Account details & instructions (English)", ar: "تفاصيل الحساب والتعليمات (إنجليزي)" } },
    { key: "instructions_ar", type: "textarea", required: true, label: { en: "Account details & instructions (Arabic)", ar: "تفاصيل الحساب والتعليمات (عربي)" } },
  ],
  async test({ config }) {
    return config.instructions_en || config.instructions_ar
      ? { ok: true, message: "Instructions configured." }
      : { ok: false, message: "Add account details so customers know where to pay." };
  },
  payment: {
    async init() {
      return { type: "offline" };
    },
  },
};

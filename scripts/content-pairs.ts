// Default-copy corrections applied by `npm run upgrade:content` to existing
// databases (the seed already contains the new wording). Exact matches only.
export const BANK_INSTRUCTIONS = {
  en: "Transfer the order total to our bank account — IBAN SA00 0000 0000 0000 0000 0000 (replace with your bank details in Admin → Integrations). Use your order number as the transfer reference.",
  ar: "حوّل قيمة الطلب إلى حسابنا البنكي — الآيبان SA00 0000 0000 0000 0000 0000 (استبدله ببيانات حسابك من لوحة التحكم ← التكاملات). استخدم رقم الطلب كمرجع للتحويل.",
};

export const CONTENT_PAIRS: [string, string][] = [
  // CliQ is a Jordanian instant-payment network — not available in Saudi Arabia.
  ["Pay cash on delivery, by card or CliQ", "Pay cash on delivery, by mada card or bank transfer"],
  ["ادفع نقداً عند الاستلام أو بالبطاقة أو عبر كليك", "ادفع نقداً عند الاستلام أو ببطاقة مدى أو بالتحويل البنكي"],
  ["Cash on delivery, bank transfer / CliQ, and", "Cash on delivery, bank transfer, and"],
  ["الدفع عند الاستلام، والتحويل البنكي / كليك، والدفع", "الدفع عند الاستلام، والتحويل البنكي، والدفع"],
  ["Transfer the order total to Nuqta Trading LLC — IBAN JO00 XXXX 0000 0000 0000 0000 0000 00, or CliQ alias NUQTA. Use your order number as the reference.", BANK_INSTRUCTIONS.en],
  ["حوّل قيمة الطلب إلى شركة نقطة للتجارة — IBAN JO00 XXXX 0000 0000 0000 0000 0000 00 أو عبر كليك على الاسم NUQTA. استخدم رقم الطلب كمرجع.", BANK_INSTRUCTIONS.ar],
];

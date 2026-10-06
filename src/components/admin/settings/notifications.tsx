"use client";

import { useAdmin } from "../admin-context";
import { SettingsForm } from "./form";

const EVENT_LABELS: Record<string, [string, string]> = {
  ORDER_CREATED: ["New order", "طلب جديد"],
  ORDER_PAID: ["Order paid", "تم دفع طلب"],
  ORDER_STATUS_CHANGED: ["Order status changed", "تغيّر حالة طلب"],
  PAYMENT_FAILED: ["Payment failed", "فشل الدفع"],
  USER_REGISTERED: ["New customer", "عميل جديد"],
  REVIEW_CREATED: ["New review", "تقييم جديد"],
  PRODUCT_LOW_STOCK: ["Low stock", "مخزون منخفض"],
  PRODUCT_OUT_OF_STOCK: ["Out of stock", "نفاد المخزون"],
  CONTACT_SUBMITTED: ["Contact message", "رسالة تواصل"],
  CHAT_STARTED: ["Live chat started", "بدء محادثة"],
  ADMIN_LOGIN_FAILED: ["Failed admin sign-in", "فشل دخول مدير"],
  ADMIN_LOGIN: ["Admin sign-in", "دخول مدير"],
  INTEGRATION_FAILED: ["Integration error", "خطأ في تكامل"],
};

type Rule = { inApp: boolean; email: boolean; whatsapp: boolean };

export function NotificationSettings({ initial, whatsappReady }: { initial: Record<string, unknown>; whatsappReady: boolean }) {
  const { t, locale } = useAdmin();
  const ar = locale === "ar";
  return (
    <SettingsForm
      group="notifications"
      title={t("s.notifications")}
      initial={initial}
      sections={[
        {
          title: ["Who gets notified, and how", "من يتلقى الإشعار وكيف"],
          description: ["Staff only receive alerts for areas they have permission to see.", "يتلقى الموظفون التنبيهات فقط للأقسام التي يملكون صلاحيتها."],
          fields: [
            {
              path: "staff",
              type: "custom",
              label: ["Staff alerts", "تنبيهات الفريق"],
              render: (value, set) => {
                const v = (value ?? {}) as Record<string, Rule>;
                return (
                  <div className="overflow-x-auto rounded-xl border border-ad-border">
                    <table className="w-full text-[13px]">
                      <thead>
                        <tr className="border-b border-ad-border text-xs text-ad-muted">
                          <th className="px-3 py-2 text-start font-medium">{ar ? "الحدث" : "Event"}</th>
                          <th className="px-3 py-2 font-medium">{t("s.inApp")}</th>
                          <th className="px-3 py-2 font-medium">{t("s.emailChannel")}</th>
                          <th className="px-3 py-2 font-medium">{t("s.whatsappChannel")}</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-ad-border">
                        {Object.keys(EVENT_LABELS).map((ev) => (
                          <tr key={ev}>
                            <td className="px-3 py-2">{EVENT_LABELS[ev][ar ? 1 : 0]}</td>
                            {(["inApp", "email", "whatsapp"] as const).map((ch) => (
                              <td key={ch} className="px-3 py-2 text-center">
                                <input
                                  type="checkbox"
                                  className="size-4 accent-[var(--ad-accent)] disabled:opacity-40"
                                  aria-label={`${EVENT_LABELS[ev][0]} — ${ch}`}
                                  disabled={ch === "whatsapp" && !whatsappReady}
                                  checked={Boolean(v[ev]?.[ch])}
                                  onChange={(e) => set({ ...v, [ev]: { ...(v[ev] ?? { inApp: false, email: false, whatsapp: false }), [ch]: e.target.checked } })}
                                />
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {!whatsappReady && (
                      <p className="border-t border-ad-border px-3 py-2 text-xs text-ad-muted">
                        {ar ? "لتفعيل تنبيهات واتساب اربط WhatsApp Cloud API من صفحة التكاملات." : "Connect WhatsApp Cloud API in Integrations to enable WhatsApp alerts."}
                      </p>
                    )}
                  </div>
                );
              },
            },
            { path: "staffEmails", type: "tags", label: ["Alert email recipients (empty = staff with access)", "مستلمو التنبيهات بالبريد (فارغ = الموظفون أصحاب الصلاحية)"], transform: (s) => s.trim().toLowerCase() },
            { path: "staffWhatsapp", type: "tags", label: ["Alert WhatsApp numbers (E.164)", "أرقام واتساب للتنبيهات"], transform: (s) => s.replace(/[^\d+]/g, "") },
            { path: "sound", type: "boolean", label: ["Play a sound for new alerts in the admin", "تشغيل صوت للتنبيهات الجديدة في لوحة التحكم"] },
          ],
        },
        {
          title: ["Customer emails", "رسائل العملاء"],
          fields: [
            { path: "customer.welcome", type: "boolean", label: ["Welcome email after sign-up", "رسالة ترحيب بعد التسجيل"] },
            { path: "customer.orderConfirmation", type: "boolean", label: ["Order confirmation", "تأكيد الطلب"] },
            { path: "customer.paymentConfirmation", type: "boolean", label: ["Payment received", "استلام الدفع"] },
            { path: "customer.orderStatus", type: "boolean", label: ["Order status updates", "تحديثات حالة الطلب"] },
            { path: "customer.whatsappOrderUpdates", type: "boolean", label: ["WhatsApp order updates", "تحديثات الطلب عبر واتساب"], hint: whatsappReady ? undefined : ["Requires WhatsApp Cloud API", "يتطلب WhatsApp Cloud API"] },
          ],
        },
      ]}
    />
  );
}

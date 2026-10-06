import { adminPage } from "@/server/admin/guard";
import { getSettingsForAdmin } from "@/server/settings/service";
import { db } from "@/server/db";
import { EmailSettings } from "@/components/admin/settings/views";
import { Forbidden } from "@/components/admin/ui";

export const metadata = { title: "Email settings" };

export default async function EmailSettingsPage() {
  const { allowed, staff } = await adminPage("settings.email");
  if (!allowed) return <Forbidden />;
  const [{ value, secrets }, logs] = await Promise.all([
    getSettingsForAdmin("email"),
    db.deliveryLog.findMany({ where: { channel: "EMAIL" }, orderBy: { createdAt: "desc" }, take: 25 }),
  ]);
  return (
    <EmailSettings
      initial={value as Record<string, unknown>}
      secrets={secrets}
      smtpStatus={value.smtpStatus}
      imapStatus={value.imapStatus}
      myEmail={staff.email}
      logs={logs.map((l) => ({ id: l.id, recipient: l.recipient, subject: l.subject, status: l.status, error: l.error, template: l.template, createdAt: l.createdAt.toISOString() }))}
    />
  );
}

import { cookies } from "next/headers";
import { setRequestLocale } from "next-intl/server";
import { db } from "@/server/db";
import { hmac } from "@/server/crypto";
import { customerOrRedirect } from "@/server/auth/page-guards";
import { COOKIE } from "@/server/auth/session";
import { SecurityPanel } from "@/components/store/account/forms";
import type { Locale } from "@/i18n/config";

export default async function SecurityPage({ params }: { params: Promise<{ locale: string }> }) {
  setRequestLocale((await params).locale as Locale);
  const user = await customerOrRedirect();
  const token = (await cookies()).get(COOKIE.STOREFRONT)?.value;
  const currentHash = token ? hmac(token, "session") : "";
  const sessions = await db.session.findMany({ where: { userId: user.id, scope: "STOREFRONT", revokedAt: null, expiresAt: { gt: new Date() } }, orderBy: { lastSeenAt: "desc" }, take: 20 });
  return <SecurityPanel sessions={sessions.map((s) => ({ id: s.id, userAgent: s.userAgent, lastSeenAt: s.lastSeenAt.toISOString(), current: s.tokenHash === currentHash }))} />;
}

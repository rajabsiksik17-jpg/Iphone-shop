"use server";

import { resolveDestination } from "@/server/commerce/regions";
import { getLocale } from "next-intl/server";
import { t } from "@/lib/i18n-text";
import { z } from "zod";
import { cookies } from "next/headers";
import { db } from "@/server/db";
import { Errors } from "@/server/errors";
import { requireCustomer } from "@/server/auth/guards";
import { changePassword } from "@/server/auth/service";
import { COOKIE, destroySession, revokeAllSessions } from "@/server/auth/session";
import { hmac } from "@/server/crypto";
import { addressSchema, phoneSchema } from "@/server/commerce/checkout";
import { getSettings } from "@/server/settings/service";
import { verifyPassword } from "@/server/auth/password";
import { idSchema, localeSchema, run } from "./helpers";

export async function updateProfileAction(input: { name: string; phone?: string; locale: string; marketingOptIn: boolean }) {
  return run(async () => {
    const user = await requireCustomer();
    const p = z.object({ name: z.string().trim().min(2).max(100), phone: phoneSchema.optional().or(z.literal("")), locale: localeSchema, marketingOptIn: z.boolean() }).parse(input);
    await db.user.update({ where: { id: user.id }, data: { name: p.name, phone: p.phone || null, locale: p.locale, marketingOptIn: p.marketingOptIn } });
    if (p.marketingOptIn) await db.newsletterSubscriber.upsert({ where: { email: user.email }, create: { email: user.email, locale: p.locale, source: "account" }, update: { status: "subscribed", unsubscribedAt: null } });
    else await db.newsletterSubscriber.updateMany({ where: { email: user.email }, data: { status: "unsubscribed", unsubscribedAt: new Date() } });
  });
}

export async function saveAddressAction(input: z.input<typeof addressSchema> & { id?: string; label?: string; isDefault?: boolean }) {
  return run(async () => {
    const user = await requireCustomer();
    const p = addressSchema.extend({ id: idSchema.optional(), label: z.string().trim().max(40).optional(), isDefault: z.boolean().optional() }).parse(input);
    // Countries with a city list: the city must be one of them (its name is stored with the id).
    const dest = await resolveDestination(p.country, p.regionId);
    const city = dest.region ? t(dest.region.name, (await getLocale()) as "ar" | "en") || p.city : p.city;
    const data = { label: p.label || null, fullName: p.fullName, phone: p.phone, country: p.country, city, regionId: dest.region?.id ?? null, area: p.area || null, line1: p.line1, line2: p.line2 || null, postalCode: p.postalCode || null };
    await db.$transaction(async (tx) => {
      const count = await tx.address.count({ where: { userId: user.id } });
      const makeDefault = p.isDefault || count === 0;
      if (makeDefault) await tx.address.updateMany({ where: { userId: user.id }, data: { isDefault: false } });
      if (p.id) {
        const res = await tx.address.updateMany({ where: { id: p.id, userId: user.id }, data: { ...data, ...(makeDefault ? { isDefault: true } : {}) } });
        if (!res.count) throw Errors.notFound();
      } else {
        if (count >= 20) throw Errors.invalid({ _: ["too_many_addresses"] });
        await tx.address.create({ data: { ...data, userId: user.id, isDefault: makeDefault } });
      }
    });
  });
}

export async function deleteAddressAction(id: string) {
  return run(async () => {
    const user = await requireCustomer();
    await db.address.deleteMany({ where: { id: idSchema.parse(id), userId: user.id } });
  });
}

export async function changePasswordAction(input: { current: string; next: string }) {
  return run(async () => {
    const user = await requireCustomer();
    const p = z.object({ current: z.string().min(1).max(256), next: z.string().min(1).max(256) }).parse(input);
    const token = (await cookies()).get(COOKIE.STOREFRONT)?.value;
    const session = token ? await db.session.findUnique({ where: { tokenHash: hmac(token, "session") } }) : null;
    await changePassword(user.id, p.current, p.next, session?.id);
  });
}

export async function signOutOthersAction() {
  return run(async () => {
    const user = await requireCustomer();
    const token = (await cookies()).get(COOKIE.STOREFRONT)?.value;
    const session = token ? await db.session.findUnique({ where: { tokenHash: hmac(token, "session") } }) : null;
    await revokeAllSessions(user.id, { exceptSessionId: session?.id, scope: "STOREFRONT" });
  });
}

export async function markNotificationsReadAction(ids?: string[]) {
  return run(async () => {
    const user = await requireCustomer();
    const targets = ids?.length
      ? await db.notification.findMany({ where: { id: { in: ids.slice(0, 200) }, userId: user.id }, select: { id: true } })
      : await db.notification.findMany({ where: { userId: user.id, audience: "CUSTOMER", reads: { none: { userId: user.id } } }, select: { id: true } });
    await db.notificationRead.createMany({ data: targets.map((n) => ({ notificationId: n.id, userId: user.id })), skipDuplicates: true });
  });
}

/**
 * Right to erasure: personal data is removed; orders are kept for accounting
 * but anonymised. Requires the password and an explicit confirmation word.
 */
export async function deleteAccountAction(input: { password: string; confirm: string }) {
  return run(async () => {
    const user = await requireCustomer();
    if (!(await getSettings("privacy")).allowAccountDeletion) throw Errors.forbidden();
    const p = z.object({ password: z.string().min(1), confirm: z.literal("DELETE") }).parse(input);
    const full = await db.user.findUniqueOrThrow({ where: { id: user.id } });
    if (!(await verifyPassword(full.passwordHash, p.password))) throw Errors.invalid({ password: ["incorrect"] });
    const anon = `deleted-${user.id}@deleted.invalid`;
    await db.$transaction(async (tx) => {
      await tx.order.updateMany({ where: { userId: user.id }, data: { userId: null, email: anon, phone: "", customerName: "Deleted customer", shippingAddress: {}, billingAddress: undefined, ipHash: null, userAgent: null } });
      await tx.review.updateMany({ where: { userId: user.id }, data: { userId: null, authorName: "Former customer" } });
      await tx.conversation.updateMany({ where: { customerId: user.id }, data: { customerId: null, guestName: null, guestEmail: null } });
      await tx.contactSubmission.updateMany({ where: { userId: user.id }, data: { userId: null, name: "Deleted", email: anon, phone: null } });
      await tx.newsletterSubscriber.deleteMany({ where: { email: full.email } });
      await tx.user.delete({ where: { id: user.id } });
    });
    await destroySession("STOREFRONT");
  });
}

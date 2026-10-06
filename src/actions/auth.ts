"use server";

import { z } from "zod";
import { adminLogin, customerLogin, registerCustomer, requestPasswordReset, resendAdminOtp, resetPassword, verifyAdminOtp } from "@/server/auth/service";
import { destroySession } from "@/server/auth/session";
import { mergeGuestCart } from "@/server/commerce/cart";
import { phoneSchema } from "@/server/commerce/checkout";
import { db } from "@/server/db";
import { localeSchema, run } from "./helpers";

const credentials = z.object({ email: z.string().trim().email().max(200), password: z.string().min(1).max(256) });

export async function customerLoginAction(input: { email: string; password: string; wishlist?: string[] }) {
  return run(async () => {
    const user = await customerLogin(credentials.parse(input));
    await mergeGuestCart(user.id);
    if (input.wishlist?.length) {
      const ids = z.array(z.string().max(64)).max(200).parse(input.wishlist);
      const valid = await db.product.findMany({ where: { id: { in: ids } }, select: { id: true } });
      await db.wishlistItem.createMany({ data: valid.map((v) => ({ userId: user.id, productId: v.id })), skipDuplicates: true });
    }
    return { name: user.name };
  });
}

export async function registerAction(input: { name: string; email: string; password: string; phone?: string; locale: string; marketingOptIn?: boolean; wishlist?: string[] }) {
  return run(async () => {
    const p = z
      .object({
        name: z.string().trim().min(2).max(100),
        email: z.string().trim().email().max(200),
        password: z.string().min(1).max(256),
        phone: phoneSchema.optional().or(z.literal("")),
        locale: localeSchema,
        marketingOptIn: z.boolean().optional(),
      })
      .parse(input);
    const user = await registerCustomer({ ...p, phone: p.phone || null });
    await mergeGuestCart(user.id);
    if (input.wishlist?.length) {
      const valid = await db.product.findMany({ where: { id: { in: input.wishlist.slice(0, 200) } }, select: { id: true } });
      await db.wishlistItem.createMany({ data: valid.map((v) => ({ userId: user.id, productId: v.id })), skipDuplicates: true });
    }
    if (p.marketingOptIn) {
      await db.newsletterSubscriber.upsert({ where: { email: user.email }, create: { email: user.email, locale: p.locale, source: "register" }, update: { status: "subscribed" } });
    }
    return { name: user.name };
  });
}

export async function customerLogoutAction() {
  return run(async () => destroySession("STOREFRONT"));
}

export async function forgotPasswordAction(input: { email: string; locale: string; scope: "STOREFRONT" | "ADMIN" }) {
  return run(async () => {
    const p = z.object({ email: z.string().trim().email(), locale: localeSchema, scope: z.enum(["STOREFRONT", "ADMIN"]) }).parse(input);
    await requestPasswordReset(p.email, p.scope, p.locale);
  });
}

export async function resetPasswordAction(input: { token: string; password: string }) {
  return run(async () => {
    const p = z.object({ token: z.string().min(20).max(200), password: z.string().min(1).max(256) }).parse(input);
    await resetPassword(p.token, p.password);
  });
}

// ─── Admin ──────────────────────────────────────────────────────────────────

export async function adminLoginAction(input: { email: string; password: string }) {
  return run(async () => adminLogin(credentials.parse(input)));
}

export async function adminVerifyOtpAction(code: string) {
  return run(async () => verifyAdminOtp(z.string().trim().min(4).max(12).parse(code)));
}

export async function adminResendOtpAction() {
  return run(async () => resendAdminOtp());
}

export async function adminLogoutAction() {
  return run(async () => destroySession("ADMIN"));
}

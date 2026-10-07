"use server";

import { z } from "zod";
import { db } from "@/server/db";
import { moderateReview, setCustomerStatus, adjustPoints, saveCoupon, deleteCoupon, customerDetail } from "@/server/admin/operations";
import { AppError } from "@/server/errors";
import { audit } from "@/server/audit";
import { bulkCoupons } from "@/server/admin/bulk";
import { adminRun } from "./_base";
import { idSchema } from "../helpers";

export async function moderateReviewAction(id: string, input: { status?: "APPROVED" | "REJECTED" | "SPAM" | "PENDING"; reply?: string | null; delete?: boolean }) {
  return adminRun("reviews.moderate", (s) =>
    moderateReview(idSchema.parse(id), z.object({ status: z.enum(["APPROVED", "REJECTED", "SPAM", "PENDING"]).optional(), reply: z.string().max(2000).nullable().optional(), delete: z.boolean().optional() }).parse(input), s),
  );
}

export async function bulkModerateAction(ids: string[], status: "APPROVED" | "REJECTED" | "SPAM") {
  return adminRun("reviews.moderate", async (s) => {
    for (const id of z.array(idSchema).max(200).parse(ids)) await moderateReview(id, { status: z.enum(["APPROVED", "REJECTED", "SPAM"]).parse(status) }, s);
  });
}

export async function setCustomerStatusAction(id: string, status: "ACTIVE" | "SUSPENDED") {
  return adminRun("customers.manage", (s) => setCustomerStatus(idSchema.parse(id), z.enum(["ACTIVE", "SUSPENDED"]).parse(status), s));
}

export async function adjustPointsAction(id: string, delta: number, note: string) {
  return adminRun("customers.manage", (s) => adjustPoints(idSchema.parse(id), z.number().int().min(-1_000_000).max(1_000_000).parse(delta), z.string().max(200).parse(note), s));
}

export async function saveCouponAction(id: string | null, input: unknown) {
  return adminRun("marketing.manage", (s) => saveCoupon(id ? idSchema.parse(id) : null, input, s));
}

export async function deleteCouponAction(id: string) {
  return adminRun("marketing.manage", (s) => deleteCoupon(idSchema.parse(id), s));
}

export async function unsubscribeAction(id: string) {
  return adminRun("marketing.manage", async (s) => {
    const sub = await db.newsletterSubscriber.update({ where: { id: idSchema.parse(id) }, data: { status: "unsubscribed", unsubscribedAt: new Date() } });
    await audit({ actor: s, action: "newsletter.unsubscribed", summary: sub.email });
  });
}

/** Customer profile for the customers drawer (loaded on demand). */
export async function customerDrawerAction(id: string, locale: string) {
  return adminRun(
    "customers.view",
    async (staff) => {
      const c = await customerDetail(idSchema.parse(id), staff, z.enum(["ar", "en"]).parse(locale));
      if (!c) throw new AppError("not_found", 404);
      return c;
    },
    { revalidate: false },
  );
}

export async function bulkCouponsAction(ids: string[], op: "activate" | "deactivate" | "delete") {
  return adminRun("marketing.manage", (s) => bulkCoupons(ids, op, s));
}

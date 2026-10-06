"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { db } from "@/server/db";
import { emit } from "@/server/events";
import { AppError, Errors } from "@/server/errors";
import { hashIp } from "@/server/crypto";
import { limitBy } from "@/server/rate-limit";
import { requestMeta } from "@/server/request";
import { getSettings } from "@/server/settings/service";
import { getCurrentUser } from "@/server/auth/session";
import { productCardsByIds } from "@/server/catalog/product";
import { searchSuggestions, recordSearch } from "@/server/catalog/taxonomy";
import { phoneSchema } from "@/server/commerce/checkout";
import { recordEvent } from "@/server/analytics/events";
import { idSchema, localeSchema, run } from "./helpers";

function limit(name: Parameters<typeof limitBy>[0], id: string) {
  const r = limitBy(name, id);
  if (!r.ok) throw Errors.rateLimited(r.retryAfterSec);
}

// ─── Wishlist ───────────────────────────────────────────────────────────────

/** Signed-in: persisted. Guests keep a local list (merged on sign-in). */
export async function toggleWishlistAction(productId: string, on: boolean) {
  return run(async () => {
    const id = idSchema.parse(productId);
    const user = await getCurrentUser();
    if (!user) return { persisted: false };
    if (on) {
      const exists = await db.product.count({ where: { id, status: "ACTIVE" } });
      if (!exists) throw Errors.notFound();
      await db.wishlistItem.upsert({ where: { userId_productId: { userId: user.id, productId: id } }, create: { userId: user.id, productId: id }, update: {} });
    } else {
      await db.wishlistItem.deleteMany({ where: { userId: user.id, productId: id } });
    }
    return { persisted: true };
  });
}

export async function mergeWishlistAction(productIds: string[]) {
  return run(async () => {
    const ids = z.array(idSchema).max(200).parse(productIds);
    const user = await getCurrentUser();
    if (!user) return [];
    const valid = await db.product.findMany({ where: { id: { in: ids }, status: "ACTIVE" }, select: { id: true } });
    await db.wishlistItem.createMany({ data: valid.map((v) => ({ userId: user.id, productId: v.id })), skipDuplicates: true });
    return (await db.wishlistItem.findMany({ where: { userId: user.id }, select: { productId: true } })).map((w) => w.productId);
  });
}

export async function productCardsAction(ids: string[], locale: string) {
  return run(async () => productCardsByIds(z.array(idSchema).max(24).parse(ids), localeSchema.parse(locale)));
}

// ─── Search ─────────────────────────────────────────────────────────────────

export async function suggestAction(q: string, locale: string) {
  return run(async () => {
    const meta = await requestMeta();
    limit("search", meta.ip ?? "unknown");
    const query = z.string().max(100).parse(q);
    const result = await searchSuggestions(query, localeSchema.parse(locale));
    return result;
  });
}

export async function logSearchAction(q: string, results: number) {
  return run(async () => {
    await recordSearch(z.string().max(100).parse(q), Math.max(0, Math.floor(results)));
    await recordEvent("SEARCH", { path: `/search?q=${encodeURIComponent(q.slice(0, 60))}` });
  });
}

// ─── Newsletter ─────────────────────────────────────────────────────────────

export async function subscribeAction(email: string, locale: string, source = "footer") {
  return run(async () => {
    const meta = await requestMeta();
    limit("newsletter", meta.ip ?? "unknown");
    const e = z.string().trim().toLowerCase().email().max(200).parse(email);
    await db.newsletterSubscriber.upsert({
      where: { email: e },
      create: { email: e, locale: localeSchema.parse(locale), source: source.slice(0, 40) },
      update: { status: "subscribed", unsubscribedAt: null },
    });
  });
}

// ─── Reviews ────────────────────────────────────────────────────────────────

const reviewSchema = z.object({
  productId: idSchema,
  rating: z.number().int().min(1).max(5),
  title: z.string().trim().max(120).optional(),
  body: z.string().trim().min(10).max(4000),
  locale: localeSchema,
});

/**
 * Only signed-in customers who bought (and received) the product may review:
 * every published review is a verified purchase — no fake reviews.
 */
export async function submitReviewAction(input: z.infer<typeof reviewSchema>) {
  return run(async () => {
    const user = await getCurrentUser();
    if (!user) throw Errors.unauthorized();
    limit("review", user.id);
    const p = reviewSchema.parse(input);
    const purchase = await db.orderItem.findFirst({
      where: { productId: p.productId, order: { userId: user.id, statusKey: { in: ["completed", "shipped"] } } },
      orderBy: { order: { placedAt: "desc" } },
    });
    if (!purchase) throw new AppError("review_not_purchased", 403);
    const existing = await db.review.findUnique({ where: { productId_userId: { productId: p.productId, userId: user.id } } });
    if (existing) throw new AppError("review_exists", 409);
    const parts = user.name.trim().split(/\s+/);
    const review = await db.review.create({
      data: {
        productId: p.productId,
        userId: user.id,
        orderItemId: purchase.id,
        authorName: parts.length > 1 ? `${parts[0]} ${parts[1][0]}.` : parts[0],
        rating: p.rating,
        title: p.title || null,
        body: p.body,
        isVerifiedPurchase: true,
        locale: p.locale,
      },
    });
    emit("REVIEW_CREATED", { reviewId: review.id });
  });
}

export async function reviewEligibilityAction(productId: string) {
  return run(async () => {
    const user = await getCurrentUser();
    if (!user) return { status: "login" as const };
    const id = idSchema.parse(productId);
    const [existing, purchase] = await Promise.all([
      db.review.findUnique({ where: { productId_userId: { productId: id, userId: user.id } } }),
      db.orderItem.count({ where: { productId: id, order: { userId: user.id, statusKey: { in: ["completed", "shipped"] } } } }),
    ]);
    if (existing) return { status: "reviewed" as const };
    return { status: purchase ? ("eligible" as const) : ("not_purchased" as const) };
  });
}

export async function reportReviewAction(reviewId: string, reason: string) {
  return run(async () => {
    const meta = await requestMeta();
    limit("reviewReport", meta.ip ?? "unknown");
    const id = idSchema.parse(reviewId);
    const ipHash = hashIp(meta.ip) ?? "unknown";
    const created = await db.reviewReport.createMany({ data: [{ reviewId: id, reason: z.string().max(200).parse(reason || "inappropriate"), ipHash }], skipDuplicates: true });
    if (created.count) await db.review.update({ where: { id }, data: { reportCount: { increment: 1 } } });
  });
}

export async function markHelpfulAction(reviewId: string) {
  return run(async () => {
    const meta = await requestMeta();
    limit("reviewReport", `helpful:${meta.ip}`);
    await db.review.update({ where: { id: idSchema.parse(reviewId) }, data: { helpfulCount: { increment: 1 } } });
  });
}

// ─── Contact ────────────────────────────────────────────────────────────────

export async function contactAction(input: { name: string; email: string; phone?: string; subject?: string; orderNumber?: string; message: string; locale: string; website?: string }) {
  return run(async () => {
    const meta = await requestMeta();
    limit("contact", meta.ip ?? "unknown");
    // Honeypot: real users never fill this hidden field.
    if (input.website) return;
    const cfg = (await getSettings("contact")).form;
    const opt = (mode: string, schema: z.ZodTypeAny) => (mode === "required" ? schema : mode === "optional" ? schema.optional().or(z.literal("")) : z.any().transform(() => undefined));
    const p = z
      .object({
        name: z.string().trim().min(2).max(100),
        email: z.string().trim().toLowerCase().email().max(200),
        phone: opt(cfg.phone, phoneSchema),
        subject: opt(cfg.subject, z.string().trim().min(2).max(160)),
        orderNumber: opt(cfg.orderNumber, z.string().trim().max(40)),
        message: z.string().trim().min(10).max(5000),
        locale: localeSchema,
      })
      .parse(input);
    const user = await getCurrentUser();
    const s = await db.contactSubmission.create({
      data: {
        name: p.name,
        email: p.email,
        phone: (p.phone as string | undefined) || null,
        subject: (p.subject as string | undefined) || null,
        message: p.message,
        extra: { locale: p.locale, orderNumber: (p.orderNumber as string | undefined) || undefined },
        userId: user?.id,
        ipHash: hashIp(meta.ip),
      },
    });
    emit("CONTACT_SUBMITTED", { submissionId: s.id });
  });
}

// ─── Analytics beacon ───────────────────────────────────────────────────────

export async function trackAction(type: "PAGE_VIEW" | "PRODUCT_VIEW" | "BEGIN_CHECKOUT", data: { productId?: string; path?: string } = {}) {
  return run(async () => {
    const meta = await requestMeta();
    const r = limitBy("analytics", meta.ip ?? "unknown");
    if (!r.ok) return;
    await recordEvent(type, { productId: data.productId ? idSchema.parse(data.productId) : undefined, path: data.path?.slice(0, 300) });
    if (type === "PRODUCT_VIEW" && data.productId) {
      const user = await getCurrentUser();
      await db.product.update({ where: { id: data.productId }, data: { viewCount: { increment: 1 } } }).catch(() => {});
      if (user) {
        await db.recentlyViewed.upsert({
          where: { userId_productId: { userId: user.id, productId: data.productId } },
          create: { userId: user.id, productId: data.productId },
          update: { viewedAt: new Date() },
        });
      }
    }
  });
}

export async function revalidateStoreAction() {
  revalidatePath("/", "layout");
}

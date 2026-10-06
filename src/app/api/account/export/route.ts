import { db } from "@/server/db";
import { getCurrentUser } from "@/server/auth/session";
import { getSettings } from "@/server/settings/service";

export const dynamic = "force-dynamic";

/** Data portability: everything we hold about the signed-in customer, as JSON. */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return new Response("Unauthorized", { status: 401 });
  if (!(await getSettings("privacy")).allowDataExport) return new Response("Forbidden", { status: 403 });
  const [addresses, orders, reviews, wishlist, points, conversations, notifications] = await Promise.all([
    db.address.findMany({ where: { userId: user.id } }),
    db.order.findMany({ where: { userId: user.id }, include: { items: true, history: true } }),
    db.review.findMany({ where: { userId: user.id } }),
    db.wishlistItem.findMany({ where: { userId: user.id }, include: { product: { select: { slug: true, name: true } } } }),
    db.pointsTransaction.findMany({ where: { userId: user.id } }),
    db.conversation.findMany({ where: { customerId: user.id }, include: { messages: true } }),
    db.notification.findMany({ where: { userId: user.id } }),
  ]);
  await db.dataRequest.create({ data: { userId: user.id, type: "EXPORT", status: "completed", processedAt: new Date() } });
  const body = JSON.stringify(
    {
      exportedAt: new Date().toISOString(),
      profile: { name: user.name, email: user.email, phone: user.phone, locale: user.locale, marketingOptIn: user.marketingOptIn, createdAt: user.createdAt, pointsBalance: user.pointsBalance },
      addresses,
      orders: orders.map(({ accessTokenHash: _a, ipHash: _i, ...o }) => o),
      reviews,
      wishlist,
      points,
      conversations,
      notifications,
    },
    null,
    2,
  );
  return new Response(body, {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="my-data-${new Date().toISOString().slice(0, 10)}.json"`,
      "Cache-Control": "no-store",
    },
  });
}

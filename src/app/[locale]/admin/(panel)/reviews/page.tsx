import { adminPage } from "@/server/admin/guard";
import { reviewList } from "@/server/admin/operations";
import { ReviewsView } from "@/components/admin/operations/reviews";
import { Forbidden } from "@/components/admin/ui";

export const metadata = { title: "Reviews" };

export default async function ReviewsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const { allowed, locale } = await adminPage("reviews.moderate");
  if (!allowed) return <Forbidden />;
  const sp = await searchParams;
  return <ReviewsView data={await reviewList({ status: sp.status, q: sp.q, page: Number(sp.page) || 1 }, locale)} />;
}

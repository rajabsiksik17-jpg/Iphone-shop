import { adminPage } from "@/server/admin/guard";
import { subscriberList } from "@/server/admin/operations";
import { NewsletterView } from "@/components/admin/operations/newsletter";
import { Forbidden } from "@/components/admin/ui";

export const metadata = { title: "Newsletter" };

export default async function NewsletterPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const { allowed } = await adminPage("marketing.manage");
  if (!allowed) return <Forbidden />;
  const sp = await searchParams;
  return <NewsletterView data={await subscriberList({ q: sp.q, status: sp.status, page: Number(sp.page) || 1 })} />;
}

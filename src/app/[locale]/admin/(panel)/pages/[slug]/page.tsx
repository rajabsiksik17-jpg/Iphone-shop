import { notFound } from "next/navigation";
import { adminPage } from "@/server/admin/guard";
import { pageEditorData } from "@/server/admin/content";
import { PageBuilder } from "@/components/admin/cms/builder";
import { Forbidden } from "@/components/admin/ui";

export const metadata = { title: "Page builder" };

export default async function PageBuilderPage({ params }: { params: Promise<{ slug: string }> }) {
  const { allowed, locale } = await adminPage("content.manage");
  if (!allowed) return <Forbidden />;
  const data = await pageEditorData((await params).slug, locale);
  if (!data) notFound();
  // Keyed by slug so navigating between pages resets the builder state.
  return <PageBuilder key={data.page?.id ?? "new"} data={data} />;
}

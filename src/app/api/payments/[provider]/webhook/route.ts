import { handleWebhook } from "@/server/payments/service";

export const dynamic = "force-dynamic";

/** Gateway webhooks. Signatures are verified by each provider adapter before anything is processed. */
export async function POST(req: Request, { params }: { params: Promise<{ provider: string }> }) {
  const { provider } = await params;
  const { status } = await handleWebhook(provider, req);
  return new Response(status === 200 ? "ok" : "rejected", { status });
}

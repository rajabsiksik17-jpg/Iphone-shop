import { NextResponse } from "next/server";
import { handleReturn } from "@/server/payments/service";
import { env } from "@/server/env";
import { isLocale } from "@/i18n/config";

export const dynamic = "force-dynamic";

/** Shopper lands here after the hosted payment page; we verify server-to-server, then redirect. */
export async function GET(req: Request, { params }: { params: Promise<{ provider: string }> }) {
  const { provider } = await params;
  const url = new URL(req.url);
  const order = url.searchParams.get("order") ?? "";
  const token = url.searchParams.get("token") ?? "";
  const locale = isLocale(url.searchParams.get("locale")) ? url.searchParams.get("locale")! : "ar";
  const result = order ? await handleReturn(provider, order, url.searchParams) : { status: "failed" as const };
  const dest = new URL(`/${locale}/order/${encodeURIComponent(order)}`, env().APP_URL);
  dest.searchParams.set("token", token);
  if (result.status !== "paid") dest.searchParams.set("payment", result.status);
  return NextResponse.redirect(dest, 303);
}

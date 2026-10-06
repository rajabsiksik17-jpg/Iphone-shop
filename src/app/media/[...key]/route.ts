import { storage, assertSafeKey } from "@/server/media/storage";

const TYPES: Record<string, string> = { webp: "image/webp", avif: "image/avif", jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", gif: "image/gif", pdf: "application/pdf" };

/** Serves uploaded media from storage with long-lived immutable caching (keys are content-unique). */
export async function GET(_req: Request, { params }: { params: Promise<{ key: string[] }> }) {
  const key = (await params).key.join("/");
  try {
    assertSafeKey(key);
  } catch {
    return new Response("Not found", { status: 404 });
  }
  const data = await storage().read(key);
  if (!data) return new Response("Not found", { status: 404 });
  const ext = key.split(".").pop()?.toLowerCase() ?? "";
  return new Response(new Uint8Array(data), {
    headers: {
      "Content-Type": TYPES[ext] ?? "application/octet-stream",
      "Cache-Control": "public, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; sandbox",
    },
  });
}

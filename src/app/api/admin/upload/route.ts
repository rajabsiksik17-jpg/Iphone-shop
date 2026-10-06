import { getCurrentStaff } from "@/server/auth/session";
import { processImage, MAX_UPLOAD_BYTES } from "@/server/media/images";
import { limitBy } from "@/server/rate-limit";
import { AppError } from "@/server/errors";
import { assertSameOrigin } from "@/server/auth/guards";
import { hasAnyPermission } from "@/config/permissions";

export const dynamic = "force-dynamic";

/**
 * Admin image upload. Authenticated + permission-checked + same-origin +
 * rate-limited; the file is validated by decoding it (never by its claimed
 * MIME type), re-encoded to WebP and stripped of metadata.
 */
export async function POST(req: Request) {
  try {
    assertSameOrigin(req);
  } catch {
    return Response.json({ error: "forbidden" }, { status: 403 });
  }
  const staff = await getCurrentStaff();
  if (!staff) return Response.json({ error: "unauthorized" }, { status: 401 });
  if (!hasAnyPermission(staff.permissions, ["catalog.edit", "content.manage", "settings.general", "marketing.manage"])) return Response.json({ error: "forbidden" }, { status: 403 });
  const lim = limitBy("upload", staff.id);
  if (!lim.ok) return Response.json({ error: "rate_limited" }, { status: 429 });

  const len = Number(req.headers.get("content-length") ?? 0);
  if (len > MAX_UPLOAD_BYTES + 64_000) return Response.json({ error: "file_too_large" }, { status: 413 });
  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) return Response.json({ error: "invalid_image" }, { status: 400 });
  const folder = String(form?.get("folder") ?? "uploads").replace(/[^a-z0-9-]/gi, "").slice(0, 30) || "uploads";
  try {
    const media = await processImage(Buffer.from(await file.arrayBuffer()), { folder, uploadedById: staff.id, alt: { en: file.name.replace(/\.[^.]+$/, "").slice(0, 120) } });
    return Response.json({ id: media.id, url: media.url, width: media.width, height: media.height });
  } catch (e) {
    if (e instanceof AppError) return Response.json({ error: e.code }, { status: e.status });
    console.error("[upload]", e);
    return Response.json({ error: "server_error" }, { status: 500 });
  }
}

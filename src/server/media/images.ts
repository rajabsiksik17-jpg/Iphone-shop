import "server-only";
import sharp, { type Metadata } from "sharp";
import { randomBytes } from "node:crypto";
import { db } from "../db";
import { AppError } from "../errors";
import { publicUrl, storage } from "./storage";

export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
const ALLOWED_FORMATS = new Set(["jpeg", "png", "webp", "avif", "gif", "tiff", "heif"]);
const RENDITION_WIDTHS = [320, 640, 960, 1280, 1920];
const MAX_DIMENSION = 2560;

export type Rendition = { w: number; url: string };

/**
 * Validate by *decoding* the bytes (never trusting the client MIME type or
 * extension), strip metadata (EXIF/GPS), auto-orient, and emit WebP
 * renditions plus a tiny blur placeholder. SVG is rejected (script risk).
 */
export async function processImage(input: Buffer, opts: { folder: string; alt?: Record<string, string>; uploadedById?: string; quality?: number }) {
  if (input.length > MAX_UPLOAD_BYTES) throw new AppError("file_too_large", 413);
  let meta: Metadata;
  try {
    meta = await sharp(input, { failOn: "error", limitInputPixels: 50_000_000 }).metadata();
  } catch {
    throw new AppError("invalid_image", 415);
  }
  if (!meta.format || !ALLOWED_FORMATS.has(meta.format)) throw new AppError("unsupported_image_type", 415);

  const base = sharp(input, { limitInputPixels: 50_000_000 }).rotate();
  const normalized = await base
    .resize({ width: MAX_DIMENSION, height: MAX_DIMENSION, fit: "inside", withoutEnlargement: true })
    .toBuffer({ resolveWithObject: true });
  const { width, height } = normalized.info;

  const id = `${Date.now().toString(36)}${randomBytes(5).toString("hex")}`;
  const folder = opts.folder.replace(/[^a-z0-9/-]/gi, "").replace(/^\/+|\/+$/g, "") || "uploads";
  const quality = opts.quality ?? 82;

  const mainKey = `${folder}/${id}.webp`;
  const main = await sharp(normalized.data).webp({ quality }).toBuffer();
  await storage().put(mainKey, main, "image/webp");

  const renditions: Rendition[] = [];
  for (const w of RENDITION_WIDTHS) {
    if (w >= width) break;
    const key = `${folder}/${id}-${w}.webp`;
    await storage().put(key, await sharp(normalized.data).resize({ width: w }).webp({ quality }).toBuffer(), "image/webp");
    renditions.push({ w, url: publicUrl(key) });
  }
  renditions.push({ w: width, url: publicUrl(mainKey) });

  const blur = await sharp(normalized.data).resize({ width: 16 }).webp({ quality: 40 }).toBuffer();

  return db.media.create({
    data: {
      key: mainKey,
      url: publicUrl(mainKey),
      mime: "image/webp",
      width,
      height,
      size: main.length,
      alt: opts.alt ?? {},
      renditions,
      blurDataUrl: `data:image/webp;base64,${blur.toString("base64")}`,
      uploadedById: opts.uploadedById,
    },
  });
}

export async function deleteMedia(id: string) {
  const m = await db.media.findUnique({ where: { id } });
  if (!m) return;
  // Rendition URLs are either /media/<key> (local) or …/object/public/<bucket>/<key> (Supabase).
  const keyOf = (url: string) => url.replace(/^\/media\//, "").replace(/^https?:\/\/[^/]+\/storage\/v1\/object\/public\/[^/]+\//, "");
  const keys = new Set([m.key, ...((m.renditions as Rendition[]) ?? []).map((r) => keyOf(r.url))]);
  await Promise.all([...keys].map((k) => storage().remove(k).catch(() => {})));
  await db.media.delete({ where: { id } });
}

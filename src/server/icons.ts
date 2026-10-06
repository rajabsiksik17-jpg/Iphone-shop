import "server-only";
import sanitizeHtml from "sanitize-html";
import { db } from "./db";
import { AppError } from "./errors";
import { parseIcon } from "@/components/icons/icon-value";

const MAX_SVG_BYTES = 30_000;

/**
 * Accept only a self-contained SVG drawing: no scripts, event handlers,
 * foreignObject, external references or embedded raster/data URLs.
 * Colours are normalised to `currentColor` so icons follow the theme.
 */
export function sanitizeSvgIcon(raw: string) {
  if (Buffer.byteLength(raw) > MAX_SVG_BYTES) throw new AppError("file_too_large", 413);
  if (!/<svg[\s>]/i.test(raw)) throw new AppError("invalid_image", 415);
  const clean = sanitizeHtml(raw, {
    allowedTags: ["svg", "g", "path", "circle", "ellipse", "rect", "line", "polyline", "polygon", "title", "defs", "clipPath"],
    allowedAttributes: {
      svg: ["viewbox", "viewBox", "width", "height", "fill", "stroke", "stroke-width", "stroke-linecap", "stroke-linejoin", "xmlns"],
      "*": ["d", "cx", "cy", "r", "rx", "ry", "x", "y", "x1", "x2", "y1", "y2", "width", "height", "points", "fill", "stroke", "stroke-width", "stroke-linecap", "stroke-linejoin", "fill-rule", "clip-rule", "transform", "opacity", "id", "clip-path"],
    },
    parser: { lowerCaseAttributeNames: false, lowerCaseTags: false },
    allowedSchemes: [],
  })
    .replace(/(fill|stroke)="(?!none|currentColor)[^"]*"/gi, '$1="currentColor"')
    .replace(/\s(width|height)="[^"]*"(?=[^>]*>)/, "");
  if (!/<svg[\s>]/i.test(clean) || !/<(path|circle|rect|polygon|polyline|line|ellipse)/i.test(clean)) throw new AppError("invalid_image", 415);
  return clean;
}

export async function createCustomIcon(name: string, svg: string) {
  return db.customIcon.create({ data: { name: name.slice(0, 60) || "Icon", svg: sanitizeSvgIcon(svg) } });
}

/** Resolve the custom SVGs referenced by a set of icon values (one query). */
export async function customSvgsFor(values: (string | null | undefined)[]) {
  const ids = [...new Set(values.map((v) => parseIcon(v)).filter((p): p is { kind: "custom"; id: string } => p?.kind === "custom").map((p) => p.id))];
  if (!ids.length) return {};
  const rows = await db.customIcon.findMany({ where: { id: { in: ids } } });
  return Object.fromEntries(rows.map((r) => [r.id, r.svg]));
}

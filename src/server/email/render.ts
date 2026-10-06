import sanitizeHtml from "sanitize-html";

/** HTML-escape a value for safe insertion into templates. */
export function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export type TemplateVars = Record<string, string | number | null | undefined>;
/** Variables whose values are pre-rendered trusted HTML (tables, buttons). */
export type HtmlBlocks = Record<string, string>;

/**
 * Replace {{variable}} placeholders. Regular variables are escaped; names
 * present in `blocks` are inserted as trusted HTML. Unknown names render empty.
 */
export function interpolate(template: string, vars: TemplateVars, blocks: HtmlBlocks = {}, escape = true): string {
  return template.replace(/\{\{\s*([a-z0-9_]+)\s*\}\}/gi, (_, name: string) => {
    if (name in blocks) return blocks[name];
    const v = vars[name];
    return escape ? escapeHtml(v) : String(v ?? "");
  });
}

/** Admin-authored template bodies are sanitised to a safe email subset. */
export function sanitizeTemplateHtml(html: string) {
  return sanitizeHtml(html, {
    allowedTags: ["p", "br", "strong", "b", "em", "i", "u", "a", "ul", "ol", "li", "h1", "h2", "h3", "blockquote", "hr", "span", "div", "table", "tr", "td", "th", "tbody", "thead"],
    allowedAttributes: { a: ["href", "target"], span: ["style"], div: ["style"], td: ["style", "align"], th: ["style", "align"], p: ["style"] },
    allowedSchemes: ["http", "https", "mailto", "tel"],
    allowedStyles: { "*": { color: [/^#[0-9a-f]{3,6}$/i], "text-align": [/^(left|right|center)$/], "font-weight": [/^\d+$|^bold$/] } },
  });
}

export function htmlToText(html: string) {
  return html
    .replace(/<\s*br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|h[1-6]|li|tr)>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function emailButton(label: string, url: string, color: string) {
  return `<table role="presentation" cellspacing="0" cellpadding="0" style="margin:24px 0"><tr><td style="border-radius:999px;background:${escapeHtml(color)}"><a href="${escapeHtml(url)}" style="display:inline-block;padding:12px 26px;color:#ffffff;text-decoration:none;font-weight:600;font-size:15px;border-radius:999px">${escapeHtml(label)}</a></td></tr></table>`;
}

export function emailLayout(opts: {
  dir: "rtl" | "ltr";
  storeName: string;
  logoUrl?: string;
  accent: string;
  body: string;
  footer: string;
  preheader?: string;
}) {
  const align = opts.dir === "rtl" ? "right" : "left";
  const logo = opts.logoUrl
    ? `<img src="${escapeHtml(opts.logoUrl)}" alt="${escapeHtml(opts.storeName)}" height="32" style="height:32px;border:0">`
    : `<span style="font-size:20px;font-weight:700;letter-spacing:-0.02em;color:#0b1220">${escapeHtml(opts.storeName)}<span style="color:${escapeHtml(opts.accent)}">.</span></span>`;
  return `<!doctype html><html dir="${opts.dir}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><meta name="color-scheme" content="light"></head>
<body style="margin:0;padding:0;background:#f4f5f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Tahoma,Arial,sans-serif;color:#0b1220">
<span style="display:none;max-height:0;overflow:hidden">${escapeHtml(opts.preheader ?? "")}</span>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f4f5f7;padding:32px 12px"><tr><td align="center">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #e8eaee">
<tr><td style="padding:28px 32px;border-bottom:1px solid #f0f1f4;text-align:${align}">${logo}</td></tr>
<tr><td dir="${opts.dir}" style="padding:32px;font-size:15px;line-height:1.65;text-align:${align}">${opts.body}</td></tr>
<tr><td style="padding:20px 32px;background:#fafbfc;color:#6b7280;font-size:12px;line-height:1.6;text-align:${align}">${opts.footer}</td></tr>
</table></td></tr></table></body></html>`;
}

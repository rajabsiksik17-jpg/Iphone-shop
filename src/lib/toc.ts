export type TocEntry = { id: string; title: string };

const decode = (s: string) =>
  s
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim();

/**
 * Give every <h2> in (already sanitised) HTML a stable anchor id and return the
 * table of contents. Ids are positional ("section-3") so they work for any
 * language and survive heading edits that don't reorder sections.
 */
export function withHeadingAnchors(html: string, start = 0): { html: string; toc: TocEntry[] } {
  const toc: TocEntry[] = [];
  let n = start;
  const out = html.replace(/<h2(\s[^>]*)?>([\s\S]*?)<\/h2>/gi, (_m, attrs: string | undefined, inner: string) => {
    const id = `section-${++n}`;
    const title = decode(inner);
    if (title) toc.push({ id, title });
    const rest = (attrs ?? "").replace(/\sid="[^"]*"/i, "");
    return `<h2 id="${id}"${rest}>${inner}</h2>`;
  });
  return { html: out, toc };
}

import "server-only";
import sanitizeHtml from "sanitize-html";

/** Rich text from admins (product descriptions, CMS text): safe formatting only. */
export function sanitizeRich(html: string) {
  return sanitizeHtml(html, {
    allowedTags: ["p", "br", "strong", "b", "em", "i", "u", "s", "a", "ul", "ol", "li", "h2", "h3", "h4", "blockquote", "hr", "span", "table", "thead", "tbody", "tr", "td", "th", "img", "figure", "figcaption", "code", "pre", "sup", "sub"],
    allowedAttributes: { a: ["href", "target", "rel"], img: ["src", "alt", "width", "height", "loading"], td: ["colspan", "rowspan"], th: ["colspan", "rowspan"], "*": ["dir", "lang"] },
    allowedSchemes: ["http", "https", "mailto", "tel"],
    allowedSchemesByTag: { img: ["http", "https", "data"] },
    transformTags: {
      a: (tag, attribs) => ({ tagName: "a", attribs: { ...attribs, ...(attribs.target === "_blank" ? { rel: "noopener noreferrer" } : {}) } }),
      img: (tag, attribs) => ({ tagName: "img", attribs: { ...attribs, loading: "lazy" } }),
    },
  });
}

/** "Custom HTML" sections: broader layout markup, still no scripts/handlers/iframes except trusted embeds. */
export function sanitizeCustom(html: string) {
  return sanitizeHtml(html, {
    allowedTags: sanitizeHtml.defaults.allowedTags.concat(["img", "section", "header", "footer", "article", "aside", "figure", "figcaption", "iframe", "video", "source", "picture", "svg", "path"]),
    allowedAttributes: {
      "*": ["class", "id", "style", "dir", "lang", "aria-label", "role"],
      a: ["href", "target", "rel"],
      img: ["src", "alt", "width", "height", "loading", "srcset", "sizes"],
      iframe: ["src", "width", "height", "allow", "allowfullscreen", "title", "loading"],
      video: ["src", "controls", "muted", "loop", "playsinline", "poster", "autoplay"],
      source: ["src", "type", "srcset", "media"],
      svg: ["viewBox", "width", "height", "fill", "xmlns"],
      path: ["d", "fill", "stroke", "stroke-width"],
    },
    allowedIframeHostnames: ["www.youtube-nocookie.com", "player.vimeo.com", "www.google.com", "www.openstreetmap.org"],
    allowedSchemes: ["http", "https", "mailto", "tel"],
  });
}

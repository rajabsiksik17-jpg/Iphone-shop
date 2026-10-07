/**
 * Store information pages that other parts of the app link to (checkout,
 * registration, footer, cookie banner). They are system CMS pages — editable
 * in Admin → Pages, but their slugs are locked so these links never break.
 */
export const LEGAL_PATHS = {
  privacy: "/privacy-policy",
  terms: "/terms-and-conditions",
  returns: "/refund-policy",
  shipping: "/shipping-policy",
  cookies: "/cookie-policy",
} as const;

/** Old slugs → current ones (kept as permanent redirects). */
export const LEGACY_PAGE_SLUGS: Record<string, string> = {
  privacy: "privacy-policy",
  terms: "terms-and-conditions",
  cookies: "cookie-policy",
};

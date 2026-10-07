/**
 * Hero banner proportions per device, shared by the storefront slider and the
 * admin previews so what the admin sees is what shoppers get. Every device is
 * landscape — on phones the banner stays compact instead of filling the screen.
 */
export const HERO_RATIO = {
  mobile: 16 / 11,
  tablet: 2,
  desktop: { md: 8 / 3, lg: 16 / 7 },
} as const;

/** Recommended upload sizes (2× the largest rendered size) for the admin hints. */
export const HERO_UPLOAD = {
  desktop: "2400 × 900",
  tablet: "1600 × 800",
  mobile: "1200 × 825",
} as const;

export type HeroDevice = "desktop" | "tablet" | "mobile";

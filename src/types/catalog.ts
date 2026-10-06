/** Serializable shapes passed from server to client components. */

export type ImageDTO = {
  url: string;
  alt: string;
  width: number | null;
  height: number | null;
  blur: string | null;
  srcSet: { w: number; url: string }[];
};

export type PriceDTO = {
  regular: number;
  current: number;
  onSale: boolean;
  percent: number;
  savings: number;
  /** Variable products: lowest/highest current price. */
  min: number;
  max: number;
  saleEndsAt: string | null;
};

export type BadgeKey = "new" | "sale" | "bestSeller" | "limited" | "lowStock" | "outOfStock" | "preorder";

export type ProductCardDTO = {
  id: string;
  slug: string;
  name: string;
  brand: { name: string; slug: string } | null;
  image: ImageDTO | null;
  hoverImage: ImageDTO | null;
  price: PriceDTO;
  rating: number;
  ratingCount: number;
  stockStatus: "IN_STOCK" | "LOW_STOCK" | "OUT_OF_STOCK" | "BACKORDER" | "PREORDER";
  badges: BadgeKey[];
  isVariable: boolean;
  /** Present when a single-click add-to-cart is possible. */
  quickAdd: boolean;
  swatches: { label: string; hex: string; image: ImageDTO | null }[];
  /** For analytics events. */
  category: string | null;
};

export type FacetValue = { slug: string; label: string; count: number; hex?: string | null };
export type Facet = { key: string; label: string; type: "SELECT" | "MULTISELECT" | "COLOR" | "BOOLEAN" | "TEXT" | "NUMBER"; unit?: string | null; values: FacetValue[] };

export type ListingFacets = {
  brands: FacetValue[];
  categories: { slug: string; fullSlug: string; label: string; count: number }[];
  attributes: Facet[];
  price: { min: number; max: number };
  ratings: { stars: number; count: number }[];
  availability: { inStock: number; onSale: number };
};

export type ListingResult = {
  items: ProductCardDTO[];
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
  facets: ListingFacets;
};

export type SortKey = "featured" | "newest" | "oldest" | "price_asc" | "price_desc" | "rating" | "best_selling" | "discount" | "relevance";
export const SORT_KEYS: SortKey[] = ["featured", "relevance", "newest", "best_selling", "price_asc", "price_desc", "rating", "discount", "oldest"];

export type ListingQuery = {
  q?: string;
  categoryPath?: string; // materialised path of the category scope
  categoryId?: string;
  brandSlugs?: string[];
  brandId?: string;
  attributes?: Record<string, string[]>;
  minPrice?: number;
  maxPrice?: number;
  inStock?: boolean;
  onSale?: boolean;
  flags?: ("new" | "featured" | "bestSeller")[];
  minRating?: number;
  sort?: SortKey;
  page?: number;
  pageSize?: number;
  ids?: string[];
};

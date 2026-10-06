-- Search index v2 (see src/lib/search-text.ts):
--   searchTitle    normalized product name (all locales) — exact/prefix boosts
--   searchBrand    normalized brand name(s)
--   searchPhonetic script-independent phonetic keys (Arabic ↔ English, typos)
-- searchText stays the full normalized document (categories, specs, SKUs…).
ALTER TABLE "Product" ADD COLUMN "searchTitle" TEXT NOT NULL DEFAULT '';
ALTER TABLE "Product" ADD COLUMN "searchBrand" TEXT NOT NULL DEFAULT '';
ALTER TABLE "Product" ADD COLUMN "searchPhonetic" TEXT NOT NULL DEFAULT '';
CREATE INDEX "Product_searchTitle_trgm_idx" ON "Product" USING GIN ("searchTitle" gin_trgm_ops);
CREATE INDEX "Product_searchPhonetic_trgm_idx" ON "Product" USING GIN ("searchPhonetic" gin_trgm_ops);

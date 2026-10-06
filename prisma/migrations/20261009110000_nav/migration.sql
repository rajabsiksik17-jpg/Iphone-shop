-- Navigation v2: automatic mega-menu items and richer menu entries.
ALTER TYPE "MenuItemType" ADD VALUE IF NOT EXISTS 'ALL_CATEGORIES';
ALTER TYPE "MenuItemType" ADD VALUE IF NOT EXISTS 'ALL_BRANDS';

ALTER TABLE "MenuItem" ADD COLUMN "icon" TEXT;
ALTER TABLE "MenuItem" ADD COLUMN "image" TEXT;
-- Short label shown as a pill next to the item ("New", "Sale"…).
ALTER TABLE "MenuItem" ADD COLUMN "badge" JSONB NOT NULL DEFAULT '{}';
-- Category items fill their dropdown from the category tree automatically
-- (new subcategories appear without editing the menu) unless children are set.
ALTER TABLE "MenuItem" ADD COLUMN "autoChildren" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "MenuItem" ADD COLUMN "isVisible" BOOLEAN NOT NULL DEFAULT true;

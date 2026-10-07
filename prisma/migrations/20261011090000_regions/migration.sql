-- Cities / governorates per country, per-city delivery pricing, and
-- country/city targeting for coupons and promotions.
CREATE TABLE "Region" (
  "id" TEXT NOT NULL,
  "country" CHAR(2) NOT NULL,
  "name" JSONB NOT NULL,
  "group" JSONB NOT NULL DEFAULT '{}',
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "position" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Region_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "Region_country_position_idx" ON "Region"("country", "position");

CREATE TABLE "ShippingRegionRate" (
  "methodId" TEXT NOT NULL,
  "regionId" TEXT NOT NULL,
  "isAvailable" BOOLEAN NOT NULL DEFAULT true,
  "cost" INTEGER,
  "freeOver" INTEGER,
  "minDays" INTEGER,
  "maxDays" INTEGER,
  CONSTRAINT "ShippingRegionRate_pkey" PRIMARY KEY ("methodId", "regionId")
);
CREATE INDEX "ShippingRegionRate_regionId_idx" ON "ShippingRegionRate"("regionId");
ALTER TABLE "ShippingRegionRate" ADD CONSTRAINT "ShippingRegionRate_methodId_fkey" FOREIGN KEY ("methodId") REFERENCES "ShippingMethod"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ShippingRegionRate" ADD CONSTRAINT "ShippingRegionRate_regionId_fkey" FOREIGN KEY ("regionId") REFERENCES "Region"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- A method can be limited to the cities it's explicitly enabled for (e.g. express in 3 cities).
ALTER TABLE "ShippingMethod" ADD COLUMN "limitToRegions" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "Coupon" ADD COLUMN "countries" TEXT[] DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "Coupon" ADD COLUMN "regionIds" TEXT[] DEFAULT ARRAY[]::TEXT[];

ALTER TABLE "Address" ADD COLUMN "regionId" TEXT;
ALTER TABLE "Cart" ADD COLUMN "country" CHAR(2);
ALTER TABLE "Cart" ADD COLUMN "regionId" TEXT;

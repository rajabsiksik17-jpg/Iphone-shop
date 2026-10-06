-- "Key spec" attributes are shown as icon tiles at the top of the product page.
ALTER TABLE "Attribute" ADD COLUMN "isHighlighted" BOOLEAN NOT NULL DEFAULT false;

UPDATE "Attribute" SET "isHighlighted" = true
WHERE "key" IN ('screen-size', 'processor', 'main-camera', 'battery', 'anc', 'capacity', 'wattage', 'water-resistance');

-- Attributes shown as compact specs on product cards (e.g. storage & RAM for
-- phones, size for fashion) — chosen per store type, editable per attribute.
ALTER TABLE "Attribute" ADD COLUMN "showOnCard" BOOLEAN NOT NULL DEFAULT false;

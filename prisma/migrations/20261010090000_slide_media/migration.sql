-- Hero slides: a tablet image between desktop and mobile, and optional
-- per-language artwork (e.g. Arabic text baked into a banner).
ALTER TABLE "Slide" ADD COLUMN "tabletImageId" TEXT;
ALTER TABLE "Slide" ADD COLUMN "localeImages" JSONB NOT NULL DEFAULT '{}';
ALTER TABLE "Slide" ADD CONSTRAINT "Slide_tabletImageId_fkey" FOREIGN KEY ("tabletImageId") REFERENCES "Media"("id") ON DELETE SET NULL ON UPDATE CASCADE;

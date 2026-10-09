-- Store-type profiles: switching store type keeps every type's catalog,
-- homepage and presentation in place (rows are tagged with their profile and
-- the active profile is selected), instead of overwriting shared tables.
-- Purely additive; existing rows are assigned to the currently active type.

CREATE TYPE "RecordSource" AS ENUM ('MERCHANT', 'DEMO', 'IMPORTED');

ALTER TABLE "Brand" ADD COLUMN "profile" TEXT, ADD COLUMN "source" "RecordSource" NOT NULL DEFAULT 'MERCHANT', ADD COLUMN "templateRef" TEXT;
ALTER TABLE "Category" ADD COLUMN "profile" TEXT, ADD COLUMN "source" "RecordSource" NOT NULL DEFAULT 'MERCHANT', ADD COLUMN "templateRef" TEXT;
ALTER TABLE "Product" ADD COLUMN "profile" TEXT, ADD COLUMN "source" "RecordSource" NOT NULL DEFAULT 'MERCHANT', ADD COLUMN "templateRef" TEXT;
ALTER TABLE "Media" ADD COLUMN "templateRef" TEXT;
ALTER TABLE "PageSection" ADD COLUMN "profile" TEXT, ADD COLUMN "templateRef" TEXT;
ALTER TABLE "Slider" ADD COLUMN "profile" TEXT, ADD COLUMN "templateRef" TEXT;

CREATE UNIQUE INDEX "Brand_templateRef_key" ON "Brand"("templateRef");
CREATE UNIQUE INDEX "Category_templateRef_key" ON "Category"("templateRef");
CREATE UNIQUE INDEX "Product_templateRef_key" ON "Product"("templateRef");
CREATE UNIQUE INDEX "Media_templateRef_key" ON "Media"("templateRef");
CREATE UNIQUE INDEX "PageSection_templateRef_key" ON "PageSection"("templateRef");
CREATE UNIQUE INDEX "Slider_templateRef_key" ON "Slider"("templateRef");
CREATE INDEX "Brand_profile_idx" ON "Brand"("profile");
CREATE INDEX "Category_profile_idx" ON "Category"("profile");
CREATE INDEX "Product_profile_status_idx" ON "Product"("profile", "status");
CREATE INDEX "PageSection_profile_idx" ON "PageSection"("profile");

CREATE TABLE "StoreProfile" (
    "key" TEXT NOT NULL,
    "isCustom" BOOLEAN NOT NULL DEFAULT false,
    "name" JSONB NOT NULL DEFAULT '{}',
    "description" JSONB NOT NULL DEFAULT '{}',
    "icon" TEXT,
    "definition" JSONB NOT NULL DEFAULT '{}',
    "overrides" JSONB NOT NULL DEFAULT '{}',
    "templateVersion" INTEGER NOT NULL DEFAULT 0,
    "initializedAt" TIMESTAMP(3),
    "activatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "StoreProfile_pkey" PRIMARY KEY ("key")
);
ALTER TABLE "StoreProfile" ENABLE ROW LEVEL SECURITY;

-- Existing data belongs to the store type that is active today.
DO $$
DECLARE
  active TEXT := COALESCE((SELECT "value"->>'type' FROM "Setting" WHERE "key" = 'storeType'), 'electronics');
BEGIN
  UPDATE "Product" SET "profile" = active WHERE "profile" IS NULL;
  UPDATE "Category" SET "profile" = active WHERE "profile" IS NULL;
  UPDATE "Brand" SET "profile" = active WHERE "profile" IS NULL;
  UPDATE "Slider" SET "profile" = active WHERE "profile" IS NULL;
  UPDATE "PageSection" s SET "profile" = active FROM "Page" p WHERE p."id" = s."pageId" AND p."slug" = 'home' AND s."profile" IS NULL;
  INSERT INTO "StoreProfile" ("key", "initializedAt", "activatedAt", "updatedAt")
  VALUES (active, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
  ON CONFLICT ("key") DO NOTHING;
END $$;

-- Defence in depth for the super-admin (the app enforces the same rules):
-- the last active super-admin can't be deleted, demoted or suspended, and
-- the super-admin role can't lose its wildcard — whoever issues the query.
CREATE OR REPLACE FUNCTION public.nq_is_super_role(role_id TEXT) RETURNS BOOLEAN
LANGUAGE sql STABLE AS $$
  SELECT EXISTS (SELECT 1 FROM "Role" WHERE "id" = role_id AND '*' = ANY("permissions"));
$$;

CREATE OR REPLACE FUNCTION public.nq_protect_super_admin() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF OLD."type" = 'STAFF' AND OLD."status" = 'ACTIVE' AND public.nq_is_super_role(OLD."roleId") THEN
    IF TG_OP = 'DELETE' OR NEW."roleId" IS DISTINCT FROM OLD."roleId" OR NEW."status" <> 'ACTIVE' OR NEW."type" <> 'STAFF' THEN
      IF NOT EXISTS (
        SELECT 1 FROM "User" u
        WHERE u."id" <> OLD."id" AND u."type" = 'STAFF' AND u."status" = 'ACTIVE' AND public.nq_is_super_role(u."roleId")
      ) THEN
        RAISE EXCEPTION 'last_super_admin' USING ERRCODE = 'P0001';
      END IF;
    END IF;
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS nq_protect_super_admin ON "User";
CREATE TRIGGER nq_protect_super_admin BEFORE UPDATE OR DELETE ON "User"
FOR EACH ROW EXECUTE FUNCTION public.nq_protect_super_admin();

CREATE OR REPLACE FUNCTION public.nq_protect_super_role() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF OLD."key" = 'super_admin' THEN
    IF TG_OP = 'DELETE' OR NOT ('*' = ANY(NEW."permissions")) OR NEW."key" <> 'super_admin' THEN
      RAISE EXCEPTION 'super_admin_locked' USING ERRCODE = 'P0001';
    END IF;
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS nq_protect_super_role ON "Role";
CREATE TRIGGER nq_protect_super_role BEFORE UPDATE OR DELETE ON "Role"
FOR EACH ROW EXECUTE FUNCTION public.nq_protect_super_role();

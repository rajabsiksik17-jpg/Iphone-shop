-- Exchange-rate metadata: rates are refreshed from a provider unless an admin
-- pins a manual rate; the flag country drives the currency selector.
ALTER TABLE "Currency" ADD COLUMN "flag" CHAR(2);
ALTER TABLE "Currency" ADD COLUMN "autoRate" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "Currency" ADD COLUMN "rateUpdatedAt" TIMESTAMP(3);

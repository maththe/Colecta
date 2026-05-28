-- Add tenantUuid columns (nullable for backfill)
ALTER TABLE "trash_bins" ADD COLUMN "tenantUuid" TEXT;
ALTER TABLE "sensor_readings" ADD COLUMN "tenantUuid" TEXT;
ALTER TABLE "tasks" ADD COLUMN "tenantUuid" TEXT;

-- Backfill existing rows with a sentinel tenant (operator can reassign later)
UPDATE "trash_bins" SET "tenantUuid" = '00000000-0000-0000-0000-000000000000' WHERE "tenantUuid" IS NULL;
UPDATE "sensor_readings" SET "tenantUuid" = '00000000-0000-0000-0000-000000000000' WHERE "tenantUuid" IS NULL;
UPDATE "tasks" SET "tenantUuid" = '00000000-0000-0000-0000-000000000000' WHERE "tenantUuid" IS NULL;

-- Enforce NOT NULL
ALTER TABLE "trash_bins" ALTER COLUMN "tenantUuid" SET NOT NULL;
ALTER TABLE "sensor_readings" ALTER COLUMN "tenantUuid" SET NOT NULL;
ALTER TABLE "tasks" ALTER COLUMN "tenantUuid" SET NOT NULL;

-- TrashBin.code is now unique per tenant, not globally
DROP INDEX "trash_bins_code_key";
CREATE UNIQUE INDEX "trash_bins_tenantUuid_code_key" ON "trash_bins"("tenantUuid", "code");

-- Lookup indexes
CREATE INDEX "trash_bins_tenantUuid_idx" ON "trash_bins"("tenantUuid");
CREATE INDEX "sensor_readings_tenantUuid_receivedAt_idx" ON "sensor_readings"("tenantUuid", "receivedAt");
CREATE INDEX "tasks_tenantUuid_idx" ON "tasks"("tenantUuid");

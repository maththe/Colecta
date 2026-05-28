CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE "locations" (
    "id" UUID NOT NULL,
    "tenantUuid" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "sourceTrashBinId" UUID,

    CONSTRAINT "locations_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "locations_tenantUuid_idx" ON "locations"("tenantUuid");
CREATE INDEX "locations_tenantUuid_name_idx" ON "locations"("tenantUuid", "name");

ALTER TABLE "trash_bins" ADD COLUMN "locationId" UUID;

INSERT INTO "locations" (
    "id",
    "tenantUuid",
    "name",
    "description",
    "latitude",
    "longitude",
    "createdAt",
    "updatedAt",
    "sourceTrashBinId"
)
SELECT
    gen_random_uuid(),
    "tenantUuid",
    COALESCE(NULLIF("locationDescription", ''), "name"),
    "locationDescription",
    "latitude",
    "longitude",
    "createdAt",
    "updatedAt",
    "id"
FROM "trash_bins";

UPDATE "trash_bins" AS bin
SET "locationId" = location."id"
FROM "locations" AS location
WHERE location."sourceTrashBinId" = bin."id";

ALTER TABLE "locations" DROP COLUMN "sourceTrashBinId";
ALTER TABLE "trash_bins" ALTER COLUMN "locationId" SET NOT NULL;

ALTER TABLE "trash_bins" DROP COLUMN "locationDescription";
ALTER TABLE "trash_bins" DROP COLUMN "latitude";
ALTER TABLE "trash_bins" DROP COLUMN "longitude";

CREATE INDEX "trash_bins_locationId_idx" ON "trash_bins"("locationId");

ALTER TABLE "trash_bins"
ADD CONSTRAINT "trash_bins_locationId_fkey"
FOREIGN KEY ("locationId") REFERENCES "locations"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

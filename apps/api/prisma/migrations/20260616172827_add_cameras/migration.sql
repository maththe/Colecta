-- CreateEnum
CREATE TYPE "CameraStatus" AS ENUM ('online', 'offline', 'maintenance');

-- CreateTable
CREATE TABLE "cameras" (
    "id" UUID NOT NULL,
    "tenantUuid" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" "CameraStatus" NOT NULL DEFAULT 'online',
    "model" TEXT NOT NULL,
    "ipAddress" TEXT NOT NULL,
    "resolution" TEXT NOT NULL,
    "fps" INTEGER NOT NULL,
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "imageUrl" TEXT,
    "notes" TEXT,
    "lastSeenAt" TIMESTAMP(3),
    "locationId" UUID,
    "trashBinId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cameras_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "cameras_tenantUuid_idx" ON "cameras"("tenantUuid");

-- CreateIndex
CREATE INDEX "cameras_locationId_idx" ON "cameras"("locationId");

-- CreateIndex
CREATE INDEX "cameras_trashBinId_idx" ON "cameras"("trashBinId");

-- CreateIndex
CREATE INDEX "cameras_status_idx" ON "cameras"("status");

-- CreateIndex
CREATE UNIQUE INDEX "cameras_tenantUuid_code_key" ON "cameras"("tenantUuid", "code");

-- AddForeignKey
ALTER TABLE "cameras" ADD CONSTRAINT "cameras_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "locations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cameras" ADD CONSTRAINT "cameras_trashBinId_fkey" FOREIGN KEY ("trashBinId") REFERENCES "trash_bins"("id") ON DELETE SET NULL ON UPDATE CASCADE;


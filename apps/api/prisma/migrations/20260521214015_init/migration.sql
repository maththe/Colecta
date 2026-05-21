-- CreateEnum
CREATE TYPE "TrashBinStatus" AS ENUM ('active', 'inactive', 'full', 'maintenance', 'offline');

-- CreateEnum
CREATE TYPE "TaskStatus" AS ENUM ('pending', 'in_progress', 'done', 'cancelled');

-- CreateEnum
CREATE TYPE "TaskPriority" AS ENUM ('low', 'medium', 'high', 'urgent');

-- CreateTable
CREATE TABLE "trash_bins" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "locationDescription" TEXT,
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "capacityLiters" INTEGER NOT NULL,
    "status" "TrashBinStatus" NOT NULL DEFAULT 'active',
    "fillLevel" INTEGER,
    "batteryLevel" INTEGER,
    "lastSeenAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "trash_bins_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sensor_readings" (
    "id" UUID NOT NULL,
    "trashBinId" UUID NOT NULL,
    "fillLevel" INTEGER NOT NULL,
    "batteryLevel" INTEGER,
    "temperature" DOUBLE PRECISION,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "payload" JSONB,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sensor_readings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tasks" (
    "id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" "TaskStatus" NOT NULL DEFAULT 'pending',
    "priority" "TaskPriority" NOT NULL DEFAULT 'medium',
    "trashBinId" UUID,
    "assigneeName" TEXT,
    "dueDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tasks_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "trash_bins_code_key" ON "trash_bins"("code");

-- CreateIndex
CREATE INDEX "sensor_readings_trashBinId_receivedAt_idx" ON "sensor_readings"("trashBinId", "receivedAt");

-- AddForeignKey
ALTER TABLE "sensor_readings" ADD CONSTRAINT "sensor_readings_trashBinId_fkey" FOREIGN KEY ("trashBinId") REFERENCES "trash_bins"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_trashBinId_fkey" FOREIGN KEY ("trashBinId") REFERENCES "trash_bins"("id") ON DELETE SET NULL ON UPDATE CASCADE;

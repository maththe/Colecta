-- AlterTable
ALTER TABLE "locations" ADD COLUMN     "floorsCount" INTEGER,
ADD COLUMN     "isBuilding" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "trash_bins" ADD COLUMN     "floor" TEXT,
ADD COLUMN     "posX" DOUBLE PRECISION,
ADD COLUMN     "posY" DOUBLE PRECISION;

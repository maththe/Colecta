-- AlterTable
ALTER TABLE "tasks" ADD COLUMN     "cameraId" UUID;

-- CreateIndex
CREATE INDEX "tasks_cameraId_idx" ON "tasks"("cameraId");

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_cameraId_fkey" FOREIGN KEY ("cameraId") REFERENCES "cameras"("id") ON DELETE SET NULL ON UPDATE CASCADE;


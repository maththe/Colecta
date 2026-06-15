-- CreateEnum
CREATE TYPE "TaskKind" AS ENUM ('manual', 'auto');

-- AlterTable
ALTER TABLE "tasks" ADD COLUMN     "issues" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "kind" "TaskKind" NOT NULL DEFAULT 'manual';

-- CreateIndex
CREATE INDEX "tasks_tenantUuid_trashBinId_kind_status_idx" ON "tasks"("tenantUuid", "trashBinId", "kind", "status");

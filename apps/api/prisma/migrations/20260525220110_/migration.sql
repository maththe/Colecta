-- CreateIndex
CREATE INDEX "tasks_status_idx" ON "tasks"("status");

-- CreateIndex
CREATE INDEX "tasks_trashBinId_idx" ON "tasks"("trashBinId");

-- CreateIndex
CREATE INDEX "trash_bins_status_idx" ON "trash_bins"("status");

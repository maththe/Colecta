ALTER TABLE "tasks" ADD COLUMN "locationId" UUID;

CREATE INDEX "tasks_locationId_idx" ON "tasks"("locationId");

ALTER TABLE "tasks"
ADD CONSTRAINT "tasks_locationId_fkey"
FOREIGN KEY ("locationId") REFERENCES "locations"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

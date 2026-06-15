ALTER TABLE "tasks" ADD COLUMN "assigneeRole" "UserRole";

UPDATE "tasks" AS t
SET "assigneeRole" = u."role"
FROM "users" AS u
WHERE t."assigneeRole" IS NULL
  AND t."tenantUuid" = u."tenantUuid"
  AND t."assigneeName" IS NOT NULL
  AND lower(t."assigneeName") = lower(u."name")
  AND u."role" <> 'ADMIN'::"UserRole";

UPDATE "tasks"
SET "assigneeRole" = 'LIMPEZA'
WHERE "assigneeRole" IS NULL;

ALTER TABLE "tasks" ALTER COLUMN "assigneeRole" SET NOT NULL;

CREATE INDEX "tasks_assigneeRole_idx" ON "tasks"("assigneeRole");

-- Apaga eventuais notificações que ainda referenciem task_mention,
-- para o ALTER TYPE seguinte não falhar.
DELETE FROM "notifications" WHERE "kind" = 'task_mention';

DROP TABLE "task_comments";

ALTER TYPE "NotificationKind" RENAME TO "NotificationKind_old";
CREATE TYPE "NotificationKind" AS ENUM ('task_assigned', 'task_urgent', 'task_overdue', 'task_done', 'task_auto');
ALTER TABLE "notifications" ALTER COLUMN "kind" TYPE "NotificationKind" USING ("kind"::text::"NotificationKind");
DROP TYPE "NotificationKind_old";

#!/usr/bin/env sh
(
set -eu

MIGRATIONS_DIR="/colecta-prisma-migrations"

if [ ! -d "$MIGRATIONS_DIR" ]; then
  echo "Prisma migrations directory not found: $MIGRATIONS_DIR"
  exit 1
fi

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<'SQL'
CREATE TABLE IF NOT EXISTS "_prisma_migrations" (
    "id" VARCHAR(36) NOT NULL PRIMARY KEY,
    "checksum" VARCHAR(64) NOT NULL,
    "finished_at" TIMESTAMPTZ,
    "migration_name" VARCHAR(255) NOT NULL,
    "logs" TEXT,
    "rolled_back_at" TIMESTAMPTZ,
    "started_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
    "applied_steps_count" INTEGER NOT NULL DEFAULT 0
);
SQL

for migration_sql in "$MIGRATIONS_DIR"/*/migration.sql; do
  [ -e "$migration_sql" ] || continue

  migration_name="$(basename "$(dirname "$migration_sql")")"
  migration_id="$(cat /proc/sys/kernel/random/uuid)"
  checksum="$(sha256sum "$migration_sql" | awk '{print $1}')"

  echo "Applying Prisma migration: $migration_name"
  psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" --file "$migration_sql"
  psql \
    -v ON_ERROR_STOP=1 \
    -v migration_id="$migration_id" \
    -v checksum="$checksum" \
    -v migration_name="$migration_name" \
    --username "$POSTGRES_USER" \
    --dbname "$POSTGRES_DB" <<'SQL'
INSERT INTO "_prisma_migrations" (
    "id",
    "checksum",
    "finished_at",
    "migration_name",
    "logs",
    "rolled_back_at",
    "started_at",
    "applied_steps_count"
) VALUES (
    :'migration_id',
    :'checksum',
    now(),
    :'migration_name',
    NULL,
    NULL,
    now(),
    1
);
SQL
done
)

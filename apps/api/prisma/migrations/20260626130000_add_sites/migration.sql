-- Fase 1: Site (recinto) como container espacial de topo + siteId obrigatório.
-- Multi-passo para satisfazer o NOT NULL em bancos com dados existentes:
--   (1) cria enum + tabela sites; (2) 1 Site default por tenant;
--   (3) adiciona siteId nullable e faz o backfill; (4) SET NOT NULL + FK Restrict.
-- Backfill: como há exatamente 1 Site por tenant, todo recurso aponta para o Site
-- do seu tenantUuid — a herança indoor (location.siteId) é trivialmente satisfeita.

-- Garante gen_random_uuid() em qualquer versão do Postgres.
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- CreateEnum
CREATE TYPE "SiteBaseMode" AS ENUM ('osm_muted', 'satellite', 'overlay');

-- CreateTable
CREATE TABLE "sites" (
    "id" UUID NOT NULL,
    "tenantUuid" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "boundary" JSONB,
    "baseMode" "SiteBaseMode" NOT NULL DEFAULT 'osm_muted',
    "centerLat" DOUBLE PRECISION,
    "centerLng" DOUBLE PRECISION,
    "defaultZoom" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sites_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "sites_tenantUuid_idx" ON "sites"("tenantUuid");

-- Backfill (2): 1 Site default por tenantUuid distinto (união de todas as fontes).
INSERT INTO "sites" ("id", "tenantUuid", "name", "baseMode", "createdAt", "updatedAt")
SELECT gen_random_uuid(), t."tenantUuid", 'Recinto principal', 'osm_muted', now(), now()
FROM (
    SELECT "tenantUuid" FROM "locations"
    UNION SELECT "tenantUuid" FROM "trash_bins"
    UNION SELECT "tenantUuid" FROM "cameras"
    UNION SELECT "tenantUuid" FROM "tasks"
    UNION SELECT "tenantUuid" FROM "users"
) AS t;

-- AlterTable (3): adiciona siteId nullable.
ALTER TABLE "locations" ADD COLUMN "siteId" UUID;
ALTER TABLE "trash_bins" ADD COLUMN "siteId" UUID;
ALTER TABLE "cameras" ADD COLUMN "siteId" UUID;
ALTER TABLE "tasks" ADD COLUMN "siteId" UUID;

-- Backfill (3): cada recurso aponta para o Site do seu tenant.
UPDATE "locations" l
  SET "siteId" = (SELECT s."id" FROM "sites" s WHERE s."tenantUuid" = l."tenantUuid" LIMIT 1);
UPDATE "trash_bins" b
  SET "siteId" = (SELECT s."id" FROM "sites" s WHERE s."tenantUuid" = b."tenantUuid" LIMIT 1);
UPDATE "cameras" c
  SET "siteId" = (SELECT s."id" FROM "sites" s WHERE s."tenantUuid" = c."tenantUuid" LIMIT 1);
UPDATE "tasks" tk
  SET "siteId" = (SELECT s."id" FROM "sites" s WHERE s."tenantUuid" = tk."tenantUuid" LIMIT 1);

-- (4): agora a coluna pode ser NOT NULL.
ALTER TABLE "locations" ALTER COLUMN "siteId" SET NOT NULL;
ALTER TABLE "trash_bins" ALTER COLUMN "siteId" SET NOT NULL;
ALTER TABLE "cameras" ALTER COLUMN "siteId" SET NOT NULL;
ALTER TABLE "tasks" ALTER COLUMN "siteId" SET NOT NULL;

-- CreateIndex
CREATE INDEX "locations_siteId_idx" ON "locations"("siteId");
CREATE INDEX "trash_bins_siteId_idx" ON "trash_bins"("siteId");
CREATE INDEX "cameras_siteId_idx" ON "cameras"("siteId");
CREATE INDEX "tasks_siteId_idx" ON "tasks"("siteId");

-- AddForeignKey (onDelete: Restrict)
ALTER TABLE "locations" ADD CONSTRAINT "locations_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "sites"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "trash_bins" ADD CONSTRAINT "trash_bins_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "sites"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "cameras" ADD CONSTRAINT "cameras_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "sites"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "sites"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

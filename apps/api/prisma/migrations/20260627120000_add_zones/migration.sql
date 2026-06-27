-- Fase 2: Zone (zonas temáticas) dentro do Site + zoneId opcional na lixeira.
-- Sem impacto em dados: tabela/coluna novas. `zoneId` nasce NULL e é populado
-- pelo recálculo via Turf (ao criar/editar zonas ou mover lixeiras).

-- CreateTable
CREATE TABLE "zones" (
    "id" UUID NOT NULL,
    "tenantUuid" TEXT NOT NULL,
    "siteId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT,
    "color" TEXT,
    "polygon" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "zones_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "zones_tenantUuid_idx" ON "zones"("tenantUuid");
CREATE INDEX "zones_siteId_idx" ON "zones"("siteId");

-- AddForeignKey (Zone pertence ao Site; apagar o Site cascateia nas zonas)
ALTER TABLE "zones" ADD CONSTRAINT "zones_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "sites"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AlterTable: zoneId opcional na lixeira.
ALTER TABLE "trash_bins" ADD COLUMN "zoneId" UUID;

-- CreateIndex
CREATE INDEX "trash_bins_zoneId_idx" ON "trash_bins"("zoneId");

-- AddForeignKey (apagar a zona zera o zoneId; a lixeira sobrevive)
ALTER TABLE "trash_bins" ADD CONSTRAINT "trash_bins_zoneId_fkey" FOREIGN KEY ("zoneId") REFERENCES "zones"("id") ON DELETE SET NULL ON UPDATE CASCADE;

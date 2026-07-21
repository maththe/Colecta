-- zoneId opcional na tarefa, simétrico ao de trash_bins. Sem impacto em dados:
-- a coluna nasce NULL e é populada pelo recálculo via Turf (ao criar/editar a
-- tarefa ou ao mexer nas zonas do recinto).

-- AlterTable
ALTER TABLE "tasks" ADD COLUMN "zoneId" UUID;

-- CreateIndex
CREATE INDEX "tasks_zoneId_idx" ON "tasks"("zoneId");

-- AddForeignKey (apagar a zona zera o zoneId; a tarefa sobrevive)
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_zoneId_fkey" FOREIGN KEY ("zoneId") REFERENCES "zones"("id") ON DELETE SET NULL ON UPDATE CASCADE;

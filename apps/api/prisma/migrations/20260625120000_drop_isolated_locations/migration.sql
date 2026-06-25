-- Lixeiras ganham coordenada própria e `locationId` opcional, ficando simétricas
-- com câmeras/tarefas. Com isso, as "posições isoladas" (Location isBuilding=false)
-- deixam de existir: cada item passa a guardar suas próprias coordenadas.

-- 1. Coordenadas próprias na lixeira (preenchidas quando "ao ar livre").
ALTER TABLE "trash_bins"
ADD COLUMN "latitude" DOUBLE PRECISION,
ADD COLUMN "longitude" DOUBLE PRECISION;

-- 2. `locationId` passa a ser opcional (a FK já permite NULL).
ALTER TABLE "trash_bins" ALTER COLUMN "locationId" DROP NOT NULL;

-- 3. Migrar dados das posições isoladas para os próprios itens e desvincular.
--    Só copia coordenadas onde o item ainda não tem as suas.
UPDATE "trash_bins" AS bin
SET "latitude" = location."latitude",
    "longitude" = location."longitude",
    "locationId" = NULL
FROM "locations" AS location
WHERE bin."locationId" = location."id"
  AND location."isBuilding" = false;

UPDATE "cameras" AS camera
SET "locationId" = NULL
FROM "locations" AS location
WHERE camera."locationId" = location."id"
  AND location."isBuilding" = false;

UPDATE "tasks" AS task
SET "latitude" = COALESCE(task."latitude", location."latitude"),
    "longitude" = COALESCE(task."longitude", location."longitude"),
    "locationId" = NULL
FROM "locations" AS location
WHERE task."locationId" = location."id"
  AND location."isBuilding" = false;

-- 4. Apagar as posições isoladas (agora sem referências).
DELETE FROM "locations" WHERE "isBuilding" = false;

-- 5. Toda Location é construção: o flag deixa de fazer sentido.
ALTER TABLE "locations" DROP COLUMN "isBuilding";

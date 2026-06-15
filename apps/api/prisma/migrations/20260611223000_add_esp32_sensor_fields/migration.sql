ALTER TABLE "trash_bins"
  ADD COLUMN "mqttTopic" TEXT,
  ADD COLUMN "distanceEmptyCm" DOUBLE PRECISION,
  ADD COLUMN "distanceFullCm" DOUBLE PRECISION;

ALTER TABLE "sensor_readings"
  ALTER COLUMN "fillLevel" DROP NOT NULL,
  ADD COLUMN "distanceCm" DOUBLE PRECISION,
  ADD COLUMN "sensorError" TEXT,
  ADD COLUMN "mqttTopic" TEXT,
  ADD COLUMN "deviceMillis" DOUBLE PRECISION;

CREATE INDEX "trash_bins_tenantUuid_mqttTopic_idx"
  ON "trash_bins"("tenantUuid", "mqttTopic");

CREATE INDEX "sensor_readings_tenantUuid_mqttTopic_receivedAt_idx"
  ON "sensor_readings"("tenantUuid", "mqttTopic", "receivedAt");

UPDATE "trash_bins"
SET
  "mqttTopic" = COALESCE("mqttTopic", 'binovate/medidas'),
  "distanceEmptyCm" = COALESCE("distanceEmptyCm", 80),
  "distanceFullCm" = COALESCE("distanceFullCm", 10)
WHERE
  "tenantUuid" = '00000000-0000-0000-0000-000000000001'
  AND "code" = 'PRQ-001';

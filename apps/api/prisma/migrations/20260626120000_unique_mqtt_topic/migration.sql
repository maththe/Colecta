-- QF-B: unicidade de `mqttTopic` por tenant (habilita roteamento MQTT por device).
--
-- Normalização do placeholder legado: a migration 20260611223000 rodou
--   UPDATE ... SET "mqttTopic" = COALESCE("mqttTopic", 'binovate/medidas')
-- o que pode ter deixado VÁRIAS lixeiras com o mesmo tópico genérico. Esse valor
-- NÃO é um identificador de device (o roteamento legado usava o código por env,
-- não o tópico). Zeramos para NULL — vários NULL são permitidos no índice único —
-- para que admins atribuam tópicos por device (`binovate/medidas/{deviceId}`)
-- daqui em diante. Tópicos já específicos por device são preservados.
UPDATE "trash_bins" SET "mqttTopic" = NULL WHERE "mqttTopic" = 'binovate/medidas';

-- Troca o índice não-único pelo índice ÚNICO. No Postgres, UNIQUE trata NULLs como
-- distintos: lixeiras sem device (mqttTopic NULL) não colidem.
DROP INDEX "trash_bins_tenantUuid_mqttTopic_idx";
CREATE UNIQUE INDEX "trash_bins_tenantUuid_mqttTopic_key" ON "trash_bins"("tenantUuid", "mqttTopic");

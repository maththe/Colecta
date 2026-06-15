\set ON_ERROR_STOP on

WITH seed_users AS (
    SELECT
        'Admin Colecta'::text AS "name",
        'admin@colecta.com'::text AS "email",
        '$2b$10$FUcnuBnFdjnMsr5GB8nQAOnTMkjizTS67SUtmT/lHThczMJ/65wom'::text AS "password",
        'ADMIN'::"UserRole" AS "role"
    UNION ALL
    SELECT
        'Limpeza Colecta'::text AS "name",
        'limpeza@colecta.com'::text AS "email",
        '$2b$10$fKCyCe6Jf5tccYsLaIWa9eqzmeJnIEX/gw9tljoiEA20Hwf2TJ.xy'::text AS "password",
        'LIMPEZA'::"UserRole" AS "role"
    UNION ALL
    SELECT
        'Manutencao Colecta'::text AS "name",
        'manutencao@colecta.com'::text AS "email",
        '$2b$10$fKCyCe6Jf5tccYsLaIWa9eqzmeJnIEX/gw9tljoiEA20Hwf2TJ.xy'::text AS "password",
        'MANUTENCAO'::"UserRole" AS "role"
    UNION ALL
    SELECT
        'Financeiro Colecta'::text AS "name",
        'financeiro@colecta.com'::text AS "email",
        '$2b$10$fKCyCe6Jf5tccYsLaIWa9eqzmeJnIEX/gw9tljoiEA20Hwf2TJ.xy'::text AS "password",
        'FINANCEIRO'::"UserRole" AS "role"
    UNION ALL
    SELECT
        'Seguranca Colecta'::text AS "name",
        'seguranca@colecta.com'::text AS "email",
        '$2b$10$fKCyCe6Jf5tccYsLaIWa9eqzmeJnIEX/gw9tljoiEA20Hwf2TJ.xy'::text AS "password",
        'SEGURANCA'::"UserRole" AS "role"
)
INSERT INTO "users" (
    "id",
    "name",
    "email",
    "password",
    "tenantUuid",
    "role",
    "createdAt",
    "updatedAt"
)
SELECT
    gen_random_uuid()::text,
    "name",
    "email",
    "password",
    '00000000-0000-0000-0000-000000000001',
    "role",
    now(),
    now()
FROM seed_users
ON CONFLICT ("email") DO UPDATE SET
    "name" = EXCLUDED."name",
    "password" = EXCLUDED."password",
    "tenantUuid" = EXCLUDED."tenantUuid",
    "role" = EXCLUDED."role",
    "updatedAt" = now();

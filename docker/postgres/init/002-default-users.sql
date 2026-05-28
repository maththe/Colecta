\set ON_ERROR_STOP on

WITH seed_users AS (
    SELECT
        'Admin Colecta'::text AS "name",
        'admin@colecta.com'::text AS "email",
        '$2b$10$FUcnuBnFdjnMsr5GB8nQAOnTMkjizTS67SUtmT/lHThczMJ/65wom'::text AS "password",
        'ADMIN'::"UserRole" AS "role"
    UNION ALL
    SELECT
        'Funcionario Colecta'::text AS "name",
        'funcionario@colecta.com'::text AS "email",
        '$2b$10$fKCyCe6Jf5tccYsLaIWa9eqzmeJnIEX/gw9tljoiEA20Hwf2TJ.xy'::text AS "password",
        'FUNCIONARIO'::"UserRole" AS "role"
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

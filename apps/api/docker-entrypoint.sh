#!/bin/sh
set -e

cd /app/apps/api

echo "[entrypoint] Aplicando migrations do banco (prisma migrate deploy)..."
node_modules/.bin/prisma migrate deploy

echo "[entrypoint] Iniciando API..."
exec "$@"

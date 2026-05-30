# syntax=docker/dockerfile:1
# Build context MUST be the repo root: docker build -f apps/api/Dockerfile .

############################
# Base
############################
FROM node:20-alpine AS base
# Prisma precisa do openssl no Alpine
RUN apk add --no-cache openssl
RUN corepack enable && corepack prepare pnpm@10.32.1 --activate
WORKDIR /app

############################
# Dependencies (cacheável)
############################
FROM base AS deps
COPY pnpm-lock.yaml pnpm-workspace.yaml .npmrc package.json ./
COPY apps/api/package.json ./apps/api/package.json
COPY apps/web/package.json ./apps/web/package.json
RUN --mount=type=cache,id=pnpm,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile --filter @colecta/api...

############################
# Build (gera Prisma Client + compila Nest)
############################
FROM deps AS build
COPY apps/api ./apps/api
RUN pnpm --filter @colecta/api exec prisma generate
RUN pnpm --filter @colecta/api run build

############################
# Runtime
############################
FROM base AS runtime
ENV NODE_ENV=production
WORKDIR /app

# node_modules da raiz (store .pnpm + Prisma Client gerado) e do app
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/pnpm-workspace.yaml ./pnpm-workspace.yaml
COPY --from=build /app/pnpm-lock.yaml ./pnpm-lock.yaml
COPY --from=build /app/apps/api/node_modules ./apps/api/node_modules
COPY --from=build /app/apps/api/dist ./apps/api/dist
COPY --from=build /app/apps/api/package.json ./apps/api/package.json
COPY --from=build /app/apps/api/prisma ./apps/api/prisma

COPY apps/api/docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh \
 && addgroup -S nodejs && adduser -S nestjs -G nodejs \
 && chown -R nestjs:nodejs /app

USER nestjs
WORKDIR /app/apps/api
EXPOSE 3333

# Aplica migrations (prisma migrate deploy) e sobe a API
ENTRYPOINT ["docker-entrypoint.sh"]
CMD ["node", "dist/main.js"]

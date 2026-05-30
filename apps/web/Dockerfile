# syntax=docker/dockerfile:1
# Build context MUST be the repo root: docker build -f apps/web/Dockerfile .

############################
# Base
############################
FROM node:20-alpine AS base
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
    pnpm install --frozen-lockfile --filter @colecta/web...

############################
# Build (gera o estático em dist/)
############################
FROM deps AS build
# VITE_API_URL é embutida no bundle em build-time
ARG VITE_API_URL
ENV VITE_API_URL=$VITE_API_URL
COPY apps/web ./apps/web
RUN pnpm --filter @colecta/web run build

############################
# Runtime (nginx servindo estático)
############################
FROM nginx:1.27-alpine AS runtime
COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/apps/web/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]

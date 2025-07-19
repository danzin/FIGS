# ─── Stage 1: Builder ───────────────────────────────────────────────────
FROM node:23-alpine AS builder
WORKDIR /usr/src/monorepo

# 1. Copy ALL manifests and the single root lock file to leverage caching.
COPY package.json package-lock.json* ./
COPY common/package.json ./common/
COPY micro-frontend/package.json ./micro-frontend/
COPY data-collector/package.json ./data-collector/
COPY signal-persister/package.json ./signal-persister/
COPY signal-query-api/package.json ./signal-query-api/
COPY scraper-service/package.json ./scraper-service/

RUN npm ci

COPY . .
RUN npm run build

# RUN npm run build -w @financialsignalsgatheringsystem/common
# RUN npm run build -w signal-query-api

# Prune devDependencies
RUN npm prune --production


# ─── Stage 2: Production Runner ───────────────────────────────────────
FROM node:23-alpine
ENV NODE_ENV=production
WORKDIR /usr/src/app

# 1. Copy the pruned, production-only node_modules from the builder stage.
COPY --from=builder /usr/src/monorepo/node_modules ./node_modules

# 2. Copy the built common library into the final node_modules.
COPY --from=builder /usr/src/monorepo/common ./node_modules/@financialsignalsgatheringsystem/common

# 3. Copy the built application code for THIS specific service.
COPY --from=builder /usr/src/monorepo/signal-query-api/dist ./dist

# 4. Copy this service's package.json for runtime context 
COPY --from=builder /usr/src/monorepo/signal-query-api/package.json ./

CMD ["node", "dist/main.js"]
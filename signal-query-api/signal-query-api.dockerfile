# ─── Stage 0: Source ───────────────────────────
FROM node:23-alpine AS source
WORKDIR /usr/src/monorepo
COPY package.json package-lock.json* ./
COPY common/package.json ./common/
COPY signal-query-api/package.json ./signal-query-api/
COPY common/ ./common/
COPY signal-query-api/ ./signal-query-api/


# ─── Stage 1: Builder ──────────────────────────
FROM source AS builder
WORKDIR /usr/src/monorepo/signal-query-api # Set WORKDIR to the specific service

RUN npm --prefix /usr/src/monorepo install

RUN npm run build


# ─── Stage 2: Production Runner ───────────────
FROM node:23-alpine AS final
WORKDIR /usr/src/app

COPY --from=builder /usr/src/monorepo/signal-query-api/package.json ./
COPY --from=builder /usr/src/monorepo/signal-query-api/package-lock.json ./
RUN npm ci --only=production

COPY --from=builder /usr/src/monorepo/common/dist ./node_modules/@financialsignalsgatheringsystem/common/dist
COPY --from=builder /usr/src/monorepo/common/package.json ./node_modules/@financialsignalsgatheringsystem/common/

COPY --from=builder /usr/src/monorepo/signal-query-api/dist ./dist

ENV NODE_ENV=production
CMD ["node", "dist/main.js"] 
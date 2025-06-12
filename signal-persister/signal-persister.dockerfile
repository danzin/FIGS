# ─── Stage 0: Source ───────────────────────────
FROM node:23-alpine AS source
WORKDIR /usr/src/monorepo
COPY package.json package-lock.json* ./
COPY common/package.json ./common/
COPY signal-persister/package.json ./signal-persister/
COPY common/ ./common/
COPY signal-persister/ ./signal-persister/


# ─── Stage 1: Builder ──────────────────────────
FROM source AS builder
WORKDIR /usr/src/monorepo/signal-persister 

RUN npm --prefix /usr/src/monorepo install

RUN npm run build


# ─── Stage 2: Production Runner ───────────────
FROM node:23-alpine AS final
WORKDIR /usr/src/app

COPY --from=builder /usr/src/monorepo/signal-persister/package.json ./
COPY --from=builder /usr/src/monorepo/signal-persister/package-lock.json ./
RUN npm ci --only=production

COPY --from=builder /usr/src/monorepo/common/dist ./node_modules/@financialsignalsgatheringsystem/common/dist
COPY --from=builder /usr/src/monorepo/common/package.json ./node_modules/@financialsignalsgatheringsystem/common/

COPY --from=builder /usr/src/monorepo/signal-persister/dist ./dist

ENV NODE_ENV=production
CMD ["node", "dist/index.js"] 
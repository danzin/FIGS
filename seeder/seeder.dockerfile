FROM node:23-alpine AS builder
WORKDIR /usr/src/monorepo
COPY package.json package-lock.json* ./
COPY common/package.json ./common/
COPY micro-frontend/package.json ./micro-frontend/
COPY data-collector/package.json ./data-collector/
COPY signal-persister/package.json ./signal-persister/
COPY signal-query-api/package.json ./signal-query-api/
COPY scraper-service/package.json ./scraper-service/
COPY seeder/package.json ./seeder/

RUN npm ci

COPY . .
RUN npm run build


RUN npm prune --production


FROM node:23-alpine
ENV NODE_ENV=production
WORKDIR /usr/src/app
COPY --from=builder /usr/src/monorepo/node_modules ./node_modules
COPY --from=builder /usr/src/monorepo/common ./node_modules/@financialsignalsgatheringsystem/common
COPY --from=builder /usr/src/monorepo/seeder/dist ./dist
COPY --from=builder /usr/src/monorepo/seeder/package.json ./
CMD ["node", "dist/seed-binance.js"]
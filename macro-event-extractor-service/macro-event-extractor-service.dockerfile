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
COPY macro-event-extractor-service/package.json ./macro-event-extractor-service/

RUN npm ci

COPY . .
RUN npm run build
RUN npm prune --production

FROM node:23-alpine
ENV NODE_ENV=production
WORKDIR /usr/src/app

COPY --from=builder --chown=node:node /usr/src/monorepo/node_modules ./node_modules
COPY --from=builder --chown=node:node /usr/src/monorepo/common ./node_modules/@financialsignalsgatheringsystem/common
COPY --from=builder --chown=node:node /usr/src/monorepo/macro-event-extractor-service/dist ./dist
COPY --from=builder --chown=node:node /usr/src/monorepo/macro-event-extractor-service/package.json ./

USER node
CMD ["node", "dist/index.js"]

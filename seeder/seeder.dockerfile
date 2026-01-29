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
COPY --from=builder --chown=node:node /usr/src/monorepo/node_modules ./node_modules
COPY --from=builder --chown=node:node /usr/src/monorepo/common ./node_modules/@financialsignalsgatheringsystem/common
COPY --from=builder --chown=node:node /usr/src/monorepo/seeder/dist ./dist
COPY --from=builder --chown=node:node /usr/src/monorepo/seeder/package.json ./

# Create a startup script to run all seeders
RUN echo '#!/bin/sh' > /usr/src/app/seed-all.sh && \
    echo 'node dist/seed-binance.js && node dist/seed-fundamentals.js && node dist/seed-indicators.js' >> /usr/src/app/seed-all.sh && \
    chmod +x /usr/src/app/seed-all.sh && \
    chown node:node /usr/src/app/seed-all.sh

USER node
CMD ["sh", "/usr/src/app/seed-all.sh"]

# ─── Stage 1: Dependency Installation & Building ────────────────────────
# Use a standard Node.js image for the build to ensure a consistent `tsc` environment.
FROM node:23-alpine AS builder
WORKDIR /usr/src/monorepo

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

RUN npm prune --production

# ─── Stage 2: Production Runner ──────────────────────────────────────────
# Switch to the Playwright image for the final stage.
# It has all the necessary browser binaries and system libraries.
FROM mcr.microsoft.com/playwright:v1.54.1-jammy 
ENV NODE_ENV=production
ENV PLAYWRIGHT_BROWSERS_PATH=0
WORKDIR /usr/src/app

COPY --from=builder /usr/src/monorepo/node_modules ./node_modules

RUN npx playwright install --with-deps

COPY --from=builder /usr/src/monorepo/common ./node_modules/@financialsignalsgatheringsystem/common
COPY --from=builder /usr/src/monorepo/scraper-service/dist ./dist
COPY --from=builder /usr/src/monorepo/scraper-service/package.json ./

USER root
RUN chown -R pwuser:pwuser /usr/src/app
USER pwuser

CMD ["node", "dist/index.js"]

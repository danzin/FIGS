# ─── Stage 1: Builder ────────────────────────────────
FROM node:23-alpine AS builder
WORKDIR /usr/src/app
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


# ─── Stage 2: Serve ────────────────────────────────
FROM nginx:1.27-alpine

COPY --from=builder /usr/src/app/micro-frontend/dist /usr/share/nginx/html
COPY micro-frontend/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
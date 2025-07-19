# ─── Stage 1: Builder ────────────────────────────────
FROM node:23-alpine AS builder
WORKDIR /usr/src/monorepo

# 1. Copy root manifests and all workspace manifests
COPY package.json package-lock.json* ./
COPY common/package.json ./common/
COPY micro-frontend/package.json ./micro-frontend/
COPY data-collector/package.json ./data-collector/
COPY signal-persister/package.json ./signal-persister/
COPY signal-query-api/package.json ./signal-query-api/
COPY scraper-service/package.json ./scraper-service/

# 2. Install *all* workspaces so the local "common" link is created
RUN npm ci

# 3. Copy the rest of the repo
COPY . .

# 4. Build only the frontend workspace (this invokes its Vite build)
RUN npm run build --workspaces --include-workspace-root=false --workspace=micro-frontend

# ─── Stage 2: Serve ────────────────────────────────
FROM nginx:1.27-alpine

# 5. Copy the one dist output you actually need
COPY --from=builder /usr/src/monorepo/micro-frontend/dist /usr/share/nginx/html
COPY micro-frontend/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]

# ─── Stage 1: Builder ────────────────────────────────
FROM node:23-alpine AS builder
WORKDIR /usr/src/app
COPY package.json package-lock.json* ./
COPY common/package.json ./common/
COPY micro-frontend/package.json ./micro-frontend/

WORKDIR /
RUN npm --prefix /usr/src/app install 

WORKDIR /usr/src/app
COPY common/ ./common/
COPY micro-frontend/ ./micro-frontend/


# --- Build the frontend application ---
WORKDIR /usr/src/app/micro-frontend
RUN npm run build 


# ─── Stage 2: Serve ────────────────────────────────
FROM nginx:1.27-alpine

COPY --from=builder /usr/src/app/micro-frontend/dist /usr/share/nginx/html
COPY micro-frontend/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
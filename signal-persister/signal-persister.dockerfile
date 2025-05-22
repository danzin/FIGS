# ─── Stage 1: Build ─────────────────────────────
FROM node:23-alpine AS builder
WORKDIR /usr/src/app

# Copy package files & install ALL deps (including dev)
COPY package.json package-lock.json ./
RUN npm ci

# Copy source & compile
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

# ─── Stage 2: Run ──────────────────────────────
FROM node:23-alpine
WORKDIR /usr/src/app

# Copy only prod deps
COPY package.json package-lock.json ./
RUN npm ci --only=production

# Copy built output from builder stage
COPY --from=builder /usr/src/app/dist ./dist

ENV NODE_ENV=production
CMD ["node", "dist/index.js"]

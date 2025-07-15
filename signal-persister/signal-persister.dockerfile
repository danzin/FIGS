# ─── Stage 1: Builder ───────────────────────────────────────────────────
FROM node:23-alpine AS builder
WORKDIR /usr/src/monorepo

# 1. Copy ALL manifests and the single root lock file to leverage caching.
COPY package.json package-lock.json* ./
COPY common/package.json ./common/
COPY data-collector/package.json ./data-collector/
COPY signal-persister/package.json ./signal-persister/
COPY signal-query-api/package.json ./signal-query-api/

# 2. Install ALL dependencies from the root using the lock file.
RUN npm ci

# 3. Copy the rest of the source code and config files.
COPY . .

# 4. Build the entire monorepo.

RUN npm run build

# 5. Prune devDependencies 
RUN npm prune --production


# ─── Stage 2: Production Runner ───────────────────────────────────────
FROM node:23-alpine
ENV NODE_ENV=production
WORKDIR /usr/src/app

# 1. Copy the pruned, production-only node_modules from the builder stage.
COPY --from=builder /usr/src/monorepo/node_modules ./node_modules

# 2. Copy the built common library into the final node_modules.
COPY --from=builder /usr/src/monorepo/common ./node_modules/@financialsignalsgatheringsystem/common

# 3. Copy the built application code for THIS specific service.
COPY --from=builder /usr/src/monorepo/signal-persister/dist ./dist

# 4. Copy this service's package.json for runtime context
COPY --from=builder /usr/src/monorepo/signal-persister/package.json ./

CMD ["node", "dist/index.js"]
# ─── Stage 0: Source ───────────────────────────
# This stage copies ALL relevant source code from the monorepo root.
# The build context for this stage must be the monorepo root.
FROM node:23-alpine AS source
WORKDIR /usr/src/monorepo
# Copy all package.json and lock files
COPY package.json package-lock.json* ./
COPY common/package.json ./common/
COPY signal-query-api/package.json ./signal-query-api/
# Copy all source code
COPY common/ ./common/
COPY signal-query-api/ ./signal-query-api/


# ─── Stage 1: Builder ──────────────────────────
# This stage builds the specific microservice (e.g., signal-query-api)
FROM source AS builder
WORKDIR /usr/src/monorepo/signal-query-api # Set WORKDIR to the specific service

# Install ALL dependencies for the entire monorepo from the root
# This will create the symlinks correctly inside the container
RUN npm --prefix /usr/src/monorepo install

# Now, build the specific project. Since dependencies are installed, this will work.
RUN npm run build


# ─── Stage 2: Production Runner ───────────────
# This stage creates a lean final image with only production artifacts
FROM node:23-alpine AS final
WORKDIR /usr/src/app

# Install ONLY production dependencies for the target service
# We copy the package.json and then run npm install --only=production
COPY --from=builder /usr/src/monorepo/signal-query-api/package.json ./
# If your service has its own lock file, copy it too.
COPY --from=builder /usr/src/monorepo/signal-query-api/package-lock.json ./
RUN npm ci --only=production

# Copy the shared library's built code from the builder stage
# This is needed because it's a runtime dependency
COPY --from=builder /usr/src/monorepo/common/dist ./node_modules/@financialsignalsgatheringsystem/common/dist
COPY --from=builder /usr/src/monorepo/common/package.json ./node_modules/@financialsignalsgatheringsystem/common/

# Copy the built application code for signal-query-api
COPY --from=builder /usr/src/monorepo/signal-query-api/dist ./dist

ENV NODE_ENV=production
CMD ["node", "dist/main.js"] 
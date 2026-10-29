# Stage 1: Client Build
FROM node:22.23.2-bookworm-slim@sha256:48e4b67d85f87bd551df43704e24d252f56cc5f8e9718841aace50f19948f0f9 AS build

# Reproducible build inputs (supplied by the release build).
ARG SOURCE_DATE_EPOCH

WORKDIR /app

# Enable pnpm with exact version
RUN corepack enable && corepack prepare pnpm@10.32.1 --activate

# Copy dependency manifests
COPY package.json pnpm-lock.yaml ./

# Install full dependencies (including devDependencies needed for Vite build)
RUN pnpm install --frozen-lockfile

# Copy sources needed for build
COPY client ./client
COPY vite.config.js ./

# Build the client bundle to client/dist
RUN pnpm run build:client

# Stage 2: Production Runtime
FROM node:22.23.2-bookworm-slim@sha256:48e4b67d85f87bd551df43704e24d252f56cc5f8e9718841aace50f19948f0f9 AS runtime

# Reproducible build inputs and OCI metadata (supplied by the release build).
ARG SOURCE_DATE_EPOCH
ARG BUILD_REVISION=""
ARG BUILD_VERSION=""
ARG BUILD_CREATED=""
ARG BUILD_SOURCE=""

# Install runtime tools: pdftotext (poppler-utils) and pandoc
RUN apt-get update && apt-get install -y --no-install-recommends \
    poppler-utils \
    pandoc \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

LABEL org.opencontainers.image.revision=$BUILD_REVISION \
      org.opencontainers.image.version=$BUILD_VERSION \
      org.opencontainers.image.created=$BUILD_CREATED \
      org.opencontainers.image.source=$BUILD_SOURCE \
      org.opencontainers.image.title="teacher-service"

# Ensure storage directories exist and are owned by node user
RUN mkdir -p /app/storage/files /app/storage/db && chown -R node:node /app

# Enable pnpm for production install
RUN corepack enable && corepack prepare pnpm@10.32.1 --activate

COPY --chown=node:node package.json pnpm-lock.yaml ./

USER node

# Install only production dependencies
RUN pnpm install --prod --frozen-lockfile \
    && node -e "const { DatabaseSync } = require('node:sqlite'); new DatabaseSync(':memory:');"

# Copy application backend sources
COPY --chown=node:node src ./src
COPY --chown=node:node bin ./bin

# Copy compiled client bundle from build stage into client/dist
COPY --from=build --chown=node:node /app/client/dist ./client/dist

# Set default production environment
ENV NODE_ENV=production \
    PORT=80 \
    HOST=0.0.0.0 \
    TEACHER_SERVICE_DB_PATH=/app/storage/db/teacher_service.db \
    TEACHER_SERVICE_STORAGE_DIR=/app/storage/files

EXPOSE 80

CMD ["node", "bin/teacher-service-http.js"]

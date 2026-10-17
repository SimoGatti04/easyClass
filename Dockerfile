FROM node:22.23.2-bookworm-slim AS base

# Install runtime tools: pdftotext (poppler-utils) and pandoc
RUN apt-get update && apt-get install -y --no-install-recommends \
    poppler-utils \
    pandoc \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Ensure storage directories exist and are owned by node user
RUN mkdir -p /app/storage/files /app/storage/db && chown -R node:node /app

# Use the package manager and exact version declared by package.json. The
# committed pnpm lockfile is the only dependency-resolution source of truth.
RUN corepack enable && corepack prepare pnpm@10.32.1 --activate
COPY --chown=node:node package.json pnpm-lock.yaml ./
USER node
RUN pnpm install --prod --frozen-lockfile \
    && node -e "const { DatabaseSync } = require('node:sqlite'); new DatabaseSync(':memory:');"

# Copy application sources
COPY --chown=node:node . .

# Set default production environment
ENV NODE_ENV=production \
    PORT=80 \
    HOST=0.0.0.0 \
    TEACHER_SERVICE_DB_PATH=/app/storage/db/teacher_service.db \
    TEACHER_SERVICE_STORAGE_DIR=/app/storage/files

EXPOSE 80

CMD ["node", "bin/teacher-service-http.js"]

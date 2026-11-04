# syntax=docker/dockerfile:1.7
ARG NODE_IMAGE=node:24.15.0-bookworm-slim

FROM ${NODE_IMAGE} AS base
RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates openssl \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /app
ENV NPM_CONFIG_CACHE=/tmp/npm

FROM base AS builder
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
# Prisma generate lê a configuração, mas não conecta ao banco durante o build.
RUN DATABASE_URL=mysql://build:build@127.0.0.1:3306/build \
    DATABASE_DIALECT=mysql npm run build

FROM builder AS production-dependencies
RUN npm prune --omit=dev && npm cache clean --force

# Container de execução única, com a CLI Prisma fixada no lockfile.
FROM base AS migrations
LABEL org.opencontainers.image.title="Lambda Quality API — migrations" \
    org.opencontainers.image.licenses="MIT"
ENV NODE_ENV=production
COPY --from=builder --chown=node:node /app/LICENSE ./
COPY --from=builder --chown=node:node /app/node_modules ./node_modules
COPY --from=builder --chown=node:node /app/package.json /app/package-lock.json ./
COPY --from=builder --chown=node:node /app/prisma ./prisma
COPY --from=builder --chown=node:node /app/prisma.config.ts ./
COPY --from=builder --chown=node:node /app/scripts/database-env.mjs ./scripts/database-env.mjs
USER node
CMD ["npm", "run", "migration:deploy"]

FROM base AS runtime
LABEL org.opencontainers.image.title="Lambda Quality API" \
    org.opencontainers.image.licenses="MIT"
ENV NODE_ENV=production HOST=0.0.0.0 PORT=3000
COPY --from=builder --chown=node:node /app/LICENSE ./
COPY --from=production-dependencies --chown=node:node /app/node_modules ./node_modules
COPY --from=builder --chown=node:node /app/dist ./dist
COPY --from=builder --chown=node:node /app/package.json ./
COPY --from=builder --chown=node:node /app/scripts/database-env.mjs ./scripts/database-env.mjs
COPY --from=builder --chown=node:node /app/scripts/cicd/healthcheck.mjs ./scripts/cicd/healthcheck.mjs
COPY --from=builder --chown=node:node /app/scripts/vault-keys.mjs /app/scripts/check-vault-key.mjs /app/scripts/setup-vault-key.mjs ./scripts/
USER node
EXPOSE 3000
HEALTHCHECK --interval=15s --timeout=8s --start-period=45s --retries=4 \
    CMD ["node", "scripts/cicd/healthcheck.mjs"]
CMD ["node", "dist/main.js"]

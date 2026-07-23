# syntax=docker/dockerfile:1.7

FROM node:20-bookworm-slim AS base

ENV PNPM_HOME=/pnpm \
    PATH=/pnpm:$PATH \
    NEXT_TELEMETRY_DISABLED=1

RUN corepack enable && corepack prepare pnpm@9.15.0 --activate

WORKDIR /app

FROM base AS build

COPY . .

RUN --mount=type=cache,id=rhautt-pnpm,target=/pnpm/store \
    pnpm config set store-dir /pnpm/store && \
    pnpm install --frozen-lockfile

ARG NEXT_PUBLIC_APP_BRAND_URL=https://manage.rhautt.com
ARG NEXT_PUBLIC_APP_DIAGNOSIS_URL=https://rhautt.com
ARG NEXT_PUBLIC_DIAGNOSIS_URL=https://rhautt.com

ENV NEXT_PUBLIC_APP_BRAND_URL=$NEXT_PUBLIC_APP_BRAND_URL \
    NEXT_PUBLIC_APP_DIAGNOSIS_URL=$NEXT_PUBLIC_APP_DIAGNOSIS_URL \
    NEXT_PUBLIC_DIAGNOSIS_URL=$NEXT_PUBLIC_DIAGNOSIS_URL

RUN pnpm --filter brand-console build && \
    pnpm --filter consumer-diagnosis build && \
    pnpm --filter customer-portal build && \
    pnpm --filter dealer-workbench build && \
    pnpm --filter designer-workbench build && \
    pnpm --filter nexus-console build && \
    pnpm --filter product-catalog build && \
    pnpm --filter public-portal build && \
    pnpm --filter rysnova-bim-workbench build && \
    pnpm exec tsc -p services/api/tsconfig.json

FROM base AS runtime

ENV NODE_ENV=production

RUN apt-get update && \
    apt-get install -y --no-install-recommends ca-certificates curl tini && \
    rm -rf /var/lib/apt/lists/*

COPY --from=build /app /app

RUN mkdir -p /app/logs /app/uploads /app/storage && \
    chown -R node:node /app/logs /app/uploads /app/storage

USER node

ENTRYPOINT ["/usr/bin/tini", "--"]
CMD ["node", "dist/services/api/main.js"]

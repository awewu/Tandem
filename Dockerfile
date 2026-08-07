# syntax=docker/dockerfile:1.7
# Tandem · 生产镜像（多阶段构建 / 非 root / standalone）
# 构建: docker build -t tandem-app:latest .
# 运行: docker compose -f docker-compose.prod.yml up -d

# ---------- 阶段 1: deps ----------
FROM node:22-alpine AS deps
WORKDIR /app
RUN apk add --no-cache libc6-compat
COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm \
    npm ci --no-audit --no-fund --ignore-scripts

# ---------- 阶段 2: builder ----------
FROM node:22-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
ENV NEXT_OUTPUT=standalone
# postinstall (copy-pdf-worker) 在 deps 阶段被 ignore-scripts 跳过，这里手动跑
RUN node scripts/copy-pdf-worker.mjs || true
# Next 在构建期会加载部分服务端路由；使用非运行期占位值通过静态收集。
# 最终 runner 不继承这些值，compose 仍强制要求真实 SESSION/NEXTAUTH secret。
RUN SESSION_SECRET=build-only-not-valid-at-runtime-20260807 \
    NEXTAUTH_SECRET=build-only-not-valid-at-runtime-20260807 \
    npm run build

# ---------- 阶段 3: runner ----------
FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# 非 root 用户
RUN addgroup --system --gid 1001 nodejs \
 && adduser --system --uid 1001 nextjs

# Next.js standalone 自包含 server (含必需依赖)
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public
# 幂等 SQL migration runner。Next 会把 postgres-js 打进应用 chunk，但独立
# runner 仍需可解析原始包；只复制这一项生产依赖，不携带 drizzle-kit/devDependencies。
COPY --from=builder --chown=nextjs:nodejs /app/drizzle ./drizzle
COPY --from=builder --chown=nextjs:nodejs /app/scripts/apply-migrations.mjs ./scripts/apply-migrations.mjs
COPY --from=deps --chown=nextjs:nodejs /app/node_modules/postgres ./node_modules/postgres

USER nextjs

EXPOSE 3000

# 容器编排层做健康检查 (compose healthcheck), 此处保留兜底
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget --quiet --tries=1 --spider http://127.0.0.1:3000/api/health || exit 1

CMD ["node", "server.js"]

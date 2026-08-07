#!/usr/bin/env bash
# ============================================================================
# Tandem · 增量部署脚本 (服务器端执行)
#
# 用途: 代码已 push 到 git 仓库后, 在服务器上拉取最新代码并重建 Docker 镜像.
#
# 用法 (在服务器上执行):
#   cd /root/hermes-tandem          # 或你的实际部署目录
#   bash scripts/deploy-update.sh
#
# 做的事:
#   1. git pull origin main
#   2. docker compose build app (重建镜像)
#   3. 用新镜像执行幂等数据库迁移
#   4. docker compose up -d app (重启容器, 不动 PG/Redis/MinIO)
#   5. 健康检查
# ============================================================================
set -euo pipefail

cd "$(dirname "$0")/.."
ROOT="$(pwd)"
ENV_FILE="$ROOT/.env.production"

if [ ! -f "$ENV_FILE" ]; then
  echo "✗ .env.production 不存在, 请先跑 scripts/deploy-bootstrap.sh"
  exit 1
fi

COMPOSE="docker compose -f docker-compose.prod.yml --env-file $ENV_FILE"

log()  { printf "\033[1;36m▶ %s\033[0m\n" "$*"; }
ok()   { printf "\033[1;32m✓ %s\033[0m\n" "$*"; }
warn() { printf "\033[1;33m⚠ %s\033[0m\n" "$*"; }
err()  { printf "\033[1;31m✗ %s\033[0m\n" "$*"; exit 1; }

# ---------- 1. 拉取最新代码 ----------
log "拉取最新代码"
git fetch origin main
LOCAL=$(git rev-parse HEAD)
REMOTE=$(git rev-parse origin/main)

if [ "$LOCAL" = "$REMOTE" ]; then
  warn "本地已是最新 ($LOCAL), 无需更新"
  echo "如需强制重建, 直接跑: $COMPOSE build app && $COMPOSE up -d app"
  exit 0
fi

git pull --rebase origin main
ok "代码已更新到 $(git rev-parse --short HEAD)"

# ---------- 2. 重建 app 镜像 ----------
log "重建 app 镜像 (首次较慢, 后续有缓存约 1-3 分钟)"
$COMPOSE build app
ok "镜像构建完成"

# ---------- 3. 执行数据库迁移 ----------
# 先迁移再切换应用；失败时保留正在运行的旧容器并终止部署。
log "执行数据库迁移"
$COMPOSE run --rm -T --no-deps app node scripts/apply-migrations.mjs
ok "迁移完成"

# ---------- 4. 重启 app 容器 ----------
log "重启 app 容器 (PG/Redis/MinIO 不受影响)"
$COMPOSE up -d app
ok "容器已重启"

# ---------- 5. 健康检查 ----------
log "健康检查 (最多 60s)"
APP_PORT=$($COMPOSE run --rm -T app sh -c 'echo $APP_PORT' 2>/dev/null || echo "3000")
APP_PORT=${APP_PORT:-3000}
HEALTH_URL="http://127.0.0.1:${APP_PORT}/api/health"

for i in $(seq 1 30); do
  if curl -sf "$HEALTH_URL" >/dev/null 2>&1; then
    ok "app 健康: $HEALTH_URL"
    curl -s "$HEALTH_URL" | head -c 300; echo
    break
  fi
  sleep 2
  [ "$i" -eq 30 ] && err "app 启动超时. 看日志: $COMPOSE logs --tail 50 app"
done

echo ""
echo "═══════════════════════════════════════════════════════════════"
ok "部署完成 → $(git rev-parse --short HEAD) 已上线"
echo "═══════════════════════════════════════════════════════════════"
echo "查看日志: $COMPOSE logs -f --tail 100 app"
echo ""

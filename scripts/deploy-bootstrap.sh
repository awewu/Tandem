#!/usr/bin/env bash
# ============================================================================
# Tandem · 一键生产部署脚本 (Linux/macOS)
#
# 在干净的 VPS 上运行此脚本即可完成首次部署:
#   1. 检查依赖 (docker, docker compose)
#   2. 生成 secrets (NEXTAUTH_SECRET / SESSION_SECRET / MFA_KEY / PG / Redis / MinIO 密码)
#   3. 写入 .env.production (如不存在)
#   4. docker compose up -d (按依赖顺序)
#   5. 跑 drizzle migration
#   6. 健康检查
#   7. 打印登录信息
#
# 用法:
#   chmod +x scripts/deploy-bootstrap.sh
#   ./scripts/deploy-bootstrap.sh
#
# 重跑安全: 已存在的 .env.production 会保留, 不会覆盖你的 secrets
# ============================================================================

set -euo pipefail

cd "$(dirname "$0")/.."
ROOT="$(pwd)"
ENV_FILE="$ROOT/.env.production"
COMPOSE="docker compose -f docker-compose.prod.yml --env-file $ENV_FILE"

# ---------- 工具函数 ----------
log()  { printf "\033[1;36m▶ %s\033[0m\n" "$*"; }
ok()   { printf "\033[1;32m✓ %s\033[0m\n" "$*"; }
warn() { printf "\033[1;33m⚠ %s\033[0m\n" "$*"; }
err()  { printf "\033[1;31m✗ %s\033[0m\n" "$*"; exit 1; }

gen_secret() {
  # 32 字节 base64 随机
  openssl rand -base64 32 | tr -d '\n='
}

gen_alphanum() {
  # 32 字符字母数字 (用于 DB password, 避开特殊字符防 shell 转义)
  openssl rand -base64 48 | tr -dc 'A-Za-z0-9' | head -c 32
}

# ---------- 1. 依赖检查 ----------
log "依赖检查"
command -v docker >/dev/null 2>&1 || err "docker 未安装. 装: curl -fsSL https://get.docker.com | sh"
docker compose version >/dev/null 2>&1 || err "docker compose v2 未安装 (用 'docker compose' 不是 'docker-compose')"
command -v openssl >/dev/null 2>&1 || err "openssl 未安装. 装: apt install openssl"
command -v curl >/dev/null 2>&1 || err "curl 未安装"
ok "docker / docker compose / openssl / curl 都在"

# ---------- 2. 生成 / 复用 .env.production ----------
if [ -f "$ENV_FILE" ]; then
  log ".env.production 已存在, 复用 (不覆盖)"
  # shellcheck disable=SC1090
  set -a; source "$ENV_FILE"; set +a
  ok "已加载现有配置"
else
  log "首次部署, 生成 .env.production"

  read -p "  Bootstrap Owner 邮箱: " BOOTSTRAP_EMAIL
  read -p "  Bootstrap Owner 姓名 (默认 Owner): " BOOTSTRAP_NAME
  BOOTSTRAP_NAME=${BOOTSTRAP_NAME:-Owner}
  read -p "  访问 URL (https://your-domain.com 或 http://server-ip:3000): " NEXTAUTH_URL_INPUT

  read -p "  DeepSeek API Key (留空跳过, 推荐配): " DEEPSEEK_KEY
  read -p "  告警 Webhook URL (飞书/钉钉, 留空跳过): " ALERT_URL

  PG_PASS=$(gen_alphanum)
  REDIS_PASS=$(gen_alphanum)
  MINIO_PASS=$(gen_alphanum)
  NEXTAUTH_SECRET=$(gen_secret)
  SESSION_SECRET=$(gen_secret)
  MFA_KEY=$(openssl rand -base64 32)
  BOOTSTRAP_PASS=$(gen_alphanum | head -c 16)

  cat > "$ENV_FILE" <<EOF
# Tandem · 生产环境配置 (auto-generated $(date +%F))
# !! 此文件含密钥, chmod 600 + 务必备份 !!

# ---- 数据库 ----
POSTGRES_USER=tandem
POSTGRES_PASSWORD=$PG_PASS
POSTGRES_DB=tandem

# ---- Redis ----
REDIS_PASSWORD=$REDIS_PASS

# ---- MinIO (S3 兼容) ----
MINIO_ROOT_USER=tandem
MINIO_ROOT_PASSWORD=$MINIO_PASS
S3_BUCKET_DRIVE=tandem-drive

# ---- Next.js / 认证 ----
NEXTAUTH_URL=$NEXTAUTH_URL_INPUT
NEXTAUTH_SECRET=$NEXTAUTH_SECRET
SESSION_SECRET=$SESSION_SECRET
MFA_ENCRYPTION_KEY=$MFA_KEY
ALLOW_DEMO_AUTH=0

# ---- Bootstrap Owner (首次启动自动建账号) ----
TANDEM_BOOTSTRAP_OWNER_EMAIL=$BOOTSTRAP_EMAIL
TANDEM_BOOTSTRAP_OWNER_PASSWORD=$BOOTSTRAP_PASS
TANDEM_BOOTSTRAP_OWNER_NAME=$BOOTSTRAP_NAME

# ---- LLM Providers (至少配一个 key, 否则 AI 降级 fallback) ----
DEEPSEEK_API_KEY=$DEEPSEEK_KEY
DEEPSEEK_BASE_URL=https://api.deepseek.com/v1
DEEPSEEK_MODEL=deepseek-chat
ANTHROPIC_API_KEY=
OPENAI_API_KEY=

# ---- 告警 ----
ALERT_WEBHOOK_URL=$ALERT_URL

# ---- App ----
APP_PORT=3000
APP_BIND=127.0.0.1   # 仅本机, 由 Caddy/Nginx 反代; 测试改 0.0.0.0
LOG_LEVEL=info
TZ=Asia/Shanghai

# ---- 资源限制 (容器层) ----
APP_MEM_LIMIT=1G
APP_CPU_LIMIT=2.0
PG_MEM_LIMIT=1G
PG_CPU_LIMIT=1.0
REDIS_MEM_LIMIT=384M
REDIS_MAXMEMORY=256mb
MINIO_MEM_LIMIT=512M

# ---- Rate Limit ----
RATE_LIMIT_LOGIN_PER_HOUR=5
RATE_LIMIT_API_PER_MINUTE=120
EOF

  chmod 600 "$ENV_FILE"
  ok ".env.production 已生成 (chmod 600)"
  warn "保存这个登录信息! (.env.production 内也有)"
  printf "    📧 Owner Email:    %s\n" "$BOOTSTRAP_EMAIL"
  printf "    🔑 Owner Password: %s\n" "$BOOTSTRAP_PASS"
  printf "    🌐 URL:            %s\n" "$NEXTAUTH_URL_INPUT"
fi

# ---------- 3. 构建 app 镜像 ----------
log "构建 app 镜像 (首次较慢, 约 3-5 分钟)"
$COMPOSE build app
ok "镜像构建完成"

# ---------- 4. 启动基础服务 ----------
log "启动 postgres / redis / minio"
$COMPOSE up -d postgres redis minio
ok "等待 PG/Redis/MinIO 健康 (最多 60s)..."

for i in $(seq 1 30); do
  if $COMPOSE ps postgres | grep -q "healthy" && \
     $COMPOSE ps redis    | grep -q "healthy" && \
     $COMPOSE ps minio    | grep -q "healthy"; then
    ok "基础服务全部 healthy"
    break
  fi
  sleep 2
  [ "$i" -eq 30 ] && err "基础服务超时未 healthy. 看日志: $COMPOSE logs"
done

# ---------- 5. 启动 app ----------
log "启动 app"
$COMPOSE up -d app
sleep 5

# ---------- 6. 跑 migration ----------
log "执行数据库迁移"
$COMPOSE exec -T app npm run db:migrate || warn "migration 跑失败, 手动检查: $COMPOSE exec app npm run db:migrate"
ok "迁移完成"

# ---------- 7. 健康检查 ----------
log "健康检查 (waiting up to 60s)"
HEALTH_URL="http://127.0.0.1:${APP_PORT:-3000}/api/health"
for i in $(seq 1 30); do
  if curl -sf "$HEALTH_URL" >/dev/null 2>&1; then
    ok "app 健康: $HEALTH_URL"
    curl -s "$HEALTH_URL" | head -c 200; echo
    break
  fi
  sleep 2
  [ "$i" -eq 30 ] && err "app 启动超时. 看日志: $COMPOSE logs app"
done

# ---------- 8. 提示 ----------
cat <<EOF

═══════════════════════════════════════════════════════════════
✓ Tandem 部署完成
═══════════════════════════════════════════════════════════════
访问: $NEXTAUTH_URL
登录: $TANDEM_BOOTSTRAP_OWNER_EMAIL / (查 .env.production)

下一步:
  1. 配 HTTPS (Caddy/Nginx 反代, 见 docs/PRODUCTION-DEPLOY.md)
  2. 设备份 cron:
       0 3 * * * cd $ROOT && node scripts/backup-pg.mjs >> /var/log/tandem-backup.log 2>&1
  3. 登录后立刻进 /admin 改 Owner 密码 + 开 MFA
  4. /admin/invite 生成员工邀请码

常用命令:
  查看日志:    $COMPOSE logs -f app
  停止:        $COMPOSE stop
  启动:        $COMPOSE start
  完全停止:    $COMPOSE down (保留数据 volume)
  彻底重置:    $COMPOSE down -v (!! 会删数据 !!)
EOF

#!/bin/bash
set -e

# 瑞诺瓦本地开发环境一键启动脚本
# 用法：./scripts/dev-start-all.sh
# 如需停止：./scripts/dev-stop-all.sh

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
LOG_DIR="$ROOT/.logs/dev"
mkdir -p "$LOG_DIR"

log() { echo "[dev-start] $1"; }

stop_port() {
  local port=$1
  local pids
  pids=$(lsof -ti :"$port" 2>/dev/null || true)
  if [ -n "$pids" ]; then
    log "清理端口 $port 的占用进程: $pids"
    echo "$pids" | xargs kill -9 2>/dev/null || true
  fi
}

check_node_deps() {
  if [ ! -d "$ROOT/node_modules" ]; then
    log "未检测到 node_modules，执行 pnpm install..."
    cd "$ROOT" && pnpm install
  fi
}

start_bg() {
  local name=$1
  local cmd=$2
  local logfile="$LOG_DIR/$name.log"
  log "启动 $name -> $logfile"
  nohup bash -lc "$cmd" > "$logfile" 2>&1 &
}

log "===== 瑞诺瓦开发环境启动 ====="

check_node_deps

# 清理已有占用端口（避免 Turbopack/Next.js 端口冲突）
for port in 5500 5000 5005 5011 5013 5014 5015; do
  stop_port "$port"
done

# 1. API 服务
cd "$ROOT"
start_bg "api-5500" "cd '$ROOT' && pnpm run start:api"

# 2. 核心工作台应用
start_bg "portal-5005" "cd '$ROOT' && pnpm --filter public-portal dev --port 5005"
start_bg "dealer-5000" "cd '$ROOT' && pnpm --filter dealer-workbench dev --port 5000"

# 3. 控制台

# 4. 产品底座

# 5. 品牌站矩阵
start_bg "everhot-5011" "cd '$ROOT' && pnpm --filter everhot-cn dev --port 5011"
start_bg "lithnova-5013" "cd '$ROOT' && pnpm --filter lithnova-cn dev --port 5013"
start_bg "rheem-5014" "cd '$ROOT' && pnpm --filter rheem-cn dev --port 5014"
start_bg "ruud-5015" "cd '$ROOT' && pnpm --filter ruud-cn dev --port 5015"

log "所有服务已后台启动，日志目录: $LOG_DIR"
log "等待服务就绪（最长 60s）..."

# 各服务端点：API 用 /api/v2/auth/me（会 401，只要连通即可），其余用 /
declare -A URLS=(
  [5500]="http://localhost:5500/api/v2/auth/me"
  [5000]="http://localhost:5000/"
  [5005]="http://localhost:5005/"
  [5011]="http://localhost:5011/"
  [5013]="http://localhost:5013/"
  [5014]="http://localhost:5014/"
  [5015]="http://localhost:5015/"
)

for port in 5500 5000 5005 5011 5013 5014 5015; do
  url="${URLS[$port]}"
  status="--"
  for i in $(seq 1 30); do
    code=$(curl -s -o /dev/null -w "%{http_code}" -m 2 "$url" 2>/dev/null || true)
    if [ -n "$code" ] && [ "$code" != "000" ]; then
      status="$code"
      break
    fi
    sleep 2
  done
  printf "  %-6s %s\n" "$port" "$status"
done

log "===== 启动完成 ====="
echo ""
echo "常用入口："
echo "  统一门户/登录: http://localhost:5000/hub"
echo ""
echo "停止所有服务: ./scripts/dev-stop-all.sh"

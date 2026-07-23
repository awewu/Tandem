#!/bin/bash
# 一键根治 designer-workbench dev server：杀旧进程、清缓存、装依赖、启动。

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"
APP_DIR="$ROOT_DIR/apps/designer-workbench"
PORT=4003

echo "=== 1. 清理旧 dev 进程 ==="
# 优先按端口杀
PID=$(lsof -ti :$PORT 2>/dev/null || true)
if [ -n "$PID" ]; then
  echo "  端口 $PORT 被 PID $PID 占用，正在杀死..."
  kill -9 $PID 2>/dev/null || true
  sleep 1
fi
# 兜底：杀所有 next dev
pkill -f "next dev" 2>/dev/null || true
sleep 1

echo "=== 2. 清理 Next.js 缓存 ==="
rm -rf "$APP_DIR/.next"
rm -rf "$APP_DIR/node_modules/.cache" 2>/dev/null || true

echo "=== 3. 安装依赖（workspace 全量） ==="
cd "$ROOT_DIR"
pnpm install --prefer-frozen-lockfile || pnpm install

echo "=== 4. 启动 dev server ==="
cd "$APP_DIR"
echo "  访问 http://localhost:$PORT"
exec pnpm dev --port $PORT

#!/usr/bin/env bash
# run-rysnova-diagnosis-local.sh
# 一键起「瑞诺瓦 AI 问诊（信任→定金）」本地联调三件套：
#   - Nest API  :5500  (start:api 读 .env.nestjs：含 EVERHOT/PUBLIC_DIAGNOSIS_* 上下文)
#   - 旧店 Express :5050 (DIAGNOSIS_COMPLETE_VIA_NEXUS=true → /public/complete 转发 Nest，报告落 Postgres)
#   - Vite      :3000  (页面 + /api 代理到 :5050；打开 http://localhost:3000/pain-diagnosis.html)
#
# 端口说明：Vite 硬编码 3000；旧店走 5050（避开 macOS ControlCenter 占用的 5000）；
#           Vite 代理目标用 VITE_API_PROXY 覆盖到 5050。
#
# 前置：Postgres 已跑且已应用迁移与演示种子（见 scripts/db/：
#   apply-migrations.js、seed-demo-residential-products.sql、
#   seed-demo-dealer-and-collection.sql、grant-app-role-rhautt.sql）。
# Ctrl-C 退出会一并结束三个进程。

set -euo pipefail
cd "$(dirname "$0")/../.."

NEST_PORT=5500
OLD_PORT=5050
VITE_PORT=3000

echo "▶ 清理端口 $NEST_PORT / $OLD_PORT / $VITE_PORT …"
for p in $NEST_PORT $OLD_PORT $VITE_PORT; do
  lsof -ti:$p | xargs kill 2>/dev/null || true
done
sleep 1

pids=()
cleanup() {
  echo; echo "▶ 结束联调进程 …"
  for pid in "${pids[@]:-}"; do kill "$pid" 2>/dev/null || true; done
}
trap cleanup EXIT INT TERM

echo "▶ 启动 Nest API :$NEST_PORT (start:api)"
npm run start:api &
pids+=("$!")

echo "▶ 启动旧店 Express :$OLD_PORT (DIAGNOSIS_COMPLETE_VIA_NEXUS=true)"
PORT=$OLD_PORT \
  DIAGNOSIS_COMPLETE_VIA_NEXUS=true \
  NEXUS_PUBLIC_API_BASE="http://localhost:$NEST_PORT/api/v2" \
  npm run dev:server &
pids+=("$!")

sleep 2
echo "▶ 启动 Vite :$VITE_PORT (代理 /api → :$OLD_PORT)"
echo "  打开：http://localhost:$VITE_PORT/pain-diagnosis.html"
VITE_API_PROXY="http://localhost:$OLD_PORT" npm run dev:client

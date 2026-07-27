#!/bin/bash
# 停止 dev-start-all.sh 启动的所有本地开发服务

log() { echo "[dev-stop] $1"; }

log "清理所有瑞诺瓦开发服务进程..."
for port in 5500 5000 5005 5011 5013 5014 5015; do
  pids=$(lsof -ti :"$port" 2>/dev/null || true)
  if [ -n "$pids" ]; then
    log "释放端口 $port (pids: $pids)"
    echo "$pids" | xargs kill -9 2>/dev/null || true
  fi
done

log "===== 已停止所有服务 ====="

#!/usr/bin/env bash
# Tandem · API smoke (CI/CD)
# 用法: bash scripts/smoke-api.sh [BASE_URL]
set -euo pipefail

BASE="${1:-http://localhost:3001}"

ENDPOINTS=(
  "/api/health"
  "/api/documents?ownerId=demo-user"
  "/api/calendar?ownerId=demo-user"
  "/api/drive?ownerId=demo-user"
  "/api/notifications?userId=demo-user"
  "/api/approvals"
  "/api/meetings/rooms"
  "/api/search?q=test"
  "/api/persona/demo-user"
  "/api/memory"
  "/api/okr/initiatives"
  "/api/okr/checkins"
  "/api/im/channels"
  "/api/1on1"
  "/api/360/cycles"
  "/api/nine-box"
  "/api/audit"
  "/api/dashboard/stats"
  "/api/notifications/badge?userId=demo-user"
)

fail=0
for ep in "${ENDPOINTS[@]}"; do
  code=$(curl -s -o /tmp/body -w '%{http_code}' "$BASE$ep" || echo "000")
  size=$(wc -c < /tmp/body | tr -d ' ')
  if [ "$code" = "200" ]; then
    printf "OK  %s  %-50s  %s bytes\n" "$code" "$ep" "$size"
  else
    printf "ERR %s  %-50s  %s bytes\n" "$code" "$ep" "$size"
    head -c 300 /tmp/body || true
    echo
    fail=1
  fi
done

exit $fail

#!/usr/bin/env bash
#
# Hermes / Tandem · KPI 全流程 smoke test
#
# 用法 (本地 dev server 已在 :3000):
#   COOKIE='session=...; csrf=...' bash scripts/smoke-kpi-flow.sh
#
# 步骤:
#   1. seed-demo                  → 创建 FY2026 演示周期 + KPI + 科目
#   2. analytics company-rollup   → 验证看板数据
#   3. bonus { commit:false }     → 试算
#   4. bonus { commit:true }      → 正式下发
#   5. cycles/:id/close           → 年终关闭
#   6. audit/verify               → 哈希链完整性
#
# 需要 jq + curl.

set -euo pipefail

BASE_URL="${BASE_URL:-http://localhost:3000}"
COOKIE="${COOKIE:-}"
if [[ -z "$COOKIE" ]]; then
  echo "ERROR: COOKIE 未设置. 在浏览器登录后从 DevTools 复制 cookie 头" >&2
  exit 1
fi

CURL="curl -sS -b $COOKIE -H Content-Type:application/json"

step() { echo; echo "==[ $* ]=="; }

step "1) seed-demo"
SEED=$($CURL -X POST "$BASE_URL/api/kpi/seed-demo?force=1")
echo "$SEED" | jq .
CYCLE_ID=$(echo "$SEED" | jq -r .cycleId)
echo "→ cycleId = $CYCLE_ID"

step "2) analytics · company-rollup"
$CURL "$BASE_URL/api/kpi/analytics?view=company-rollup&cycleId=$CYCLE_ID" | jq '.rollup // .'

step "3) bonus 试算 (draft)"
BASE_BONUSES='{"demo-star":50000,"demo-burnout":40000,"demo-mismatch":30000,"demo-intervene":20000}'
$CURL -X POST "$BASE_URL/api/kpi/cycles/$CYCLE_ID/bonus" \
  -d "{\"baseBonuses\":$BASE_BONUSES,\"commit\":false}" | jq '.summary'

step "4) bonus 正式下发"
$CURL -X POST "$BASE_URL/api/kpi/cycles/$CYCLE_ID/bonus" \
  -d "{\"baseBonuses\":$BASE_BONUSES,\"commit\":true}" | jq '.summary'

step "5) 年终关闭"
$CURL -X POST "$BASE_URL/api/kpi/cycles/$CYCLE_ID/close" \
  -d '{}' | jq .

step "6) audit verify"
$CURL "$BASE_URL/api/audit/verify" | jq .

echo
echo "✅ smoke 全流程通过"

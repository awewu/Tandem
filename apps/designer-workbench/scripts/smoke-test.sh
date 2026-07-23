#!/usr/bin/env bash
# W-BIM-4/5 · designer-workbench  smoke test
# 运行前：npm install 且后端 API 已启动
set -e
BASE=${NEXT_PUBLIC_BASE_URL:-http://localhost:5003}

echo "[smoke] designer-workbench routes"
for route in /viewer /floor-plan /system-model /bom /ai-design; do
  code=$(curl -s -o /dev/null -w "%{http_code}" "${BASE}${route}" || true)
  echo "  ${route} -> ${code}"
done

echo "[smoke] sample IFC public/small.ifc present"
if [ -f "$(dirname "$0")/../public/small.ifc" ]; then
  echo "  OK"
else
  echo "  MISSING: copy a sample IFC to public/small.ifc"
fi

API=${NEXT_PUBLIC_API_URL:-http://localhost:5500}
echo "[smoke] backend public/boundary endpoints"
for endpoint in /api/ai-design/boundary /api/product-catalog/boundary /api/design/boundary; do
  code=$(curl -s -o /dev/null -w "%{http_code}" "${API}${endpoint}" || true)
  echo "  ${endpoint} -> ${code}"
done

echo "[smoke] done"

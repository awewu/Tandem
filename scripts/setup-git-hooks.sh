#!/bin/sh
# 安装 Tandem git 钩子到本地 .git/hooks。
# 用法: bash scripts/setup-git-hooks.sh
set -e

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SRC="$ROOT/scripts/git-hooks"
DEST="$ROOT/.git/hooks"

if [ ! -d "$ROOT/.git" ]; then
  echo "❌ 未找到 .git 目录（$ROOT/.git）"; exit 1
fi
mkdir -p "$DEST"

for hook in pre-commit; do
  if [ -f "$SRC/$hook" ]; then
    cp "$SRC/$hook" "$DEST/$hook"
    chmod +x "$DEST/$hook" 2>/dev/null || true
    echo "✓ 已安装 $hook"
  fi
done

echo "🟢 git 钩子安装完成"

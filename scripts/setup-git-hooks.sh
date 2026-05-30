#!/bin/sh
# 安装 Tandem git hooks (pre-commit 等)
# 在 clone 后跑一次: bash scripts/setup-git-hooks.sh
set -e
REPO_ROOT="$(git rev-parse --show-toplevel)"
HOOK_SRC="$REPO_ROOT/scripts/git-hooks"
HOOK_DST="$REPO_ROOT/.git/hooks"

echo "Installing Tandem git hooks..."
for hook in pre-commit; do
  cp "$HOOK_SRC/$hook" "$HOOK_DST/$hook"
  chmod +x "$HOOK_DST/$hook"
  echo "  ✓ $hook"
done

echo ""
echo "Done. Hooks installed:"
ls -la "$HOOK_DST" | grep -v sample | grep -v "^d" | grep -v "^total"
echo ""
echo "Test: try 'git commit' — pre-commit will run tsc + UI charter ratchet."

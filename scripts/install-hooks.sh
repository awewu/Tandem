#!/bin/sh
# 安装 Tandem 工作流 git hooks (反推到重建).
# 用法: sh scripts/install-hooks.sh
# 说明: .git/hooks/ 不在 repo 跟踪范围, 必须手动安装一次.
#       新 clone 仓库后第一件事跑这个.

set -e
HOOKS_DIR="$(git rev-parse --git-dir)/hooks"

cat > "$HOOKS_DIR/pre-commit" <<'PRECOMMIT'
#!/bin/sh
# Tandem pre-commit gate — 防止退化提交
# 4 条铁律的工程层兜底.
# 跳过: 临时可用 git commit --no-verify (但要在 commit message 里说明理由)

echo "🔒 Tandem pre-commit gate · 检查中..."

# 1. TypeScript 0 errors
echo "  [1/2] npx tsc --noEmit ..."
npx tsc --noEmit 2>&1 | grep -E "error TS" | head -20
TSC_ERRORS=$(npx tsc --noEmit 2>&1 | grep -c "error TS")
if [ "$TSC_ERRORS" -gt 0 ]; then
  echo ""
  echo "  ❌ tsc found $TSC_ERRORS error(s). 修完再 commit."
  echo "     (强制提交: git commit --no-verify -m '...' + 在 message 解释)"
  exit 1
fi
echo "  ✓ tsc clean"

# 2. 检查砍页警示: 是否新增了 redirect-only 文件
echo "  [2/2] 检查 redirect-only 砍页 (反推到重建)..."
SUSPICIOUS=$(git diff --cached --name-only --diff-filter=A | grep "page\.tsx$" | xargs -I {} sh -c 'lines=$(wc -l < "{}" 2>/dev/null || echo 0); if [ "$lines" -lt 20 ] && grep -q "redirect" "{}"; then echo "{}"; fi' 2>/dev/null)
if [ -n "$SUSPICIOUS" ]; then
  echo ""
  echo "  ⚠ 新增了 redirect-only 短文件:"
  echo "$SUSPICIOUS"
  echo "     这通常是砍页 — 请确认:"
  echo "     1. 已经 git log 看过原文件功能"
  echo "     2. 已经在 commit message 写明 '为什么删'"
  echo "     3. 不是误删了已有业务页"
  echo "     (强制提交: git commit --no-verify)"
  exit 1
fi
echo "  ✓ 无可疑砍页"

echo "🟢 pre-commit 通过"
exit 0
PRECOMMIT

chmod +x "$HOOKS_DIR/pre-commit"
echo "✅ pre-commit hook 已装到 $HOOKS_DIR/pre-commit"
echo ""
echo "测试: sh $HOOKS_DIR/pre-commit"

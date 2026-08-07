#!/usr/bin/env node
/**
 * _artifact-gate — 产物闸门（harness 工程学）。
 *
 * 问题：多个门禁硬依赖**未生成/已退役**的产物：
 *   · `archive/legacy-ui/**`（遗留 UI 已归档移除，且 archive/ 在 .gitignore）
 *   · `docs/_archive/**`（git 历史 0 次，从未入库）
 *   · `apps/nexus-console/**`（该前端不存在，实际控制台为 apps/dealer-workbench）
 * 结果：门禁在任何干净检出/CI 上恒红 → 整个门禁体系信噪比崩塌、真问题被淹没
 * （实测曾有 27 项红，其中仅 5 项是真问题）。
 *
 * 处置原则（不删门禁、不伪造产物）：
 *   产物存在 → 门禁照常严格执行；
 *   产物缺失 → 打印 `SKIPPED: ...` 并 exit 0，由 guard:ledger 记为 SKIP（不计通过、不阻断）。
 * 这样既保留了产物恢复后的守护能力，又杜绝"永久红灯"。
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');

/**
 * 要求产物存在，否则 SKIP 退出。
 * @param {string|string[]} relativePaths 必需产物（任一缺失即 skip）
 * @param {{reason?: string, guard?: string}} [options]
 */
function requireArtifactOrSkip(relativePaths, options = {}) {
  const list = Array.isArray(relativePaths) ? relativePaths : [relativePaths];
  const missing = list.filter((rel) => !fs.existsSync(path.join(ROOT, rel)));
  if (!missing.length) return;

  const guard = options.guard ? `${options.guard}: ` : '';
  const reason = options.reason ? `（${options.reason}）` : '';
  console.log(`SKIPPED: ${guard}缺少产物 ${missing.join(', ')}${reason} —— 产物恢复/生成后本门禁自动恢复严格校验。`);
  process.exit(0);
}

module.exports = { ROOT, requireArtifactOrSkip };

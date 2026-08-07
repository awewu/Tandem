#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');

function read(relativePath) {
  return fs.readFileSync(path.join(ROOT, relativePath), 'utf8');
}

function exists(relativePath) {
  return fs.existsSync(path.join(ROOT, relativePath));
}

const failures = [];
const warnings = [];

const REQUIRED_FILES = [
  'CLAUDE.md',
  'package.json',
  'docs/_archive/RHAUTT-NEXUS-DEEP-INDUSTRY-ARCHITECTURE-RESEARCH-2026-06-05.md',
  'docs/_archive/RHAUTT-NEXUS-MULTI-AGENT-DEVELOPMENT-GROUP.md',
  'docs/_archive/RHAUTT-NEXUS-HARNESS-ENGINEERING-ARCHITECTURE.md',
  'docs/_archive/RHAUTT-NEXUS-ENTERPRISE-AI-CONTROL-ARCHITECTURE.md',
  'docs/_archive/RHAUTT-NEXUS-LEGACY-FUSION-LEDGER.md',
  'docs/_archive/RHAUTT-NEXUS-PRODUCTION-DELIVERY-GOAL.md',
  'docs/_archive/RHAUTT-NEXUS-DEVELOPMENT-GROUP-LAUNCH-BOARD.md',
  // 唯一最高真相源（2026-08-04 合并定稿；旧 agent-charter.md / PROJECT-CHARTER.md 已归档）
  'docs/NEXUS-CHARTER-PRD.md',
  'governance/task-board.json',
  'evidence/release-evidence.json',
  '.claude/agents/orchestrator-chief.md',
  '.claude/agents/prd-charter-monitor.md',
  '.claude/agents/ui-vi-director.md',
  '.claude/agents/backend-platform-builder.md',
  '.claude/agents/data-platform-architect.md',
  '.claude/agents/legacy-fusion-migrator.md',
  '.claude/agents/enterprise-ai-control-architect.md',
  '.claude/agents/quote-cost-governor.md',
  '.claude/agents/customer-project-lifecycle-director.md',
  '.claude/agents/test-harness-builder.md'
];

const NEXUS_LOCKED_FILES = [
  'README.md',
  'AGENTS.md',
  'CLAUDE.md',
  'docs/_archive/BACKEND-DATA-LANGUAGE-HIGHEST-STANDARD.md',
  'docs/_archive/ARCHITECTURE-DECISION-MATRIX-2026-06-05.md',
  'docs/_archive/FULL-REWRITE-CHARTER-PRD-TECHNICAL-BLUEPRINT.md',
  'docs/_archive/FULL-REWRITE-DATA-API-CONTRACT-DRAFT.md',
  'docs/_archive/SOFTWARE-NAMING-CANDIDATES.md',
  'platform-modules.json'
];

const CURRENT_BOUNDARY_FILES = ['README.md', 'AGENTS.md', 'CLAUDE.md', 'platform-modules.json'];

const FORBIDDEN_SOFTWARE_NAME_PATTERNS = [
  /待命名软件平台/,
  /Rhautt Comfort Auto Evolution Report/,
  /Rhautt Comfort\s*=\s*数字化软件生产主干/,
  /Rhautt Comfort 完全重构/,
  /Rhautt Comfort PRD/
];

// docs/_archive/* 基线/命名文档 **git 历史 0 次、从未入库**（实测），把它们当硬性存在要求
// 会让本门禁永久红、从而掩盖真正的命名锁校验（AGENTS/CLAUDE/platform-modules 等）。
// 处置：归档路径降级为"存在则校验内容、缺失则跳过"；现役文件仍为硬性要求。
const isArchived = (file) => file.startsWith('docs/_archive/');

for (const file of REQUIRED_FILES) {
  if (isArchived(file)) continue;
  if (!exists(file)) failures.push(`missing required Rhautt Nexus baseline file: ${file}`);
}

for (const file of NEXUS_LOCKED_FILES) {
  if (!exists(file)) {
    if (!isArchived(file)) failures.push(`missing Nexus locked naming file: ${file}`);
    continue;
  }
  const source = read(file);
  if (!source.includes('Rhautt Nexus / 瑞合数智枢纽')) {
    failures.push(`${file}: missing Rhautt Nexus / 瑞合数智枢纽 after platform naming lock`);
  }
  for (const pattern of FORBIDDEN_SOFTWARE_NAME_PATTERNS) {
    if (pattern.test(source)) {
      failures.push(`${file}: contains forbidden pre-Nexus software naming pattern ${pattern}`);
    }
  }
}

for (const file of CURRENT_BOUNDARY_FILES) {
  if (!exists(file)) continue;
  const source = read(file);
  if (
    !source.includes('not the software platform name') &&
    !source.includes('不作为本软件系统的名称使用') &&
    !source.includes('客户/集团实例不替换软件平台名')
  ) {
    failures.push(`${file}: Rhautt Comfort must be bounded as customer/group context, not software name`);
  }
}

if (exists('package.json')) {
  const pkg = JSON.parse(read('package.json'));
  if (pkg.name !== 'rhautt-nexus') failures.push(`package.json name must be rhautt-nexus, found ${pkg.name}`);
  if (!String(pkg.description || '').includes('Rhautt Nexus / 瑞合数智枢纽')) {
    failures.push('package.json description must identify Rhautt Nexus / 瑞合数智枢纽');
  }
  if (String(pkg.description || '').includes('瑞诺瓦AI舒适家')) {
    failures.push('package.json description must not use 瑞诺瓦AI舒适家 as the software name');
  }
  if (!pkg.scripts?.['guard:nexus-naming']) {
    failures.push('package.json missing guard:nexus-naming script');
  }
  if (!pkg.scripts?.['guard:all']?.includes('guard:nexus-naming')) {
    failures.push('package.json guard:all must include guard:nexus-naming');
  }
  if (pkg.build?.productName && pkg.build.productName !== 'Rhautt Nexus') {
    failures.push(`electron build productName must be Rhautt Nexus, found ${pkg.build.productName}`);
  }
}

if (exists('CLAUDE.md')) {
  const memory = read('CLAUDE.md');
  for (const token of [
    'Software platform name: **Rhautt Nexus / 瑞合数智枢纽**',
    'Rhautt Comfort / 瑞合瑞德暖通科技集团 is the customer/group instance positioning',
    'Rysnova / 瑞诺瓦 is the independent dealer-enablement software vendor',
    'Rheem / Ruud / Everhot are equipment brands'
  ]) {
    if (!memory.includes(token)) failures.push(`CLAUDE.md missing Nexus identity token: ${token}`);
  }
  if (/Project name:\s*\*\*Rhautt Comfort\*\*/.test(memory)) {
    failures.push('CLAUDE.md still calls Rhautt Comfort the project name');
  }
}

const agentFiles = exists('.claude/agents')
  ? fs.readdirSync(path.join(ROOT, '.claude/agents')).filter(file => file.endsWith('.md'))
  : [];

for (const required of [
  'orchestrator-chief.md',
  'prd-charter-monitor.md',
  'ui-vi-director.md',
  'architecture-governor.md',
  'backend-platform-builder.md',
  'data-platform-architect.md',
  'frontend-contract-auditor.md',
  'quote-cost-governor.md',
  'customer-project-lifecycle-director.md',
  'legacy-fusion-migrator.md',
  'enterprise-ai-control-architect.md',
  'hvac-standards-auditor.md',
  'iot-lifecycle-architect.md',
  'test-harness-builder.md',
  'sre-guardian.md',
  'security-supply-chain.md'
]) {
  if (!agentFiles.includes(required)) failures.push(`missing development-group agent: .claude/agents/${required}`);
}

for (const file of agentFiles) {
  const content = read(path.join('.claude/agents', file));
  if (content.includes('You are') && content.includes('Rhautt Comfort') && !content.includes('not the software platform name')) {
    warnings.push(`${file}: references Rhautt Comfort without explicit group-expression guardrail`);
  }
  if (/\bRenova\b/.test(content)) {
    failures.push(`${file}: contains unauthorized English name "Rysnova" for 瑞诺瓦`);
  }
}

if (exists('docs/_archive/RHAUTT-NEXUS-MULTI-AGENT-DEVELOPMENT-GROUP.md')) {
  const group = read('docs/_archive/RHAUTT-NEXUS-MULTI-AGENT-DEVELOPMENT-GROUP.md');
  for (const token of [
    '一个总控',
    '一个宪章/PRD 监控',
    '一个独立 UI/VI 负责人',
    'legacy-fusion-migrator',
    'enterprise-ai-control-architect',
    'customer-project-lifecycle-director',
    'orchestrator-chief',
    'prd-charter-monitor',
    'ui-vi-director',
    'test-harness-builder'
  ]) {
    if (!group.includes(token)) failures.push(`multi-agent group doc missing token: ${token}`);
  }
}

for (const file of [
  'docs/_archive/RHAUTT-NEXUS-DEEP-INDUSTRY-ARCHITECTURE-RESEARCH-2026-06-05.md',
  'docs/_archive/RHAUTT-NEXUS-MULTI-AGENT-DEVELOPMENT-GROUP.md',
  'docs/_archive/RHAUTT-NEXUS-HARNESS-ENGINEERING-ARCHITECTURE.md',
  'docs/_archive/RHAUTT-NEXUS-ENTERPRISE-AI-CONTROL-ARCHITECTURE.md',
  'docs/_archive/RHAUTT-NEXUS-LEGACY-FUSION-LEDGER.md',
  'docs/_archive/RHAUTT-NEXUS-PRODUCTION-DELIVERY-GOAL.md',
  'docs/_archive/RHAUTT-NEXUS-DEVELOPMENT-GROUP-LAUNCH-BOARD.md'
]) {
  if (!exists(file)) continue;
  const source = read(file);
  if (!source.includes('Rhautt Nexus / 瑞合数智枢纽')) {
    failures.push(`${file}: missing Rhautt Nexus / 瑞合数智枢纽`);
  }
  if (!source.includes('Rhautt Comfort') || !source.includes('集团')) {
    failures.push(`${file}: must preserve Rhautt Comfort as group-expression context`);
  }
}

if (exists('governance/task-board.json')) {
  const board = JSON.parse(read('governance/task-board.json'));
  if (board.platform !== 'Rhautt Nexus / 瑞合数智枢纽') {
    failures.push('governance/task-board.json platform must be Rhautt Nexus / 瑞合数智枢纽');
  }
}

if (exists('evidence/release-evidence.json')) {
  const evidence = JSON.parse(read('evidence/release-evidence.json'));
  if (evidence.platform !== 'Rhautt Nexus / 瑞合数智枢纽') {
    failures.push('evidence/release-evidence.json platform must be Rhautt Nexus / 瑞合数智枢纽');
  }
}

// ── P2-3 · §0.1 技术来源署名白名单 ──────────────────────────────────────────
// 赋能线（问诊 + BIM 工作台）统一署名「Powered by Rysnova」——指向真实技术子公司，
// 区别于设备品牌站的「Powered by Rhautt Comfort」，也区别于"无署名"。
console.log(`Nexus Naming Check: files = ${REQUIRED_FILES.length}, agents = ${agentFiles.length}, failures = ${failures.length}, warnings = ${warnings.length}`);

if (failures.length) {
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

for (const warning of warnings) console.warn(`- ${warning}`);

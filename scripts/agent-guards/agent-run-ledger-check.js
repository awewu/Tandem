#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');
const LEDGER_PATH = 'governance/agent-runs.json';
const BOARD_PATH = 'audit/agent-progress-board.md';
const WRITE_BOARD = process.argv.includes('--write-board');

const REQUIRED_OWNERS = [
  'orchestrator-chief',
  'prd-charter-monitor',
  'product-domain-critic',
  'ui-vi-director',
  'architecture-governor',
  'backend-platform-builder',
  'data-platform-architect',
  'legacy-fusion-migrator',
  'frontend-contract-auditor',
  'enterprise-ai-control-architect',
  'quote-cost-governor',
  'solution-design-rysnova-bim-director',
  'hvac-standards-auditor',
  'rysnova-bim-engineering-builder',
  'customer-project-lifecycle-director',
  'iot-lifecycle-architect',
  'test-harness-builder',
  'sre-guardian',
  'security-supply-chain'
];

const REQUIRED_GAPS = [
  'guard:all',
  'staging/network capacity',
  'browser visual',
  'object storage',
  'PostgreSQL staging',
  'Temporal runtime',
  'Redis staging',
  'Next/Nx/NestJS/Fastify',
  '105 legacy HTML',
  'independent multi-agent execution'
];

const REQUIRED_PROGRESS_FIELDS = [
  'percent',
  'stage',
  'currentFocus',
  'latestEvidence',
  'nextMilestone',
  'blockerSummary'
];

function absolute(relativePath) {
  return path.join(ROOT, relativePath);
}

function exists(relativePath) {
  return fs.existsSync(absolute(relativePath));
}

function read(relativePath) {
  return fs.readFileSync(absolute(relativePath), 'utf8');
}

function toArray(value) {
  return Array.isArray(value) ? value : [];
}

function hasText(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function includesAnyText(items, tokens) {
  const source = toArray(items).join('\n');
  return tokens.some(token => source.includes(token));
}

function evidencePathExists(evidencePath) {
  if (!hasText(evidencePath)) return false;
  if (/^https?:\/\//.test(evidencePath)) return true;
  return exists(evidencePath);
}

function tableCell(value) {
  return String(value ?? '')
    .replace(/\r?\n/g, ' ')
    .replace(/\|/g, '\\|')
    .trim();
}

function renderProgressBoard(ledger) {
  const rows = toArray(ledger.runs).map(run => {
    const progress = run.progress || {};
    return [
      `\`${tableCell(run.owner)}\``,
      tableCell(run.lane),
      `${Number(progress.percent || 0)}%`,
      tableCell(progress.stage),
      tableCell(progress.currentFocus),
      `\`${tableCell(progress.latestEvidence)}\``,
      tableCell(progress.blockerSummary)
    ].join(' | ');
  });

  const uiRun = toArray(ledger.runs).find(run => run.owner === 'ui-vi-director');
  const uiStage = String(uiRun?.progress?.stage || '');
  const uiHardTruth = uiStage.includes('rheem-vi-strict-pass-visual-proof-pending')
    ? 'Rheem VI strict production audit passes with 0 findings, but browser visual proof is still required before final UI/VI launch claims.'
    : '瑞诺瓦 AI 问诊 C-end UI/VI remains blocked until the approved page refactor and browser visual proof are refreshed.';

  return [
    '# 瑞诺瓦AI舒适家 Agent Progress Board',
    '',
    `Generated: ${ledger.updatedAt}`,
    '',
    `Source: ${LEDGER_PATH}`,
    '',
    'This board is an auditable progress display, not proof of independent parallel model execution or production completion.',
    '',
    '| Agent | Lane | Progress | Stage | Current Focus | Latest Evidence | Blocker / Gap |',
    '|---|---:|---:|---|---|---|---|',
    ...rows.map(row => `| ${row} |`),
    '',
    '## Hard Truths',
    '',
    `- ${uiHardTruth}`,
    '- Staging/network capacity, PostgreSQL staging, Temporal runtime, Redis staging, object storage, target Next/Nx/NestJS/Fastify boot proof, and full browser visual evidence are still required before production launch claims.',
    '- This board is machine-checked by `npm run guard:agent-runs` and exposed to headquarters users through `/api/v2/governance/agent-progress`.',
    ''
  ].join('\n');
}

function main() {
  const failures = [];
  const warnings = [];

  if (!exists(LEDGER_PATH)) {
    console.error(`Agent Run Ledger Check: missing ${LEDGER_PATH}`);
    process.exit(1);
  }

  let ledger;
  try {
    ledger = JSON.parse(read(LEDGER_PATH));
  } catch (error) {
    console.error(`Agent Run Ledger Check: invalid JSON in ${LEDGER_PATH}: ${error.message}`);
    process.exit(1);
  }

  if (WRITE_BOARD) {
    fs.writeFileSync(absolute(BOARD_PATH), renderProgressBoard(ledger));
    console.log(`Agent Progress Board written: ${BOARD_PATH}`);
  }

  if (ledger.platform !== 'Rhautt Nexus / 瑞合数智枢纽') {
    failures.push(`${LEDGER_PATH}: platform must be Rhautt Nexus / 瑞合数智枢纽`);
  }

  const status = String(ledger.status || '');
  if (!status.includes('active-auditable-orchestration')) {
    failures.push(`${LEDGER_PATH}: status must describe active auditable orchestration`);
  }
  if (/(production[-_\s]*complete|complete-production|final-complete)/i.test(status)) {
    failures.push(`${LEDGER_PATH}: status must not claim production completion`);
  }
  if (!status.includes('not-independent-parallel-runtime')) {
    failures.push(`${LEDGER_PATH}: status must be honest that this is not independent parallel runtime proof`);
  }

  if (!hasText(ledger.updatedAt)) {
    failures.push(`${LEDGER_PATH}: updatedAt is required`);
  }

  const description = String(ledger.description || '');
  for (const token of [
    'not proof that independent model workers ran in parallel',
    'engineering control surface',
    'guard'
  ]) {
    if (!description.includes(token)) {
      failures.push(`${LEDGER_PATH}: description missing honesty/control token: ${token}`);
    }
  }

  const truths = toArray(ledger.truths);
  for (const token of [
    'Rhautt Comfort / 瑞合瑞德暖通科技集团 is the group expression',
    'Rhautt Nexus / 瑞合数智枢纽 is the software platform name',
    '瑞诺瓦',
    'must not be translated as Rysnova',
    'Rheem / Ruud / Everhot are equipment brands',
    'lifecycle handoff only'
  ]) {
    if (!truths.some(truth => String(truth).includes(token))) {
      failures.push(`${LEDGER_PATH}: truths missing token: ${token}`);
    }
  }

  const gapText = toArray(ledger.remainingProductionGaps).join('\n');
  for (const token of REQUIRED_GAPS) {
    if (!gapText.includes(token)) {
      failures.push(`${LEDGER_PATH}: remainingProductionGaps missing token: ${token}`);
    }
  }

  const runs = toArray(ledger.runs);
  if (!runs.length) failures.push(`${LEDGER_PATH}: runs must be a non-empty array`);

  const byOwner = new Map();
  for (const run of runs) {
    if (!hasText(run.owner)) {
      failures.push(`${LEDGER_PATH}: every run requires owner`);
      continue;
    }
    if (byOwner.has(run.owner)) failures.push(`${LEDGER_PATH}: duplicate owner run: ${run.owner}`);
    byOwner.set(run.owner, run);
  }

  for (const owner of REQUIRED_OWNERS) {
    if (!byOwner.has(owner)) failures.push(`${LEDGER_PATH}: missing required owner run: ${owner}`);
  }

  for (const owner of REQUIRED_OWNERS) {
    const run = byOwner.get(owner);
    if (!run) continue;

    for (const field of ['lane', 'status', 'startedAt', 'updatedAt']) {
      if (!hasText(run[field])) failures.push(`${owner}: missing required field ${field}`);
    }

    for (const field of ['inputs', 'outputs', 'evidence', 'openRisks', 'nextActions', 'guards', 'harnesses']) {
      if (!Array.isArray(run[field]) || run[field].length === 0) {
        failures.push(`${owner}: ${field} must be a non-empty array`);
      }
    }

    if (!Array.isArray(run.blockers)) failures.push(`${owner}: blockers must be an array`);

    if (!run.progress || typeof run.progress !== 'object' || Array.isArray(run.progress)) {
      failures.push(`${owner}: progress must be a structured object for UI progress display`);
    } else {
      for (const field of REQUIRED_PROGRESS_FIELDS) {
        if (field === 'percent') continue;
        if (!hasText(run.progress[field])) {
          failures.push(`${owner}: progress.${field} is required`);
        }
      }
      if (!Number.isFinite(run.progress.percent) || run.progress.percent < 0 || run.progress.percent > 100) {
        failures.push(`${owner}: progress.percent must be a number from 0 to 100`);
      }
      if (run.progress.percent >= 100) {
        failures.push(`${owner}: progress.percent must not be 100 before production completion evidence is proven`);
      }
      if (!toArray(run.evidence).includes(run.progress.latestEvidence)) {
        failures.push(`${owner}: progress.latestEvidence must reference one of the run evidence entries`);
      }
    }

    const runStatus = String(run.status || '');
    if (/(production[-_\s]*complete|final[-_\s]*complete|done-production)/i.test(runStatus)) {
      failures.push(`${owner}: run status must not claim production completion`);
    }

    const allText = JSON.stringify(run);
    if (/\bRenova\b/.test(allText)) {
      failures.push(`${owner}: unauthorized English name "Rysnova" appears in ledger run`);
    }
    if (/real[-_\s]*time device control|实时控制平台/.test(allText) && !/not real-time|不是实时|不宣称/.test(allText)) {
      failures.push(`${owner}: IoT wording risks implying real-time control ownership`);
    }

    for (const evidencePath of toArray(run.evidence)) {
      if (!evidencePathExists(evidencePath)) {
        failures.push(`${owner}: evidence path does not exist: ${evidencePath}`);
      }
    }
  }

  const prd = byOwner.get('prd-charter-monitor');
  if (prd && !includesAnyText(prd.evidence, ['locked-goal', 'nexus-naming', 'PRD', 'LOCKED-GOAL'])) {
    failures.push('prd-charter-monitor: evidence must reference locked goal, PRD, or naming guard evidence');
  }

  const ui = byOwner.get('ui-vi-director');
  if (ui && !includesAnyText(ui.evidence.concat(ui.inputs), ['RUUD', 'Ruud', 'VI', 'visual', 'browser-visual'])) {
    failures.push('ui-vi-director: evidence must reference Ruud/VI or browser visual evidence');
  }
  if (ui && !toArray(ui.openRisks).join('\n').includes('Ruud.com latest full-page review is not proven')) {
    failures.push('ui-vi-director: must state current Ruud.com latest full-page review proof gap honestly');
  }

  const test = byOwner.get('test-harness-builder');
  if (test && !includesAnyText(test.evidence.concat(test.guards).concat(test.harnesses), ['guard', 'harness', 'test/production-readiness'])) {
    failures.push('test-harness-builder: evidence must reference guard/harness/test evidence');
  }

  const legacy = byOwner.get('legacy-fusion-migrator');
  if (legacy && !includesAnyText(legacy.evidence.concat(legacy.inputs), ['legacy', '105', 'manifest'])) {
    failures.push('legacy-fusion-migrator: evidence must reference legacy manifest/fusion evidence');
  }

  const product = byOwner.get('product-domain-critic');
  if (product && !includesAnyText(product.evidence.concat(product.inputs), ['feature-granularity', 'PROJECT-CHARTER', 'PRD', 'industry', 'competitor'])) {
    failures.push('product-domain-critic: evidence must reference PRD, feature granularity, industry, or competitor evidence');
  }

  const hvac = byOwner.get('hvac-standards-auditor');
  if (hvac && !includesAnyText(hvac.evidence.concat(hvac.inputs), ['COMFORT-HOME-STANDARDS', 'standards', 'standards-metadata', 'HVAC'])) {
    failures.push('hvac-standards-auditor: evidence must reference comfort-home standards or standards metadata evidence');
  }

  const data = byOwner.get('data-platform-architect');
  if (data && !includesAnyText(data.evidence.concat(data.inputs), ['postgres', 'RLS', 'database'])) {
    failures.push('data-platform-architect: evidence must reference PostgreSQL/RLS/database evidence');
  }

  const ledgerText = JSON.stringify(ledger);
  const unsupportedIndependentClaim =
    /(true|proven|verified|completed)\s+independent\s+(multi-agent|agent|parallel)/i.test(ledgerText) ||
    /(real|actual)\s+parallel\s+model\s+(execution|runtime)\s+(is\s+)?(proven|complete|running)/i.test(ledgerText);
  if (unsupportedIndependentClaim) {
    failures.push(`${LEDGER_PATH}: must not claim true independent parallel model execution`);
  }

  if (!ledgerText.includes('ledger alone is not production completion evidence')) {
    failures.push(`${LEDGER_PATH}: must explicitly state ledger alone is not production completion evidence`);
  }

  if (!exists(BOARD_PATH)) {
    failures.push(`${BOARD_PATH}: missing generated agent progress board`);
  } else {
    const expectedBoard = renderProgressBoard(ledger);
    const actualBoard = read(BOARD_PATH);
    if (actualBoard !== expectedBoard) {
      failures.push(`${BOARD_PATH}: stale or manually drifted; run npm run governance:agent-progress-board`);
    }
  }

  if (warnings.length) {
    for (const warning of warnings) console.warn(`- ${warning}`);
  }

  console.log(`Agent Run Ledger Check: owners=${byOwner.size}, required=${REQUIRED_OWNERS.length}, failures=${failures.length}, warnings=${warnings.length}`);

  if (failures.length) {
    for (const failure of failures) console.error(`- ${failure}`);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = {
  BOARD_PATH,
  LEDGER_PATH,
  renderProgressBoard
};

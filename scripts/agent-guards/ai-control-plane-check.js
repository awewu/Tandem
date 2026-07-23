#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '../..');

const REQUIRED_FILES = [
  'CLAUDE.md',
  '.claude/settings.json',
  '.claude/rules/architecture.md',
  '.claude/rules/product-surface.md',
  '.claude/rules/standards.md',
  '.claude/rules/lifecycle-iot.md',
  '.claude/commands/audit-product.md',
  '.claude/commands/refactor-routes.md',
  '.claude/commands/check-standards.md',
  '.claude/commands/production-gate.md',
  '.claude/agents/orchestrator-chief.md',
  '.claude/agents/prd-charter-monitor.md',
  '.claude/agents/architecture-governor.md',
  '.claude/agents/sre-guardian.md',
  '.claude/agents/security-supply-chain.md',
  '.claude/agents/product-domain-critic.md',
  '.claude/agents/backend-platform-builder.md',
  '.claude/agents/data-platform-architect.md',
  '.claude/agents/legacy-fusion-migrator.md',
  '.claude/agents/enterprise-ai-control-architect.md',
  '.claude/agents/frontend-contract-auditor.md',
  '.claude/agents/quote-cost-governor.md',
  '.claude/agents/solution-design-rysnova-bim-director.md',
  '.claude/agents/rysnova-bim-engineering-builder.md',
  '.claude/agents/customer-project-lifecycle-director.md',
  '.claude/agents/hvac-standards-auditor.md',
  '.claude/agents/iot-lifecycle-architect.md',
  '.claude/agents/test-harness-builder.md',
  '.claude/agents/ui-vi-director.md',
  'governance/agent-runs.json',
  'scripts/agent-guards/agent-run-ledger-check.js'
];

function read(relativePath) {
  return fs.readFileSync(path.join(ROOT, relativePath), 'utf8');
}

function exists(relativePath) {
  return fs.existsSync(path.join(ROOT, relativePath));
}

function fail(message, evidence = []) {
  return { status: 'fail', message, evidence };
}

function pass(message, evidence = []) {
  return { status: 'pass', message, evidence };
}

function checkRequiredFiles() {
  const missing = REQUIRED_FILES.filter(file => !exists(file));
  return missing.length
    ? fail('AI control-plane files are missing', missing)
    : pass('AI control-plane files are present', { count: REQUIRED_FILES.length });
}

function checkClaudeMemory() {
  const content = read('CLAUDE.md');
  const required = [
    '瑞诺瓦AI舒适家',
    'Rhautt Comfort / 瑞合瑞德暖通科技集团 is the group English/Chinese expression',
    '/api/v2',
    'routeOwnership',
    'Lifecycle IoT',
    'China mandatory general codes',
    'harness:consolidation'
  ];
  const missing = required.filter(token => !content.includes(token));
  return missing.length
    ? fail('CLAUDE.md is missing current project memory tokens', missing)
    : pass('CLAUDE.md captures current architecture memory');
}

function checkAgents() {
  const agents = fs.readdirSync(path.join(ROOT, '.claude/agents')).filter(file => file.endsWith('.md'));
  return agents.length >= 19
    ? pass('Specialized Claude cowork agents are configured', { agents: agents.length })
    : fail('Expected at least 19 specialized agents', agents);
}

function checkSettingsCommands() {
  const settings = JSON.parse(read('.claude/settings.json'));
  const commands = settings.slash_commands || {};
  const required = ['harness', 'prod-test'];
  const missing = required.filter(name => !commands[name]);
  return missing.length
    ? fail('Claude settings are missing required slash commands', missing)
    : pass('Claude settings expose project quality commands');
}

function checkAgentRunLedger() {
  const ledger = JSON.parse(read('governance/agent-runs.json'));
  const requiredOwners = [
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
  const runs = Array.isArray(ledger.runs) ? ledger.runs : [];
  const owners = new Set(runs.map(run => run.owner));
  const missing = requiredOwners.filter(owner => !owners.has(owner));
  const ledgerText = JSON.stringify(ledger);
  const falseClaim =
    /production[-_\s]*complete/i.test(String(ledger.status || '')) ||
    /(true|proven|verified|completed)\s+independent\s+(multi-agent|agent|parallel)/i.test(ledgerText) ||
    /(real|actual)\s+parallel\s+model\s+(execution|runtime)\s+(is\s+)?(proven|complete|running)/i.test(ledgerText);

  if (ledger.platform !== 'Rhautt Nexus / 瑞合数智枢纽') {
    return fail('Agent run ledger has wrong platform', { platform: ledger.platform });
  }
  if (!String(ledger.status || '').includes('not-independent-parallel-runtime')) {
    return fail('Agent run ledger must state it is not proof of independent parallel runtime');
  }
  if (missing.length) {
    return fail('Agent run ledger is missing required owners', missing);
  }
  if (falseClaim) {
    return fail('Agent run ledger contains unsupported completion or parallel-runtime claim');
  }
  if (!ledgerText.includes('This ledger alone is not production completion evidence')) {
    return fail('Agent run ledger must state it is not production completion evidence by itself');
  }

  return pass('Auditable agent run ledger is present and honest', { owners: owners.size });
}

function main() {
  const checks = [
    checkRequiredFiles(),
    checkClaudeMemory(),
    checkAgents(),
    checkSettingsCommands(),
    checkAgentRunLedger()
  ];
  const failed = checks.filter(check => check.status === 'fail');
  const report = {
    generatedAt: new Date().toISOString(),
    checks,
    summary: {
      checks: checks.length,
      passed: checks.length - failed.length,
      failed: failed.length
    }
  };

  fs.writeFileSync(path.join(ROOT, 'audit/ai-control-plane-report.json'), JSON.stringify(report, null, 2));
  console.log(`AI Control Plane Check: ${report.summary.passed}/${report.summary.checks} passed`);
  for (const check of checks) {
    console.log(`- ${check.status.toUpperCase()}: ${check.message}`);
  }
  if (failed.length) process.exit(1);
}

if (require.main === module) {
  main();
}

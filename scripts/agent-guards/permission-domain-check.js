#!/usr/bin/env node

/**
 * guard:permission-domain
 *
 * Enforces the 5-domain permission/navigation model (charter 1.2.2):
 *  - governance/permission-domains.json is the machine-readable source of truth.
 *  - Every enforced NestJS module (module-boundary.ts `apiModuleBoundary`) is
 *    OWNED by exactly one permission domain (D0–D4).
 *  - No module is owned by two domains (a module may only be CONSUMED cross-domain).
 *  - Owned modules unknown to the boundary must be declared `plannedModules`.
 *  - D2 (公域/用户体验) must declare the anonymous trust boundary + cannot-write rule.
 *  - D4 (增长) must declare AI-output approval-status rule.
 *  - Charter 1.2.2 + design doc must exist and reference the model.
 *
 * This is a source-contract guard (static). Runtime enforcement of the anonymous
 * write ban and AI approval gate lives in the modules themselves.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');
const exists = (rel) => fs.existsSync(path.join(ROOT, rel));

const failures = [];
const warnings = [];

const SRC = 'governance/permission-domains.json';
const BOUNDARY = 'services/api/src/modules/module-boundary.ts';
// 权限域锚点随唯一最高真相源迁移（旧 PROJECT-CHARTER.md 已于 2026-08-04 归档）。
const CHARTER = 'docs/NEXUS-CHARTER-PRD.md';
const DOC = 'docs/ADMIN-PERMISSION-DOMAINS-AND-RLS.md';

// ── Load source of truth ──────────────────────────────────────────────────
if (!exists(SRC)) {
  console.error(`- missing permission-domain source: ${SRC}`);
  process.exit(1);
}
let model;
try {
  model = JSON.parse(read(SRC));
} catch (e) {
  console.error(`- ${SRC} is not valid JSON: ${e.message}`);
  process.exit(1);
}

const REQUIRED_DOMAINS = ['D0', 'D1', 'D2', 'D3', 'D4', 'D5'];
const domains = model.domains || {};
for (const d of REQUIRED_DOMAINS) {
  if (!domains[d]) failures.push(`missing required permission domain: ${d}`);
}

// ── Parse enforced module boundary ────────────────────────────────────────
let boundaryModules = [];
if (!exists(BOUNDARY)) {
  failures.push(`missing ${BOUNDARY}`);
} else {
  const src = read(BOUNDARY);
  const m = src.match(/apiModuleBoundary\s*=\s*\[([\s\S]*?)\]/);
  if (!m) {
    failures.push(`could not parse apiModuleBoundary from ${BOUNDARY}`);
  } else {
    boundaryModules = [...m[1].matchAll(/'([^']+)'/g)].map((x) => x[1]);
  }
}

// ── Ownership integrity ───────────────────────────────────────────────────
const owner = new Map(); // module -> domain
const planned = new Set(model.plannedModules || []);

for (const [domainId, spec] of Object.entries(domains)) {
  const owned = spec.ownedModules || [];
  if (owned.length === 0 && domainId !== 'D4') {
    warnings.push(`${domainId} (${spec.name}) owns no modules`);
  }
  for (const mod of owned) {
    if (owner.has(mod)) {
      failures.push(`module "${mod}" owned by two domains: ${owner.get(mod)} and ${domainId} (a module belongs to exactly one domain; use crossDomainConsumers instead)`);
    } else {
      owner.set(mod, domainId);
    }
    if (!boundaryModules.includes(mod) && !planned.has(mod)) {
      failures.push(`domain ${domainId} owns unknown module "${mod}" (not in apiModuleBoundary and not in plannedModules)`);
    }
  }
}

// Every enforced module must be owned by exactly one domain.
for (const mod of boundaryModules) {
  if (!owner.has(mod)) {
    failures.push(`enforced module "${mod}" is not assigned to any permission domain`);
  }
}

// Planned modules that are already enforced should be promoted out of plannedModules.
for (const mod of planned) {
  if (boundaryModules.includes(mod)) {
    warnings.push(`"${mod}" is in plannedModules but already in apiModuleBoundary — promote it (remove from plannedModules)`);
  }
}

// Cross-domain consumers must reference real owned modules.
for (const mod of Object.keys(model.crossDomainConsumers || {})) {
  if (!owner.has(mod)) {
    failures.push(`crossDomainConsumers references module "${mod}" that no domain owns`);
  }
}

// ── Trust-boundary + AI-approval rules ────────────────────────────────────
// Locate the anonymous (公域) and bound-tenant (经营) domains by their declared
// trustBoundary rather than a hard-coded id, so the model can be renumbered.
const anonDomain = Object.entries(domains).find(([, s]) => s.trustBoundary === 'anonymous');
const boundDomain = Object.entries(domains).find(([, s]) => s.trustBoundary === 'bound-tenant');
if (!anonDomain) {
  failures.push('exactly one domain must declare trustBoundary="anonymous" (公域/用户体验)');
} else {
  const [anonId, anon] = anonDomain;
  if (!(anon.rules && anon.rules.anonymousCannotWriteOperationalTables === true)) {
    failures.push(`${anonId} (anonymous) must declare rules.anonymousCannotWriteOperationalTables=true`);
  }
  if (!(anon.rules && domains[anon.rules.boundToDomain])) {
    failures.push(`${anonId} (anonymous) must declare rules.boundToDomain pointing at an existing domain (lead→customer migration target)`);
  } else if (domains[anon.rules.boundToDomain].trustBoundary !== 'bound-tenant') {
    failures.push(`${anonId}.rules.boundToDomain must target the bound-tenant domain`);
  }
}
if (!boundDomain) {
  failures.push('exactly one domain must declare trustBoundary="bound-tenant" (经营/客户赋能)');
}
const aiApprovalDomain = Object.values(domains).find((s) => s.rules && s.rules.aiOutputRequiresApprovalStatus === true);
if (!aiApprovalDomain) {
  failures.push('the growth/推广增长 domain must declare rules.aiOutputRequiresApprovalStatus=true');
}

// ── Charter + doc anchoring ───────────────────────────────────────────────
if (!exists(CHARTER)) {
  failures.push(`missing ${CHARTER}`);
} else {
  const charter = read(CHARTER);
  if (!charter.includes('1.2.2')) failures.push('PROJECT-CHARTER.md missing section 1.2.2 (permission domains)');
  for (const d of REQUIRED_DOMAINS) {
    if (!charter.includes(d)) warnings.push(`charter 1.2.2 does not mention ${d}`);
  }
}
if (!exists(DOC)) {
  failures.push(`missing design doc: ${DOC}`);
}

// ── Report ────────────────────────────────────────────────────────────────
console.log(
  `Permission Domain Check: domains = ${Object.keys(domains).length}, enforced modules = ${boundaryModules.length}, owned = ${owner.size}, failures = ${failures.length}, warnings = ${warnings.length}`
);

if (failures.length) {
  for (const f of failures) console.error(`- ${f}`);
  process.exit(1);
}
for (const w of warnings) console.warn(`- ${w}`);

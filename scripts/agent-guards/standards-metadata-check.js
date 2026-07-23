#!/usr/bin/env node

const {
  RHEEM_SYSTEM_PACKS,
  REQUIRED_STANDARDS_COVERAGE_DOMAINS
} = require('../../server/modules/system-packs/rheemSystemPacks');

const allowedChecks = new Set(['mandatoryBlocker', 'calculationRule', 'acceptanceChecklist', 'advisoryOptimization']);
const findings = [];

for (const pack of RHEEM_SYSTEM_PACKS) {
  for (const standard of pack.standards || []) {
    for (const field of ['level', 'code', 'edition', 'name', 'scope', 'softwareCheck']) {
      if (!standard[field]) findings.push(`${pack.id}:${standard.code || 'unknown'} missing ${field}`);
    }
    if (standard.softwareCheck && !allowedChecks.has(standard.softwareCheck)) {
      findings.push(`${pack.id}:${standard.code} invalid softwareCheck ${standard.softwareCheck}`);
    }
  }
  const hasMandatory = (pack.standards || []).some(standard => standard.level === 'L1' && standard.softwareCheck === 'mandatoryBlocker');
  if (!hasMandatory) findings.push(`${pack.id} missing L1 mandatoryBlocker standard`);

  if (!Array.isArray(pack.standardsCoverage) || !pack.standardsCoverage.length) {
    findings.push(`${pack.id} missing standardsCoverage`);
    continue;
  }

  const packStandardCodes = new Set((pack.standards || []).map(standard => standard.code));
  for (const coverage of pack.standardsCoverage) {
    for (const field of [
      'domain',
      'requiredFor',
      'primaryStandards',
      'softwareChecks',
      'deliverableEvidence',
      'quoteImpact',
      'lifecycleHandoffImpact'
    ]) {
      if (!coverage[field] || (Array.isArray(coverage[field]) && !coverage[field].length)) {
        findings.push(`${pack.id}:${coverage.domain || 'unknown-domain'} missing standardsCoverage.${field}`);
      }
    }
    if (!REQUIRED_STANDARDS_COVERAGE_DOMAINS.includes(coverage.domain)) {
      findings.push(`${pack.id}:${coverage.domain} is not an allowed standards coverage domain`);
    }
    for (const code of coverage.primaryStandards || []) {
      if (!packStandardCodes.has(code)) {
        findings.push(`${pack.id}:${coverage.domain} references primaryStandard not declared in standards: ${code}`);
      }
    }
  }
}

const coveredDomains = [...new Set(RHEEM_SYSTEM_PACKS.flatMap(pack => (pack.standardsCoverage || []).map(coverage => coverage.domain)))];
const missingDomains = REQUIRED_STANDARDS_COVERAGE_DOMAINS.filter(domain => !coveredDomains.includes(domain));
for (const domain of missingDomains) {
  findings.push(`system packs missing required standards coverage domain: ${domain}`);
}

console.log(`Standards Metadata Check: ${RHEEM_SYSTEM_PACKS.length} packs checked`);
console.log(`Standards coverage domains: ${coveredDomains.length}/${REQUIRED_STANDARDS_COVERAGE_DOMAINS.length}`);
if (findings.length) {
  for (const finding of findings) console.error(`- ${finding}`);
  process.exit(1);
}

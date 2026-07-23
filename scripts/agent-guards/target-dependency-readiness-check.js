#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { updateReleaseEvidence } = require('../release/evidence-utils');

const ROOT = path.join(__dirname, '..', '..');
const REPORT_JSON = 'evidence/architecture/target-dependency-readiness-report.json';
const REPORT_MD = 'evidence/architecture/target-dependency-readiness-report.md';

const REQUIRED_DEPENDENCIES = [
  { name: 'next', label: 'Next.js target frontend runtime' },
  { name: 'nx', label: 'Nx project graph and affected build tooling' },
  { name: '@nestjs/core', label: 'NestJS core runtime' },
  { name: '@nestjs/common', label: 'NestJS common decorators and providers' },
  { name: '@nestjs/platform-fastify', label: 'NestJS Fastify adapter' },
  { name: 'fastify', label: 'Fastify HTTP runtime' },
  { name: 'reflect-metadata', label: 'NestJS metadata reflection runtime' },
  { name: 'rxjs', label: 'NestJS reactive dependency' }
];

const failures = [];

function fullPath(relativePath) {
  return path.join(ROOT, relativePath);
}

function exists(relativePath) {
  return fs.existsSync(fullPath(relativePath));
}

function read(relativePath) {
  return fs.readFileSync(fullPath(relativePath), 'utf8');
}

function readJson(relativePath) {
  return JSON.parse(read(relativePath));
}

function sha256(text) {
  return crypto.createHash('sha256').update(text).digest('hex');
}

function dependencyVersion(pkg, name) {
  return pkg.dependencies?.[name] || pkg.devDependencies?.[name] || null;
}

function dependencyLocked(lock, name) {
  return Boolean(lock?.packages?.[`node_modules/${name}`]);
}

function inspect() {
  if (!exists('package.json')) {
    failures.push('missing package.json');
    return null;
  }

  const packageSource = read('package.json');
  const pkg = JSON.parse(packageSource);
  const lock = exists('package-lock.json') ? readJson('package-lock.json') : null;
  const dependencies = REQUIRED_DEPENDENCIES.map(item => {
    const version = dependencyVersion(pkg, item.name);
    return {
      ...item,
      declared: Boolean(version),
      version,
      lockfilePresent: dependencyLocked(lock, item.name),
      nodeModulesPresent: exists(`node_modules/${item.name}/package.json`)
    };
  });
  const missing = dependencies.filter(item => !item.declared);
  const missingLockfile = dependencies.filter(item => item.declared && !item.lockfilePresent);
  const missingNodeModules = dependencies.filter(item => item.declared && !item.nodeModulesPresent);
  const ready = missing.length === 0 && missingLockfile.length === 0 && missingNodeModules.length === 0;

  return {
    generatedAt: new Date().toISOString(),
    platform: 'Rhautt Nexus / 瑞合数智枢纽',
    status: ready ? 'target-dependencies-ready' : 'missing-target-dependencies',
    finalLaunchArchitectureProof: false,
    bootProofEligible: ready,
    packageJsonSha256: sha256(packageSource),
    packageLockSha256: exists('package-lock.json') ? sha256(read('package-lock.json')) : null,
    dependencies,
    summary: {
      required: REQUIRED_DEPENDENCIES.length,
      declared: dependencies.filter(item => item.declared).length,
      locked: dependencies.filter(item => item.lockfilePresent).length,
      installed: dependencies.filter(item => item.nodeModulesPresent).length,
      missing: missing.map(item => item.name),
      missingLockfile: missingLockfile.map(item => item.name),
      missingNodeModules: missingNodeModules.map(item => item.name),
      failures: failures.length
    },
    installAttempt: {
      command: 'npm install next nx @nestjs/core @nestjs/common @nestjs/platform-fastify fastify reflect-metadata rxjs',
      sandboxAttempt: 'npm install next nx @nestjs/core @nestjs/common @nestjs/platform-fastify fastify reflect-metadata rxjs --fetch-timeout=30000 --fetch-retries=1',
      lastObservedFailure: 'sandbox npm install reached registry lookup but failed with getaddrinfo ENOTFOUND registry.npmjs.org',
      escalatedAttempt: 'require_escalated npm install was retried twice; both approval reviews timed out',
      note: 'Do not claim NestJS/Fastify boot proof until dependencies are declared, package-lock locked, and installed.'
    }
  };
}

function renderMarkdown(report) {
  const lines = [
    '# Target Dependency Readiness Report',
    '',
    `Generated: ${report.generatedAt}`,
    '',
    `Status: ${report.status}`,
    '',
    `Boot proof eligible: ${report.bootProofEligible}`,
    '',
    `Final launch architecture proof: ${report.finalLaunchArchitectureProof}`,
    '',
    '| Dependency | Declared | Locked | Installed | Version | Purpose |',
    '|---|---:|---:|---:|---|---|'
  ];
  for (const item of report.dependencies) {
    lines.push(`| ${item.name} | ${item.declared ? 'yes' : 'no'} | ${item.lockfilePresent ? 'yes' : 'no'} | ${item.nodeModulesPresent ? 'yes' : 'no'} | ${item.version || ''} | ${item.label} |`);
  }
  lines.push(
    '',
    '## Last Install Attempt',
    '',
    `- Command: \`${report.installAttempt.command}\``,
    `- Sandbox attempt: \`${report.installAttempt.sandboxAttempt}\``,
    `- Failure: ${report.installAttempt.lastObservedFailure}`,
    `- Escalation: ${report.installAttempt.escalatedAttempt}`,
    '',
    'This report is dependency readiness evidence only. It does not prove NestJS/Fastify boot or Next.js app build.'
  );
  return lines.join('\n');
}

const report = inspect();

if (report) {
  fs.mkdirSync(fullPath('evidence/architecture'), { recursive: true });
  fs.writeFileSync(fullPath(REPORT_JSON), `${JSON.stringify(report, null, 2)}\n`);
  fs.writeFileSync(fullPath(REPORT_MD), renderMarkdown(report));
  updateReleaseEvidence('targetDependencyReadiness', {
    command: 'npm run guard:target-dependencies',
    status: report.status,
    path: REPORT_JSON,
    summaryPath: REPORT_MD,
    required: REQUIRED_DEPENDENCIES.map(item => item.name),
    bootProofEligible: report.bootProofEligible,
    finalLaunchArchitectureProof: false,
    declared: report.summary.declared,
    locked: report.summary.locked,
    installed: report.summary.installed,
    missingDeclared: report.summary.missing,
    missingLockfile: report.summary.missingLockfile,
    missingNodeModules: report.summary.missingNodeModules,
    lastObservedFailure: 'getaddrinfo ENOTFOUND registry.npmjs.org',
    note: 'Target dependencies are not lockfile-complete or installed; NestJS/Fastify boot proof and Next.js/Nx build proof cannot be claimed.'
  });
}

console.log(`Target Dependency Readiness Check: status = ${report?.status || 'failed'}, failures = ${failures.length}`);

if (failures.length) {
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

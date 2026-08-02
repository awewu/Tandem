#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execFileSync } = require('child_process');

const ROOT = path.join(__dirname, '..', '..');
const SPEC = 'contracts/openapi/rhautt-nexus-v2.openapi.json';
const CLIENT = 'packages/generated-client/src/rhauttNexusClient.ts';
const CONTRACTS_INDEX = 'packages/contracts/src/index.ts';
const HTTP_METHODS = new Set(['get', 'post', 'put', 'patch', 'delete']);

const failures = [];

function read(relativePath) {
  return fs.readFileSync(path.join(ROOT, relativePath), 'utf8');
}

function exists(relativePath) {
  return fs.existsSync(path.join(ROOT, relativePath));
}

function sha256(relativePath) {
  return crypto.createHash('sha256').update(read(relativePath)).digest('hex');
}

function collectOperations(spec) {
  const operations = [];
  for (const [routePath, pathItem] of Object.entries(spec.paths || {})) {
    for (const [method, operation] of Object.entries(pathItem || {})) {
      if (!HTTP_METHODS.has(method)) continue;
      if (!operation.operationId) failures.push(`${method.toUpperCase()} ${routePath} missing operationId`);
      else operations.push({ method, routePath, operationId: operation.operationId, operation });
    }
  }
  return operations;
}

if (!exists(SPEC)) failures.push(`missing OpenAPI spec: ${SPEC}`);
if (!exists(CLIENT)) failures.push(`missing generated client: ${CLIENT}`);
if (!exists(CONTRACTS_INDEX)) failures.push(`missing contracts package index: ${CONTRACTS_INDEX}`);

if (!failures.length) {
  const spec = JSON.parse(read(SPEC));
  const client = read(CLIENT);
  const operations = collectOperations(spec);
  const hash = sha256(SPEC);

  if (spec.openapi !== '3.1.0') failures.push('OpenAPI spec must use 3.1.0');
  if (spec.info?.title !== 'Rhautt Nexus / 瑞合数智枢纽 API') failures.push('OpenAPI title must identify Rhautt Nexus / 瑞合数智枢纽 API');
  if (!client.includes(`OPENAPI_SHA256 = '${hash}'`)) failures.push('generated client hash is stale; rerun npm run contracts:generate');
  if (!client.includes('class RhauttNexusClient')) failures.push('generated client must export RhauttNexusClient');

  const operationIds = new Set();
  for (const item of operations) {
    if (operationIds.has(item.operationId)) failures.push(`duplicate operationId: ${item.operationId}`);
    operationIds.add(item.operationId);
    const binaryResponse = false;
    if (binaryResponse) {
      if (!client.includes(`async ${item.operationId}(params: ClientParams = {}): Promise<Response>`)) {
        failures.push(`generated client binary method ${item.operationId} must return Response`);
      }
      if (!client.includes(`return this.requestBlob("${item.method.toUpperCase()}", "${item.routePath}", params);`)) {
        failures.push(`generated client binary method ${item.operationId} must use requestBlob`);
      }
    } else if (!client.includes(`async ${item.operationId}<`)) {
      failures.push(`generated client missing method ${item.operationId}`);
    }
    if (!item.operation.tags || !item.operation.tags.length) failures.push(`${item.operationId} missing tags`);
    if (!item.operation.responses || !Object.keys(item.operation.responses).length) failures.push(`${item.operationId} missing responses`);
    if (item.routePath.includes('/crm/') || item.routePath.includes('/lifecycle/') || item.routePath.includes('/analytics/') || item.routePath.includes('/audit/')) {
      if (!item.operation.security) failures.push(`${item.operationId} must require bearerAuth security`);
    }
  }

  for (const required of [
    'login',
    'getHealthReady',
    'getHealthHeartbeat',
    'createCrmLead',
    'getAnalyticsOverview',
    'listAuditEvents',
    'composeSystemPacks',
    'createLifecycleHandover',
    'getLifecycleIotHandoffPackage',
    'listLifecycleCustomerProjects',
    'getLifecycleCustomerProject',
    'updateLifecycleState',
    'getReactCandidateStatus'
  ]) {
    if (!operationIds.has(required)) failures.push(`OpenAPI spec missing required operation ${required}`);
  }

  for (const target of [CLIENT, CONTRACTS_INDEX]) {
    try {
      const tsc = path.join(ROOT, 'node_modules', 'typescript', 'bin', 'tsc');
      execFileSync(process.execPath, [
        tsc,
        target,
        '--noEmit',
        '--target',
        'ES2022',
        '--lib',
        'ES2022,DOM',
        '--module',
        'ESNext',
        '--moduleResolution',
        'Node',
        '--skipLibCheck'
      ], {
        cwd: ROOT,
        encoding: 'utf8',
        stdio: 'pipe'
      });
    } catch (error) {
      const output = `${error.stdout || ''}${error.stderr || ''}`.trim();
      failures.push(`${target} TypeScript compile check failed${output ? `: ${output}` : ''}`);
    }
  }
}

console.log(`Generated Client Check: failures = ${failures.length}`);
if (failures.length) {
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');
const BOUNDARY_FILE = 'services/api/src/modules/module-boundary.ts';
const APP_MODULE = 'services/api/src/modules/app.module.ts';
const REPORT_JSON = 'evidence/architecture/target-api-boot-smoke.json';
const REPORT_MD = 'evidence/architecture/target-api-boot-smoke.md';
const failures = [];

const read = (relativePath) => fs.readFileSync(path.join(ROOT, relativePath), 'utf8');
const exists = (relativePath) => fs.existsSync(path.join(ROOT, relativePath));
const fail = (message) => failures.push(message);

function parseStringArray(source, constantName) {
  const match = source.match(new RegExp(`export const ${constantName} = \\[([\\s\\S]*?)\\] as const;`));
  if (!match) {
    fail(`cannot parse ${constantName} from ${BOUNDARY_FILE}`);
    return [];
  }
  return [...match[1].matchAll(/'([^']+)'/g)].map((item) => item[1]);
}

function className(moduleName) {
  return moduleName.split('-').map((part) => part[0].toUpperCase() + part.slice(1)).join('');
}

for (const requiredFile of [
  BOUNDARY_FILE,
  APP_MODULE,
  'services/api/src/main.ts',
  'services/api/src/modules/health.controller.ts',
  'services/api/src/modules/boot-smoke.ts',
  'services/api/tsconfig.json',
  'scripts/release/target-api-boot-smoke.js',
  REPORT_JSON,
  REPORT_MD,
]) {
  if (!exists(requiredFile)) fail(`missing ${requiredFile}`);
}

if (!failures.length) {
  const boundarySource = read(BOUNDARY_FILE);
  const appSource = read(APP_MODULE);
  const mainSource = read('services/api/src/main.ts');
  const healthSource = read('services/api/src/modules/health.controller.ts');
  const activeModules = parseStringArray(boundarySource, 'apiModuleBoundary');
  const plannedInterfaces = parseStringArray(boundarySource, 'plannedApiInterfaces');

  for (const token of ["import { NestFactory } from '@nestjs/core'", 'FastifyAdapter', 'createApiApplication', "app.setGlobalPrefix('api/v2')"]) {
    if (!mainSource.includes(token)) fail(`main.ts missing boot token: ${token}`);
  }
  for (const token of ['apiModuleBoundary', "@Controller('health')", '@Public()']) {
    if (!healthSource.includes(token)) fail(`health.controller.ts missing token: ${token}`);
  }
  for (const name of activeModules) {
    const modulePath = `services/api/src/modules/${name}/${name}.module.ts`;
    if (!exists(modulePath)) fail(`active module source is missing: ${modulePath}`);
    if (!appSource.includes(`${className(name)}Module`)) fail(`AppModule does not compose active module: ${name}`);
  }
  for (const name of plannedInterfaces) {
    if (exists(`services/api/src/modules/${name}`)) fail(`planned interface still has a runtime directory: ${name}`);
    if (appSource.includes(`${className(name)}Module`)) fail(`planned interface is still composed by AppModule: ${name}`);
  }

  const report = JSON.parse(read(REPORT_JSON));
  const reportedModules = report.sourceContract?.moduleStates?.map((state) => state.name) || [];
  if (report.status !== 'passed-runtime-boot-smoke-current-run') fail('boot report status is not passing');
  if (report.nestFastifyBootProof !== true || report.runtimeBootSmoke?.healthRoutePassed !== true) fail('boot report lacks Nest/Fastify health proof');
  if (report.runtimeBootSmoke?.postgresRuntimeProof !== false) fail('boot smoke must not claim PostgreSQL runtime proof');
  if (JSON.stringify(reportedModules) !== JSON.stringify(activeModules)) fail('boot report active modules are stale');
  if (JSON.stringify(report.plannedInterfaces) !== JSON.stringify(plannedInterfaces)) fail('boot report planned interfaces are stale');
  if (JSON.stringify(report.runtimeBootSmoke?.routeProbe?.moduleBoundary) !== JSON.stringify(activeModules)) {
    fail('health probe module boundary is stale');
  }
}

console.log(`Target API Boot Smoke Check: failures = ${failures.length}`);
for (const failure of failures) console.error(`- ${failure}`);
if (failures.length) process.exit(1);

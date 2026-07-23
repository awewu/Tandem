#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const repoRoot = path.resolve(__dirname, '..');
const pm2Home = path.join(repoRoot, 'runtime-logs', 'pm2');
const ecosystem = path.join(repoRoot, 'production-config', 'ecosystem.development.config.js');
const command = process.argv[2] || 'status';

const commandArgs = {
  start: ['start', ecosystem, '--only', 'dealer-workbench-dev'],
  'start-stack': ['start', ecosystem],
  status: ['status', 'dealer-workbench-dev'],
  'status-stack': ['status'],
  logs: ['logs', 'dealer-workbench-dev'],
  stop: ['delete', 'dealer-workbench-dev'],
  'stop-stack': [
    'delete',
    'legacy-api-dev',
    'nestjs-api-dev',
    'dealer-workbench-dev',
    'consumer-diagnosis-dev',
    'customer-portal-dev',
    'public-portal-dev',
    'nexus-console-dev',
    'brand-console-dev',
  ],
};

if (!commandArgs[command]) {
  console.error(`Unknown PM2 runtime command: ${command}`);
  process.exit(2);
}

fs.mkdirSync(pm2Home, { recursive: true });

const child = spawn(process.execPath, [require.resolve('pm2/bin/pm2'), ...commandArgs[command]], {
  cwd: repoRoot,
  env: { ...process.env, PM2_HOME: pm2Home },
  stdio: 'inherit',
  windowsHide: true,
});

child.on('error', (error) => {
  console.error(error);
  process.exit(1);
});

child.on('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 1);
});

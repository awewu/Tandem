const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const root = path.resolve(__dirname, '..');
const logDir = path.join(root, 'runtime-logs', 'startup');
fs.mkdirSync(logDir, { recursive: true });

const node = process.execPath;
const nextBin = require.resolve('next/dist/bin/next', { paths: [root] });

const commonEnv = {
  API_URL: 'http://localhost:5500',
  API_PROXY_TARGET: 'http://localhost:5500',
  NEXUS_API_URL: 'http://localhost:5500',
  NEXUS_API_PREFIX: '/api/v2',
  NEXT_PUBLIC_API_URL: 'http://localhost:5500',
  NEXT_PUBLIC_LOGIN_URL: 'http://localhost:5000'
};

const services = [
  {
    name: 'product-catalog-5016',
    cwd: path.join(root, 'apps', 'product-catalog'),
    args: [nextBin, 'dev', '--port', '5016']
  },
  {
    name: 'everhot-cn-5011',
    cwd: path.join(root, 'apps', 'everhot-cn'),
    args: ['scripts/serve.js', '--port', '5011']
  },
  {
    name: 'lithnova-cn-5013',
    cwd: path.join(root, 'apps', 'lithnova-cn'),
    args: ['scripts/serve.js', '--port', '5013']
  },
  {
    name: 'rheem-cn-5014',
    cwd: path.join(root, 'apps', 'rheem-cn'),
    args: ['scripts/serve.js', '--port', '5014']
  },
  {
    name: 'ruud-cn-5015',
    cwd: path.join(root, 'apps', 'ruud-cn'),
    args: ['scripts/serve.js', '--port', '5015']
  }
];

for (const service of services) {
  const out = fs.openSync(path.join(logDir, `${service.name}.out.log`), 'a');
  const err = fs.openSync(path.join(logDir, `${service.name}.err.log`), 'a');
  const child = spawn(node, service.args, {
    cwd: service.cwd,
    env: { ...process.env, ...commonEnv },
    detached: true,
    stdio: ['ignore', out, err],
    windowsHide: true
  });
  child.unref();
  console.log(`${service.name} pid=${child.pid}`);
}

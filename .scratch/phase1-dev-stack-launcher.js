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
  NEXT_PUBLIC_LOGIN_URL: 'http://localhost:5000',
  NEXT_PUBLIC_APP_DEALER_URL: 'http://localhost:5000',
  NEXT_PUBLIC_APP_DIAGNOSIS_URL: 'http://localhost:5001',
  NEXT_PUBLIC_APP_CUSTOMER_URL: 'http://localhost:5002',
  NEXT_PUBLIC_APP_DESIGNER_URL: 'http://localhost:5003',
  NEXT_PUBLIC_APP_PUBLIC_URL: 'http://localhost:5005',
  NEXT_PUBLIC_APP_NEXUS_URL: 'http://localhost:5010',
  NEXT_PUBLIC_APP_BRAND_URL: 'http://localhost:5012',
  NEXT_PUBLIC_PORTAL_URL: 'http://localhost:5005',
  NEXT_PUBLIC_DEALER_URL: 'http://localhost:5000',
  NEXT_PUBLIC_DIAGNOSIS_URL: 'http://localhost:5001',
  NEXT_PUBLIC_CONSOLE_URL: 'http://localhost:5010',
  NEXT_PUBLIC_DESIGN_URL: 'http://localhost:5003'
};

const services = [
  {
    name: 'api-5500',
    cwd: root,
    command: node,
    args: ['scripts/start-api.js'],
    env: {
      PORT: '5500',
      API_PORT: '5500',
      HOST: '0.0.0.0',
      API_START_MODE: 'typescript'
    }
  },
  {
    name: 'dealer-workbench-5000',
    cwd: path.join(root, 'apps', 'dealer-workbench'),
    command: node,
    args: [nextBin, 'dev', '--port', '5000', '--webpack']
  },
  {
    name: 'consumer-diagnosis-5001',
    cwd: path.join(root, 'apps', 'consumer-diagnosis'),
    command: node,
    args: [nextBin, 'dev', '--port', '5001']
  },
  {
    name: 'customer-portal-5002',
    cwd: path.join(root, 'apps', 'customer-portal'),
    command: node,
    args: [nextBin, 'dev', '--port', '5002']
  },
  {
    name: 'designer-workbench-5003',
    cwd: path.join(root, 'apps', 'designer-workbench'),
    command: node,
    args: [nextBin, 'dev', '--port', '5003', '--webpack']
  },
  {
    name: 'public-portal-5005',
    cwd: path.join(root, 'apps', 'public-portal'),
    command: node,
    args: [nextBin, 'dev', '--port', '5005']
  },
  {
    name: 'nexus-console-5010',
    cwd: path.join(root, 'apps', 'nexus-console'),
    command: node,
    args: [nextBin, 'dev', '--port', '5010']
  },
  {
    name: 'brand-console-5012',
    cwd: path.join(root, 'apps', 'brand-console'),
    command: node,
    args: [nextBin, 'dev', '--port', '5012']
  },
  {
    name: 'product-catalog-5016',
    cwd: path.join(root, 'apps', 'product-catalog'),
    command: node,
    args: [nextBin, 'dev', '--port', '5016']
  },
  {
    name: 'everhot-cn-5011',
    cwd: path.join(root, 'apps', 'everhot-cn'),
    command: node,
    args: ['scripts/serve.js', '--port', '5011']
  },
  {
    name: 'lithnova-cn-5013',
    cwd: path.join(root, 'apps', 'lithnova-cn'),
    command: node,
    args: ['scripts/serve.js', '--port', '5013']
  },
  {
    name: 'rheem-cn-5014',
    cwd: path.join(root, 'apps', 'rheem-cn'),
    command: node,
    args: ['scripts/serve.js', '--port', '5014']
  },
  {
    name: 'ruud-cn-5015',
    cwd: path.join(root, 'apps', 'ruud-cn'),
    command: node,
    args: ['scripts/serve.js', '--port', '5015']
  }
];

for (const service of services) {
  const out = fs.openSync(path.join(logDir, `${service.name}.out.log`), 'a');
  const err = fs.openSync(path.join(logDir, `${service.name}.err.log`), 'a');
  const child = spawn(service.command, service.args, {
    cwd: service.cwd,
    env: {
      ...process.env,
      ...commonEnv,
      ...(service.env || {})
    },
    detached: true,
    stdio: ['ignore', out, err],
    windowsHide: true
  });

  child.unref();
  console.log(`${service.name} pid=${child.pid}`);
}

const { closeSync, mkdirSync, openSync, readFileSync, writeFileSync } = require('fs');
const { join, resolve } = require('path');
const { spawn, spawnSync } = require('child_process');

const root = resolve(__dirname, '..');
const runtime = join(root, 'runtime', 'node.exe');
const stateDir = join(root, 'runtime-state');
const logDir = join(root, 'logs');
const stateFile = join(stateDir, 'processes.json');

function isRunning(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function readState() {
  try {
    return JSON.parse(readFileSync(stateFile, 'utf8'));
  } catch {
    return {};
  }
}

function startService(name, script, cwd, env) {
  const out = openSync(join(logDir, `${name}.log`), 'a');
  const child = spawn(runtime, [script], {
    cwd,
    detached: true,
    windowsHide: true,
    stdio: ['ignore', out, out],
    env: { ...process.env, ...env },
  });
  child.unref();
  closeSync(out);
  return child.pid;
}

function start() {
  mkdirSync(stateDir, { recursive: true });
  mkdirSync(logDir, { recursive: true });
  const current = readState();
  if (Object.values(current).some((entry) => isRunning(entry.pid))) {
    throw new Error('One or more Nexus processes are already running. Run status.cmd first.');
  }

  const envFile = join(root, 'config', '.env.production');
  try {
    readFileSync(envFile);
  } catch {
    throw new Error('config\\.env.production not found. Create it from the example first.');
  }

  const dotenv = require(join(root, 'backend', 'node_modules', 'dotenv'));
  const envResult = dotenv.config({ path: envFile, processEnv: process.env, quiet: true });
  if (envResult.error) throw envResult.error;

  const backend = startService(
    'backend-4500',
    join(root, 'scripts', 'backend-launcher.js'),
    root,
    { DOTENV_CONFIG_PATH: envFile }
  );
  const dealerRoot = join(root, 'frontend', 'apps', 'dealer-workbench');
  const dealer = startService('frontend-5000', join(dealerRoot, 'server.js'), dealerRoot, {
    NODE_ENV: 'production',
    HOSTNAME: '127.0.0.1',
    PORT: '5000',
    API_URL: 'http://127.0.0.1:4500',
    NEXUS_API_URL: 'http://127.0.0.1:4500',
    NEXUS_API_PREFIX: '/api/v2',
  });

  const state = {
    backend: { pid: backend, port: 4500 },
    dealer: { pid: dealer, port: 5000 },
  };
  writeFileSync(stateFile, `${JSON.stringify(state, null, 2)}\n`);
  console.log(`Nexus backend started on 127.0.0.1:4500 (PID ${backend})`);
  console.log(`Nexus frontend started on 127.0.0.1:5000 (PID ${dealer})`);
}

function stop() {
  const state = readState();
  let failed = false;
  for (const [name, entry] of Object.entries(state)) {
    if (!entry.pid || !isRunning(entry.pid)) {
      console.log(`${name}: not running`);
      continue;
    }
    const result = spawnSync('taskkill.exe', ['/PID', String(entry.pid), '/T', '/F'], {
      windowsHide: true,
      stdio: 'inherit',
    });
    if (result.status !== 0) failed = true;
  }
  if (failed) process.exitCode = 1;
}

function status() {
  const state = readState();
  if (!Object.keys(state).length) {
    console.log('No process state found.');
    return;
  }
  for (const [name, entry] of Object.entries(state)) {
    console.log(`${name}: ${isRunning(entry.pid) ? 'running' : 'stopped'} (PID ${entry.pid}, port ${entry.port})`);
  }
}

const command = process.argv[2];
try {
  if (command === 'start') start();
  else if (command === 'stop') stop();
  else if (command === 'status') status();
  else throw new Error('Usage: service-manager.js <start|stop|status>');
} catch (error) {
  console.error(`ERROR: ${error.message}`);
  process.exitCode = 1;
}

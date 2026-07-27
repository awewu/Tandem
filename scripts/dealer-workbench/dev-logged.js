const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { spawn } = require('child_process');
const dotenv = require('dotenv');
const { createRuntimeEventStore } = require('./runtime-event-store');

const repoRoot = path.resolve(__dirname, '..', '..');
const appRoot = path.join(repoRoot, 'apps', 'dealer-workbench');
const DEALER_WORKBENCH_PORT = 5000;
const logPath = process.env.DEALER_DEV_LOG
  ? path.resolve(process.env.DEALER_DEV_LOG)
  : path.join(repoRoot, 'runtime-logs', 'startup', `dealer-workbench-${DEALER_WORKBENCH_PORT}.log`);
const nextBin = require.resolve('next/dist/bin/next');
const instanceId = crypto.randomUUID();
const serviceName = 'dealer-workbench';
const environment = process.env.NODE_ENV || 'development';

fs.mkdirSync(path.dirname(logPath), { recursive: true });

function write(kind, message) {
  const clean = String(message)
    .replace(/\u001b\[[0-9;?]*[ -/]*[@-~]/g, '')
    .trimEnd();
  if (!clean) return;
  try {
    fs.appendFileSync(logPath, `${new Date().toISOString()} [${kind}] ${clean}\n`, 'utf8');
  } catch {
    // A locked log file must not prevent the dev server from starting.
  }
}

const databaseEnv = { ...process.env };
const nestEnvPath = path.join(repoRoot, '.env.nestjs');
if (fs.existsSync(nestEnvPath)) {
  Object.assign(databaseEnv, dotenv.parse(fs.readFileSync(nestEnvPath)), process.env);
}

let lastDatabaseFailureAt = 0;
const runtimeEventStore = createRuntimeEventStore({
  env: databaseEnv,
  onFailure(error) {
    const now = Date.now();
    if (now - lastDatabaseFailureAt < 60000) return;
    lastDatabaseFailureAt = now;
    write('SUPERVISOR', `DATABASE_WRITE_FAILED message=${error.message}`);
  },
});

function recordSupervisor(eventType, message, fields = {}) {
  write('SUPERVISOR', message);
  if (!runtimeEventStore) return Promise.resolve(false);
  return runtimeEventStore.record({
    instanceId,
    serviceName,
    environment,
    eventType,
    severity: fields.severity,
    parentPid: process.pid,
    childPid: fields.childPid,
    exitCode: fields.exitCode,
    signal: fields.signal,
    message,
    metadata: fields.metadata,
  });
}

recordSupervisor(
  'process_started',
  `START instanceId=${instanceId} parentPid=${process.pid} cwd=${appRoot} node=${process.version}`,
  { metadata: { cwd: appRoot, nodeVersion: process.version, port: DEALER_WORKBENCH_PORT } }
);

const child = spawn(process.execPath, [nextBin, 'dev', '--port', String(DEALER_WORKBENCH_PORT), '--webpack'], {
  cwd: appRoot,
  env: process.env,
  stdio: ['inherit', 'pipe', 'pipe'],
  windowsHide: true,
});

recordSupervisor('child_started', `CHILD_STARTED childPid=${child.pid}`, {
  childPid: child.pid,
  metadata: { port: DEALER_WORKBENCH_PORT },
});

function pipe(stream, target, kind) {
  let pending = '';
  stream.setEncoding('utf8');
  stream.on('data', (chunk) => {
    if (target?.writable) {
      try {
        target.write(chunk);
      } catch {
        // Hidden/background launches may not keep stdout/stderr open.
      }
    }
    pending += chunk;
    const lines = pending.split(/\r?\n/);
    pending = lines.pop() || '';
    for (const line of lines) write(kind, line);
  });
  stream.on('end', () => {
    if (pending) write(kind, pending);
  });
}

const mirrorStdout = process.stdout?.isTTY ? process.stdout : null;
const mirrorStderr = process.stderr?.isTTY ? process.stderr : null;
pipe(child.stdout, mirrorStdout, 'STDOUT');
pipe(child.stderr, mirrorStderr, 'STDERR');

let heartbeatCount = 0;
const heartbeat = setInterval(() => {
  heartbeatCount += 1;
  write('SUPERVISOR', `HEARTBEAT parentPid=${process.pid} childPid=${child.pid}`);
  if (heartbeatCount % 4 === 0) {
    runtimeEventStore?.record({
      instanceId,
      serviceName,
      environment,
      eventType: 'heartbeat',
      severity: 'debug',
      parentPid: process.pid,
      childPid: child.pid,
      message: 'Process heartbeat',
      metadata: { port: DEALER_WORKBENCH_PORT },
    });
  }
}, 15000);
heartbeat.unref();

let forwardedSignal = null;
for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    if (forwardedSignal) return;
    forwardedSignal = signal;
    recordSupervisor('parent_signal', `PARENT_SIGNAL signal=${signal}`, {
      severity: 'warn',
      childPid: child.pid,
      signal,
    });
    child.kill(signal);
  });
}

child.on('error', (error) => {
  recordSupervisor('child_error', `CHILD_ERROR name=${error.name} message=${error.message}`, {
    severity: 'error',
    childPid: child.pid,
    metadata: { errorName: error.name, stack: error.stack },
  });
});

child.on('exit', async (code, signal) => {
  clearInterval(heartbeat);
  const exitCode =
    typeof code === 'number' ? code : signal === 'SIGINT' ? 130 : signal === 'SIGTERM' ? 143 : 1;
  await recordSupervisor(
    'child_exit',
    `CHILD_EXIT code=${code ?? 'null'} signal=${signal ?? 'null'}`,
    {
      severity: exitCode === 0 ? 'info' : 'warn',
      childPid: child.pid,
      exitCode,
      signal,
    }
  );
  await recordSupervisor('process_stopped', `PROCESS_STOPPED exitCode=${exitCode}`, {
    severity: exitCode === 0 ? 'info' : 'warn',
    childPid: child.pid,
    exitCode,
    signal,
  });
  await runtimeEventStore?.close();
  process.exit(exitCode);
});

let fatalErrorHandled = false;
process.on('uncaughtException', async (error) => {
  if (error && error.code === 'EPIPE') {
    write('SUPERVISOR', `IGNORED_EPIPE message=${error.message}`);
    return;
  }
  write(
    'SUPERVISOR',
    `UNCAUGHT_EXCEPTION name=${error.name} message=${error.message}\n${error.stack || ''}`
  );
  if (fatalErrorHandled) return;
  fatalErrorHandled = true;
  await runtimeEventStore?.record({
    instanceId,
    serviceName,
    environment,
    eventType: 'uncaught_exception',
    severity: 'fatal',
    parentPid: process.pid,
    childPid: child.pid,
    message: error.message,
    metadata: { errorName: error.name, stack: error.stack },
  });
  await runtimeEventStore?.close();
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  write('SUPERVISOR', `UNHANDLED_REJECTION reason=${String(reason)}`);
  runtimeEventStore?.record({
    instanceId,
    serviceName,
    environment,
    eventType: 'unhandled_rejection',
    severity: 'error',
    parentPid: process.pid,
    childPid: child.pid,
    message: String(reason),
  });
});

process.on('exit', (code) => {
  write('SUPERVISOR', `PARENT_EXIT code=${code}`);
});

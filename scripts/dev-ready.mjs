#!/usr/bin/env node
/**
 * Start normal remote-DB Next dev, then warm critical routes once.
 *
 * This keeps DATABASE_URL untouched. It only skips demo seed work and moves
 * first-hit compilation to startup instead of the first browser refresh.
 */

import { spawn } from 'node:child_process';
import { join } from 'node:path';

const PORT = process.env.PORT ?? '3005';
const BASE = process.env.BASE ?? `http://127.0.0.1:${PORT}`;
const HEALTH_TIMEOUT_MS = Number(process.env.DEV_READY_TIMEOUT_MS ?? 120_000);
const WARMUP_DELAY_MS = Number(process.env.DEV_READY_WARMUP_DELAY_MS ?? 800);

const NEXT_BIN = join(process.cwd(), 'node_modules', 'next', 'dist', 'bin', 'next');

const env = {
  ...process.env,
  NEXT_DIST_DIR: process.env.NEXT_DIST_DIR ?? '.next-dev',
  DISABLE_DEMO_SEED: process.env.DISABLE_DEMO_SEED ?? '1',
  NEXT_TELEMETRY_DISABLED: process.env.NEXT_TELEMETRY_DISABLED ?? '1',
};

const next = spawn(process.execPath, [NEXT_BIN, 'dev', '-p', PORT], {
  cwd: process.cwd(),
  env,
  stdio: 'inherit',
  windowsHide: true,
});

let shuttingDown = false;

function stop(signal = 'SIGTERM') {
  if (shuttingDown) return;
  shuttingDown = true;
  if (!next.killed) next.kill(signal);
}

process.on('SIGINT', () => stop('SIGINT'));
process.on('SIGTERM', () => stop('SIGTERM'));

next.on('exit', (code, signal) => {
  if (signal) process.exit(0);
  process.exit(code ?? 0);
});

async function waitForHealth() {
  const started = Date.now();
  while (Date.now() - started < HEALTH_TIMEOUT_MS) {
    try {
      const res = await fetch(`${BASE}/api/health`, { redirect: 'manual' });
      if (res.status < 500) return true;
    } catch {
      // Server is not listening yet.
    }
    await new Promise((resolve) => setTimeout(resolve, 1_000));
  }
  return false;
}

async function warmCriticalRoutes() {
  const ready = await waitForHealth();
  if (!ready) {
    console.warn(`[dev:ready] ${BASE} was not ready after ${HEALTH_TIMEOUT_MS}ms; skipping warmup.`);
    return;
  }
  await new Promise((resolve) => setTimeout(resolve, WARMUP_DELAY_MS));
  console.log('[dev:ready] Server is ready. Warming critical routes...');

  const warm = spawn(process.execPath, ['scripts/warmup.mjs'], {
    cwd: process.cwd(),
    env: {
      ...env,
      BASE,
      WARMUP_MODE: process.env.WARMUP_MODE ?? 'critical',
      WARMUP_CONCURRENCY: process.env.WARMUP_CONCURRENCY ?? '3',
    },
    stdio: 'inherit',
    windowsHide: true,
  });

  warm.on('exit', (code) => {
    if (code === 0) {
      console.log('[dev:ready] Critical route warmup complete.');
    } else {
      console.warn(`[dev:ready] Warmup exited with code ${code}. Dev server is still running.`);
    }
  });
}

void warmCriticalRoutes();

#!/usr/bin/env node
/**
 * Static build helper for Tauri.
 *
 * Next.js `output: 'export'` errors out on dynamic API routes
 * (those with `export const dynamic = 'force-dynamic'`). For the desktop
 * bundle the Rust backend (src-tauri/src/main.rs) replaces those routes,
 * so we temporarily rename every `route.ts` under `app/api/` to
 * `route.ts.tauri-stash` (file-level renames bypass directory-watcher
 * EPERM locks held by IDEs on Windows), run a static export, then
 * restore them — even if the build fails.
 */
import { existsSync, renameSync, readdirSync, statSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { createConnection } from 'node:net';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

function checkDevServerNotRunning() {
  return new Promise((resolve) => {
    const sock = createConnection(3000, '127.0.0.1');
    sock.setTimeout(1000);
    sock.on('connect', () => {
      sock.destroy();
      resolve(true);
    });
    sock.on('timeout', () => {
      sock.destroy();
      resolve(false);
    });
    sock.on('error', () => resolve(false));
  });
}

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const apiDir = join(root, 'app', 'api');
const STASH_SUFFIX = '.tauri-stash';
const ROUTE_BASENAMES = new Set(['route.ts', 'route.tsx', 'route.js', 'route.mjs']);

function walkRouteFiles(dir, hits = []) {
  if (!existsSync(dir)) return hits;
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    const st = statSync(p);
    if (st.isDirectory()) walkRouteFiles(p, hits);
    else if (ROUTE_BASENAMES.has(entry)) hits.push(p);
  }
  return hits;
}

function findStashedFiles(dir, hits = []) {
  if (!existsSync(dir)) return hits;
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    const st = statSync(p);
    if (st.isDirectory()) findStashedFiles(p, hits);
    else if (entry.endsWith(STASH_SUFFIX)) hits.push(p);
  }
  return hits;
}

function stashRoutes() {
  const files = walkRouteFiles(apiDir);
  for (const f of files) {
    const dst = f + STASH_SUFFIX;
    renameSync(f, dst);
  }
  console.log(`[build-static] stashed ${files.length} route files`);
  return files;
}

function restoreRoutes() {
  const stashed = findStashedFiles(apiDir);
  for (const f of stashed) {
    const dst = f.slice(0, -STASH_SUFFIX.length);
    try { renameSync(f, dst); } catch (e) {
      console.error(`[build-static] failed to restore ${f}: ${e.message}`);
    }
  }
  if (stashed.length) console.log(`[build-static] restored ${stashed.length} route files`);
}

const isWindows = process.platform === 'win32';

async function run() {
  let exitCode = 0;

  if (await checkDevServerNotRunning()) {
    console.error(
      '\n[build-static] ERROR: A dev server is responding on http://localhost:3000.\n' +
        '  The static build cannot rename app/api/ while Next.js dev holds those\n' +
        '  files open. Stop `npm run dev` first, then re-run this command.\n'
    );
    process.exit(2);
  }

  stashRoutes();

  try {
    await new Promise((resolve, reject) => {
      const child = spawn(isWindows ? 'npm.cmd' : 'npm', ['run', 'build'], {
        stdio: 'inherit',
        env: { ...process.env, TAURI: '1' },
        shell: isWindows,
      });
      child.on('error', reject);
      child.on('close', (code) => {
        exitCode = code ?? 0;
        resolve();
      });
    });
  } finally {
    restoreRoutes();
  }

  process.exit(exitCode);
}

run().catch((err) => {
  console.error('[build-static] error:', err);
  try { restoreRoutes(); } catch {}
  process.exit(1);
});

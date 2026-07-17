---
name: speed-up-next-dev
description: Diagnose and speed up Tandem local Next.js development when npm run dev is slow, hot reload stalls, pages compile for tens of seconds, API requests return slow 500s, or .next/.next-dev cache/vendor-chunks errors appear.
---

# Speed Up Next Dev

Use this skill when local Tandem development feels slow or flaky.

## First Checks

1. Inspect recent dev logs:

```powershell
Get-Content .dev-server.out.log | Select-Object -Last 120
Get-Content .dev-server.err.log | Select-Object -Last 120
```

2. Look for these high-signal symptoms:

- `Cannot find module './vendor-chunks/...js'`
- `PageNotFoundError: Cannot find module for page`
- `Compiled /_not-found in 30s` or repeated long route compiles
- API requests repeatedly returning `500` after several seconds
- hot reload not noticing file edits

3. Check current scripts and config before changing anything:

```powershell
Get-Content package.json
Get-Content next.config.js
```

## Tandem Dev Commands

Prefer the project scripts:

```powershell
npm run dev
```

This uses `NEXT_DIST_DIR=.next-dev`, keeps dev cache separate from production `.next` build output, and sets `DISABLE_DEMO_SEED=1` so normal remote-DB development does not wait on demo/showcase seed work at boot.

When cold compilation is the main pain and the user wants to keep using the real remote database, use:

```powershell
npm run dev:ready
```

`dev:ready` starts normal Next dev on port 3005, keeps `DATABASE_URL` untouched, waits for `/api/health`, then runs critical route warmup once. It is the best default for "first refresh is painfully slow" because it pays route compilation during startup instead of during the first browser navigation.

For fastest UI/local interaction work, bypass remote PostgreSQL and use in-memory seed data:

```powershell
npm run dev:fast
```

Use `dev:fast` when `.env.local` points `DATABASE_URL` at a remote database and refreshes are slow because many API calls wait on network/database latency. The script creates a local `.dev-memory` marker while it runs; `lib/infra/storage-mode.ts` treats that marker as a request to boot in memory mode. Switch back to `npm run dev` when the user needs real remote data, persistence across restarts, auth/session parity, or production-like DB behavior.

When dev becomes slow or stale:

```powershell
npm run dev:clean
npm run dev
```

When a dev server is already running and cold compilation is the main pain, warm routes before using the app:

```powershell
npm run dev
npm run dev:warm
```

`dev:warm` calls `scripts/warmup.mjs` against `http://127.0.0.1:3005` by default. It first tries to log in using `WARMUP_EMAIL/WARMUP_PASSWORD` or `.env.local` bootstrap owner credentials. If that fails, it creates a short-lived local signed `tandem_at` warmup cookie so protected UI pages compile while still using the real configured database.

By default `dev:warm` runs `critical` mode for the routes most likely to affect refresh speed. For a full site compile pass:

```powershell
npm run dev:warm:full
```

Use polling only when file changes are not detected:

```powershell
npm run dev:poll
```

`dev:poll` is slower on Windows because webpack scans files repeatedly. Do not make polling the default unless the user confirms watcher events are broken.

## Cache Policy

- Treat `.next-dev` as disposable local dev cache.
- Keep `next build` on `.next` unless there is a specific reason to change production build output.
- If a build/dev cache is corrupt, clear `.next-dev` first.
- Only clear `.next` when build output itself is broken or after confirming the dev cache fix did not help.

The project cleanup script supports:

```powershell
npm run dev:clean
node scripts/clean-dev-cache.mjs --all
```

Use `--all` cautiously: it removes both `.next-dev` and `.next`, forcing a slower full rebuild next time.

## Recommended Fix Pattern

If the project does not yet have the faster dev setup:

1. Add `NEXT_DIST_DIR=.next-dev` to `dev` and `dev:lan`.
2. Add `dev:poll` with `NEXT_WEBPACK_POLL=1`.
3. Add `dev:clean` to remove `.next-dev`.
4. Update `next.config.js` so polling is conditional on `NEXT_WEBPACK_POLL === '1'`.
5. Verify with:

```powershell
node --check next.config.js
node --check scripts/clean-dev-cache.mjs
npm run dev:clean
```

## Guardrails

- Do not remove user code or unrelated generated artifacts.
- Do not run destructive cleanup outside the project root.
- If a dev server is running, tell the user to stop and restart it after config changes.
- If the issue is an API-specific slow path after cache cleanup, switch from cache work to route profiling using the slow endpoint from logs.

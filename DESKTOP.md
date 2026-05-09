# 铁山 Desktop App (Tauri)

## Architecture

| Runtime | Frontend | Backend | API client path |
|---|---|---|---|
| **Web (browser)** | Next.js dev / `next start` | Next.js API routes in `app/api/*` (which spawn `hermes` CLI) | `lib/hermes-api.ts` → `fetch()` |
| **Desktop (Tauri)** | Static export to `dist/` | Rust commands in `src-tauri/src/main.rs` (which spawn `hermes` CLI) | `lib/hermes-api.ts` → `invoke()` |

`lib/hermes-api.ts` auto-detects `window.__TAURI_INTERNALS__` and routes calls
to either `fetch('/api/...')` or `invoke('hermes_...')`. Pages are agnostic —
they just call `getStatus()`, `getSkills()`, `startWorkflowRun()`, etc.

### Rust commands implemented (`src-tauri/src/main.rs`)

- `hermes_health` ↔ `/api/health`
- `hermes_skills` ↔ `/api/skills`
- `hermes_status` ↔ `/api/status`
- `hermes_mcp_list` ↔ `/api/mcp`
- `hermes_memory_status` ↔ `/api/memory`
- `hermes_logs` ↔ `/api/logs`
- `hermes_cron_list` / `hermes_cron_action` / `hermes_cron_create` ↔ `/api/cron`
- `hermes_chat_stream` ↔ `/api/stream` (uses Tauri events `hermes-stream`)
- `hermes_workflow_run` ↔ `/api/workflows/run` (uses per-runId Tauri events `workflow:<runId>`)

## Quick start

```powershell
# Dev (live reload, full debugger):
npm run tauri:dev

# Production .exe:
#   First, stop any running `npm run dev` (it locks app/api/ files)
npm run tauri:build
```

The output `.msi` / `.exe` lands under `src-tauri/target/release/bundle/`.

## Build pipeline

`npm run tauri:build` triggers (per `tauri.conf.json` → `beforeBuildCommand`):

1. **`scripts/build-static.mjs`** — refuses to run if port 3000 is busy,
   then renames `app/api/` → `app/_api_stashed_for_tauri/` (so Next.js
   doesn't choke on dynamic API routes during `output: 'export'`).
2. **`next build`** with `TAURI=1` — emits a fully static frontend to
   `dist/`. Conditional in `next.config.js`.
3. **Restore** — script unconditionally renames `_api_stashed_for_tauri/`
   back to `api/`, even on failure.
4. **Tauri** picks up `dist/` (declared as `frontendDist`), bundles it
   along with the Rust binary into `target/release/bundle/`.

## Prerequisites

`npx tauri info` reports your toolchain. Required:

- ✅ Rust 1.95+ — `cargo check` already passes locally
- ✅ Node.js 18+ — installed
- ✅ WebView2 runtime — installed (comes with Win11 / Edge)
- ⚠️ **MSVC Build Tools (linker)** — install if missing:
  https://aka.ms/vs/17/release/vs_BuildTools.exe → *Desktop development with C++*

If `cargo build --release` complains about `link.exe` not found, that's the
only thing left to install.

## Development workflow

```powershell
# Web hot-reload only:
npm run dev                    # → http://localhost:3000

# Native window pointing at the dev server (Rust commands also active):
npm run tauri:dev

# Static export sanity check (no Tauri bundle):
npm run build:static           # produces dist/

# Pure Rust verification:
cargo check --manifest-path src-tauri/Cargo.toml
```

## Notes

- **Don't run `npm run dev` while `npm run tauri:build` is running.**
  The static-build script will refuse to start (port 3000 conflict, file locks).
- The unified `lib/hermes-api.ts` is the only canonical entry point for
  backend calls. Don't add new `fetch('/api/...')` calls in pages.
- New backend commands need to be added in **both** places:
  - `app/api/<name>/route.ts` (web)
  - `src-tauri/src/main.rs` (`hermes_<name>` + register in `invoke_handler!`)
  - `lib/hermes-api.ts` (export a function that branches on `isTauri()`)

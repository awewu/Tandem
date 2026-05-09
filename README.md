# 拿捏 — 工作不会找拿捏

> **Hermes AI Agent Dashboard** · Web + Desktop control plane for the **Hermes** AI platform.
> Same UI runs in a browser tab or as a native Windows app.

## Stack

- **Frontend** — Next.js 14 (App Router) · React 18 · TypeScript · Tailwind · shadcn/ui · Zustand
- **Backend (web)** — Next.js Route Handlers, each one wraps a `hermes` CLI invocation
- **Backend (desktop)** — Rust commands in `src-tauri/src/main.rs` (Tauri v2), same wrapping pattern
- **Unified client** — `lib/hermes-api.ts` auto-detects runtime and routes calls to either `fetch('/api/...')` or `invoke('hermes_...')`

## Pages (14)

| Path | Purpose |
|---|---|
| `/` | Dashboard — backend health, stats, quick actions |
| `/chat` | Multi-session streaming chat (CLI or BYOK OpenAI-compatible) |
| `/agents` | 8 preset agents + custom agent CRUD with system prompts |
| `/workflows` | Visual node editor + topological-sort execution engine |
| `/tasks` | Hermes cron jobs (list/create/run/pause/resume/delete) |
| `/skills` | Skills marketplace synced from `hermes skills list` |
| `/knowledge` | Local knowledge base |
| `/memories` | Project standards / consensus / requirements store |
| `/organization` | 三省六部 org chart |
| `/okr` | Objectives & key results |
| `/mcp` | MCP servers + built-in Hermes tools |
| `/logs` | Live tail of `hermes logs` with level/component filters |
| `/design` | Design system reference |
| `/settings` | Theme, backend test, data export/import |

## Backend surface (10 endpoints / 12 Rust commands — all paired)

| Endpoint | Rust command | Unified client export |
|---|---|---|
| `GET /api/health` | `hermes_health` | `getHealth` |
| `GET /api/status` | `hermes_status` | `getStatus` |
| `GET /api/skills` | `hermes_skills` | `getSkills` |
| `GET /api/mcp` | `hermes_mcp_list` | `getMCPServers` |
| `GET /api/memory` | `hermes_memory_status` | `getMemoryStatus` |
| `GET /api/logs` | `hermes_logs` | `getLogs` |
| `GET /api/cron`, `POST /api/cron`, `DELETE/POST/PATCH /api/cron/[id]` | `hermes_cron_list` / `hermes_cron_create` / `hermes_cron_action` | `getCronJobs` / `createCronJob` / `runCronAction` |
| `POST /api/stream` (SSE) | `hermes_chat_stream` | `startChatStream` |
| `POST /api/llm-stream` (SSE, BYOK) | `hermes_llm_stream` | `startLLMStream` |
| `POST /api/workflows/run` (SSE) | `hermes_workflow_run` | `startWorkflowRun` |

Streaming endpoints emit identical `{ content }` / `{ error }` / `{ done }`
payloads in either runtime — web via SSE on the response body, Tauri via the
`hermes-stream` (chat / BYOK) or `workflow:<runId>` (workflows) event bus.

## Quick start

### Web (browser, dev)

```powershell
npm install
npm run dev
# → http://localhost:3000
```

### Desktop dev (Rust hot-reload + frontend hot-reload)

```powershell
npm run tauri:dev
```

### Desktop production (.exe installer)

```powershell
# stop any `npm run dev` first (build:static refuses if port 3000 is busy)
npm run tauri:build
# → src-tauri/target/release/bundle/nsis/铁山_<version>_x64-setup.exe   (~3 MB)
# → src-tauri/target/release/tieshan.exe                                (~12 MB raw exe)
```

See `DESKTOP.md` for prerequisites (MSVC Build Tools, WebView2), the
`scripts/build-static.mjs` API-route stash mechanism, and packaging notes.

## Project layout

```
app/
  ├── api/                         # 10 Next.js Route Handlers (web backend)
  ├── (14 page routes)
  └── layout.tsx                   # ErrorBoundary + ThemeProvider + Sidebar
components/
  ├── ui/                          # shadcn primitives + skeleton.tsx
  ├── empty-state.tsx
  ├── error-boundary.tsx
  └── (sidebar, command-palette, keyboard-shortcuts, …)
lib/
  ├── hermes-api.ts                # unified client (web ↔ Tauri)
  ├── hermes-cli.ts                # web-side CLI runner
  ├── hooks.ts                     # useHermesStatus (uses unified client)
  ├── store.ts                     # Zustand stores (chat / agents / tasks / memory / knowledge)
  └── …
src-tauri/
  ├── src/main.rs                  # 12 Rust commands (mirrors of API routes)
  ├── tauri.conf.json
  └── Cargo.toml
scripts/build-static.mjs           # API-route stash for Tauri static export
dist/                              # output of `npm run build:static`
DESKTOP.md                         # desktop / Tauri reference
```

## Adding a new backend command

Three files, one per layer:

1. **`app/api/<name>/route.ts`** — Next route handler (web)
2. **`src-tauri/src/main.rs`** — `hermes_<name>` `#[tauri::command]` + register in `invoke_handler!`
3. **`lib/hermes-api.ts`** — exported function that branches on `isTauri()` and normalizes the two response shapes

Pages should always import from `lib/hermes-api.ts` — never call `fetch('/api/...')` or `invoke()` directly.

## Conventions

- All page-level types live in `lib/hermes-api.ts` (e.g. `HermesStatus`,
  `MCPServer`, `MemoryStatus`, `LogLine`). The static-build script stashes
  `app/api/*/route.ts` files during Tauri export, so importing types from
  there would break the build.
- Streaming pages must handle both runtimes:
  - Tauri: `import { listen } from '@tauri-apps/api/event'`
  - Web: read `response.body` as SSE
- New env-dependent code paths must guard `typeof window === 'undefined'`
  and `isTauri()` checks.

## License

MIT

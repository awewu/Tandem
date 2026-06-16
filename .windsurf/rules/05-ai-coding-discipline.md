---
trigger: always_on
---

# AI Coding Discipline — Standing Rules

## Change Scope
- Prefer **minimal upstream fixes** over downstream workarounds.
- Never delete or weaken existing tests without explicit instruction.
- Do not add or remove comments/JSDoc unless asked.

## Code Style
- No emojis in source files unless explicitly requested.
- Imports always at the top of the file.
- Follow existing naming conventions in the file being edited.

## Database Safety
- Never run `npm run db:push` or `drizzle-kit push`.
- New schema changes → idempotent DDL script only.
- Always verify `tenantId` isolation in queries.

## Verification Commands
```powershell
# Type check (ignore vendor/paperclip errors)
npx tsc --noEmit

# Unit tests
npx vitest run

# Dev server (already running on port 3000 — check before starting a new one)
netstat -ano | findstr :3000
```

## Token Efficiency
- Read files before editing — use `code_search` first for multi-file exploration.
- Batch independent tool calls in parallel.
- Do not re-read files already viewed in the same session unless content may have changed.
- Skip acknowledgement phrases; start responses with substance.

## Seeding
- Always check existing record count before inserting seed data (idempotent guard).
- Seed entry point: `lib/fixtures/seed.ts` → `seedExtraModulesIfEmpty()`.

## "Fake Closed Loop" Prevention
- Any new tool-capable AI path must be probe-tested with a real model before claiming it works.
- Skill IDs with dots must be sanitised for LLM function-calling (see `tool-loop.ts`).

---
trigger: always_on
---

# Architecture Patterns & Coding Conventions

## Storage Layer
- Interface: `lib/storage/repository.ts` → `TandemStore`
- Implementations: `lib/storage/memory-store.ts` (dev/test) · `lib/storage/drizzle-store.ts` (prod)
- To add a new repository: register it in all three files (interface + both implementations).
- Seed data: `lib/fixtures/seed.ts` `seedExtraModulesIfEmpty()` — always **idempotent** (check existing count first).

## API Route Conventions
- All routes call `boot()` at the top, then `requireAuth(req)` for tenant + role isolation.
- Return `NextResponse.json({ error }, { status })` on failure.
- Tenant filter: always compare `record.tenantId === auth.tenantId`.
- Soft-delete pattern: set `archivedAt = new Date()`, never physically delete.

## Client Component Conventions
- Use `useParams()` (not `use(params)`) in Client Components to read dynamic route params.
- Fetch patterns: `useEffect` → `fetch(url, { credentials: 'include', cache: 'no-store' })`.
- State shape: `status: 'loading' | 'ok' | 'notfound' | 'error'`.

## Central AI (CompanyBrain)
- `userId = '__company__'`, `stage = partner`, `delegationLevel = cross_company`.
- Never a `proposer` of governance actions (Constitution Rule A).
- Tool-loop skill IDs use dots (e.g. `okr.health_digest`) — sanitised to underscores for LLM function-calling, restored on return (`lib/agent-runtime/tool-loop.ts` `sanitizeToolName`).
- Two registries: `skillRegistry` (read-only tools, tool-loop) vs `actionRegistry` (write actions, only via `proposeAction`).

## OKR / Governance
- Check-in side-effect chain: `api/okr/checkins` → `executeAction('kr.checkin')` → `lib/ontology/actions/kr-checkin.ts` → `lib/okr/rollup.ts` `propagateRollupFromKr`.
- `proposeAction` zones: red (reject) / green (execute + audit) / yellow (awaiting_veto 24 h window).
- `commit_short` and `cross_company` delegation scopes allow commit; `commit_long` escalates to red.

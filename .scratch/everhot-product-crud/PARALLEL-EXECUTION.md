# Everhot Product CRUD Parallel Execution

## Delivery principle

Prioritize the fastest functional closed loop. Do not add PDF or technical-document uploads, approval workflows, release reviews, rollback systems, operator logs, or extra security audit work. Reuse the platform's existing authentication, tenant isolation, and public API boundaries.

Agents must not invoke installed skills unless the user explicitly authorizes the skill.

## Wave 1: start immediately

- `01-basic-product-crud.md`
- `02-root-path-deployment.md`

These issues touch different primary surfaces and can run concurrently.

## Wave 2: start after Issue 01

- `03-product-status-and-order.md`
- `04-product-images.md`
- `05-specs-and-highlights.md`
- `06-product-recommendations.md`

All four issues can run concurrently after the basic product contract and CRUD path are available. Each agent should stay within its assigned product capability and avoid editing another issue's UI components or service methods unless coordination is recorded first.

## Wave 3: integration

- `07-runtime-consumers-and-e2e.md`

Start only after Issues 01 through 06 are complete. This issue owns cross-surface integration, runtime fallback states, and the final end-to-end verification.

## Critical path

`01 -> 03/04/05/06 -> 07`

Issue 02 runs independently but must complete before Issue 07.

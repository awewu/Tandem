# Simulated Non-Product Website Materials Tab

Status: ready-for-agent

## Parent

`docs/dev/brand-site-local-runtime-crud-prd.md`

## What to build

Complete the `产品 / 其他素材` switch in the brand website content control area. `产品` should continue to show current product data. `其他素材` should show simulated records for non-product website content, such as homepage hero, brand story, service banner, and footer credentials.

This is intentionally a simulated-data UI slice. It should establish the operator workflow without claiming real DAM or production publishing integration.

## Acceptance criteria

- [ ] The brand website content area has a clear `产品 / 其他素材` switch.
- [ ] The `产品` tab preserves the current product table and product behavior.
- [ ] The `其他素材` tab displays simulated non-product material records.
- [ ] Simulated material records clearly indicate they are not yet backed by real production data.
- [ ] No real DAM API or production publish workflow is introduced in this slice.
- [ ] `pnpm --filter dealer-workbench build` passes.

## Blocked by

None - can start immediately.

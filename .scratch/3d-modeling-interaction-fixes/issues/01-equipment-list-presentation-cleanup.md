# Equipment List Presentation Cleanup

Status: proposed
Type: AFK
Parallel wave: Wave 1 - can start immediately

## What to build

Clean the equipment list presentation in `4003/viewer` so it reads as a business equipment list instead of a debug panel. The UI must hide internal component IDs, UUIDs, `manual-*`, `hvac-*`, template IDs and BOM codes while preserving those fields inside data payloads for linking, summaries, BOM, quote and audit.

## Acceptance criteria

- [ ] Equipment list cards do not render `manual-*`, `hvac-*`, UUID, component ID, template ID or BOM code.
- [ ] Equipment list cards still show Chinese equipment name, quantity, capacity/load and system information.
- [ ] Linked component IDs remain available in internal data payloads where summaries, BOM, quote or highlight logic need them.
- [ ] Status should be shown by concise Chinese label or icon, not debug text.
- [ ] Existing generated equipment rows still render correctly.
- [ ] Existing manual equipment rows still render correctly.
- [ ] Equipment summary and BOM/quote handoff tests still pass.
- [ ] No IFC/GLB loader logic is changed.

## Blocked by

None - can start immediately

## Notes

This is a display-contract fix. Do not remove IDs from backend data or persisted model structures; only sanitize formal UI rendering.

# IFC/GLB Protected Regression and Source Tree Integration

Status: proposed
Type: AFK
Parallel wave: Wave 4 - after Issue 06

## What to build

Add regression coverage and light source-tree integration proving IFC/GLB import remains a protected native capability after the interaction changes. Imported sources may appear in the object tree, but loader behavior, file opening, model viewing and error handling must not regress.

## Acceptance criteria

- [ ] Local IFC open still works or remains covered by the existing agreed fixture/mock boundary.
- [ ] Local GLB open still works or remains covered by the existing agreed fixture/mock boundary.
- [ ] Backend artifact/model source open still works.
- [ ] IFC/GLB loading errors remain visible and recoverable inside the unified page.
- [ ] Imported IFC/GLB source nodes appear in the object tree when a source is loaded.
- [ ] Lack of deep BIM hierarchy extraction does not block the object tree.
- [ ] Existing orbit, pan, zoom and fit-view behavior remains intact for imported models.
- [ ] No IFC/GLB loader main logic is rewritten for manual component CRUD.
- [ ] Browser smoke or focused regression tests prove the protected import/viewing behavior.

## Blocked by

- `issues/06-model-object-tree-layer-panel.md`

## Notes

This issue is a guardrail issue. Its purpose is to prevent interaction work from accidentally breaking original viewer capabilities.

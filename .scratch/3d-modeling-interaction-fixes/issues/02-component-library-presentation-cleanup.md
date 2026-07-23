# Component Library Presentation Cleanup

Status: proposed
Type: AFK
Parallel wave: Wave 1 - can start immediately

## What to build

Clean the component library cards in `4003/viewer` so the library feels like a professional tool palette. Cards should show icon, Chinese component name and core dimensions/parameters. Seed source, BOM code, template ID, component ID, drag/test hints and long technical metadata must be hidden from the normal UI.

## Acceptance criteria

- [ ] Component cards prioritize icon, Chinese name and core dimensions.
- [ ] Normal UI does not show seed source, seed version/date, BOM code, template ID, component ID or long technical metadata.
- [ ] Normal UI does not show test/drag instruction text such as “拖入视图放置” as persistent small copy.
- [ ] Required cards still appear: `200mm 标准墙体`, `900mm 单开门`, `1500mm 标准窗`, `客餐厅热区`.
- [ ] Tool rail/category controls use concise Chinese labels and icons where available.
- [ ] Technical metadata remains available in state/data attributes/API payloads for placement and persistence.
- [ ] Existing catalog tests still prove required categories/templates are available.
- [ ] No IFC/GLB loader logic is changed.

## Blocked by

None - can start immediately

## Notes

Do not delete catalog metadata. Hide it from formal UI while preserving it for component creation, BOM mapping and tests.

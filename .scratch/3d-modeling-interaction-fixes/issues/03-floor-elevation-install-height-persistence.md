# Floor Elevation and Install Height Persistence

Status: proposed
Type: AFK
Parallel wave: Wave 1 - can start immediately

## What to build

Add or formalize persisted floor, elevation and install-height fields for viewer component instances. Users must be able to place or edit equipment on a non-ground elevation, such as second floor or ceiling height, and reload the same height after refresh/reopen.

## Acceptance criteria

- [ ] Component instances support floor and elevation/installHeight or equivalent persisted fields.
- [ ] Vertical axis convention is clear and consistent; do not mix `y` and `z` as height.
- [ ] Equipment can be assigned a floor before or during placement.
- [ ] Selected equipment exposes floor/elevation/install-height fields in the property editor.
- [ ] Saving and refreshing restores floor/elevation/install-height.
- [ ] Backend validation rejects invalid floor, invalid height and malformed position values.
- [ ] Tenant/dealer/store ownership checks still apply.
- [ ] Existing dimensions, position, rotation, visibility, lock state, system key, business metadata and BOM metadata continue to persist.
- [ ] BOM/quote summaries continue to count elevated equipment unless deleted or explicitly excluded.
- [ ] No IFC/GLB loader logic is changed.

## Blocked by

None - can start immediately

## Notes

This issue establishes the data contract and property editing surface for elevated placement. Height-aware drag placement is handled by Issue 04.

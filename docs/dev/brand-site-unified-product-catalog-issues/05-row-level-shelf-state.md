# 05 - Row-level website shelf state and assignment enforcement

## What to build

Make row-level shelf controls show and transition `未上架`, `已上架`, and `已下架` for the current brand website. The state must come from brand-site product assignments, while product facts remain in the product catalog.

## Acceptance criteria

- [ ] Each product row shows the current website shelf state for the current brand site.
- [ ] `未上架` means there is no active published assignment for the current site.
- [ ] `已上架` means the current site assignment is published.
- [ ] `已下架` means the product has a current site assignment that is hidden or archived from website display.
- [ ] Row controls can publish and hide products through brand-site assignment APIs.
- [ ] Backend validation rejects assigning products to an incompatible concrete brand site.
- [ ] Product catalog active/inactive status is not conflated with website shelf state.
- [ ] Focused backend or interaction tests cover state transitions and cross-brand rejection.

## Blocked by

- 01 - Brand-filtered product listing for Rheem, Ruud, and Everhot.

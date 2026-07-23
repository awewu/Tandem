# 01 - Brand-filtered product listing for Rheem, Ruud, and Everhot

## What to build

Make concrete brand website consoles list product catalog records filtered by the current brand. `/comfort/sites/rheem` shows Rheem products, `/comfort/sites/ruud` shows Ruud products, and `/comfort/sites/everhot` shows Everhot products. The list must use product catalog data as the source of truth, not separate website-only product rows.

## Acceptance criteria

- [ ] Each concrete brand page requests product catalog data with the current normalized brand.
- [ ] Products created or edited in the central product catalog appear on the matching brand page after refresh.
- [ ] A concrete brand page does not show products belonging to another supported brand.
- [ ] Product master fields and website shelf assignment fields remain separate in the UI and adapter layer.
- [ ] Empty states explain that the current brand has no product catalog records, not that website products are a separate dataset.
- [ ] Focused verification covers at least Everhot plus one of Rheem/Ruud.

## Blocked by

None - can start immediately.

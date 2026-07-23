# 02 - Paginated product query and brand console pagination controls

## What to build

Add or complete paginated product management for brand website consoles. Brand pages must request one page at a time and support searching/filtering without loading the full product catalog into the browser.

## Acceptance criteria

- [ ] Product list requests support `brand`, `page`, `pageSize`, and `keyword`.
- [ ] Product list requests support `status` and `category` where the existing backend contract allows it.
- [ ] The brand console renders pagination controls with current page, total, previous, and next behavior.
- [ ] Search and filters preserve current brand scoping.
- [ ] Changing page, keyword, or filter reloads only the requested page.
- [ ] Loading, empty, and error states remain clear.
- [ ] Focused tests or smoke coverage prove pagination behavior.

## Blocked by

None - can start immediately.

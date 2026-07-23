# Brand Site Environment Addresses and Quick Preview

Status: ready-for-agent

## Parent

`docs/dev/brand-site-local-runtime-crud-prd.md`

## What to build

Show the current brand site's runtime environment addresses in the 5000 brand website control panel. The labels must be `测试环境` and `生产环境`. Each environment should provide a quick-open link/button so an operator can jump to the local testing site or production site from the current brand page.

Everhot must resolve its testing environment to `http://localhost:5011/` for the first local development proof. The implementation should stay brand-scoped rather than treating 5011 as a global hard-coded website.

## Acceptance criteria

- [ ] The current brand website control panel displays `测试环境` and `生产环境`.
- [ ] Everhot's `测试环境` link opens `http://localhost:5011/`.
- [ ] The environment links are derived from brand site configuration or a brand-scoped fallback, not from a global 5011-only assumption.
- [ ] The Everhot product CRUD panel still loads and keeps the local 5011 testing link visible.
- [ ] A focused UI/static test or smoke verifies the labels and Everhot testing URL.
- [ ] `pnpm --filter dealer-workbench build` passes.

## Blocked by

None - can start immediately.

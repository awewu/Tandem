# Everhot 5011 Runtime Product Loader With Static Fallback

Status: ready-for-agent

## Parent

`docs/dev/brand-site-local-runtime-crud-prd.md`

## What to build

Adapt the local Everhot website running on `http://localhost:5011/` so it can render product data from the Nexus public brand-site runtime product endpoint. During local development, the 5011 site should prefer the runtime endpoint. If the endpoint is unavailable, it should fall back to the existing static generated product data so the website remains usable.

This slice should prove that website rendering can be driven by backend-managed, website-published products without removing the existing static pipeline.

## Acceptance criteria

- [ ] The 5011 Everhot website attempts to load products from the public Everhot runtime endpoint in local development.
- [ ] Published products from the runtime endpoint are rendered in the existing product listing experience.
- [ ] If the runtime endpoint fails or is unavailable, the site falls back to the current static product data.
- [ ] The implementation does not remove the current static generation pipeline.
- [ ] A focused local smoke or unit test covers runtime success and fallback behavior.
- [ ] The relevant Everhot website build or smoke command passes.

## Blocked by

- `02-public-brand-site-runtime-products`

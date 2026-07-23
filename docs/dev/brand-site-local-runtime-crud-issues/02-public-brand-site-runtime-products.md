# Public Brand-Site Runtime Product Endpoint

Status: ready-for-agent

## Parent

`docs/dev/brand-site-local-runtime-crud-prd.md`

## What to build

Expose a public runtime product endpoint for brand websites to consume during local development. For Everhot, the endpoint must return only products that are published to the Everhot website shelf by combining product catalog data with brand-site product assignments.

The endpoint is for website rendering, so it must omit internal-only fields such as cost, privileged metadata, and backend-only workflow data. It should follow existing `/api/v2/*` API and route ownership conventions.

## Acceptance criteria

- [ ] A `/api/v2/*` public brand-site runtime product endpoint exists for brand website consumption.
- [ ] For Everhot, the endpoint returns only products with published Everhot website assignments.
- [ ] Hidden, draft, archived, or unassigned products are excluded from the public website response.
- [ ] The response contains only website-safe product fields needed for rendering.
- [ ] Route ownership is registered or confirmed for the new public endpoint.
- [ ] A focused backend/contract test proves filtering and field safety.

## Blocked by

None - can start immediately.

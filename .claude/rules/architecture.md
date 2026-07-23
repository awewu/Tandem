# Architecture Rules

- Prefer `/api/v2/*` for new production APIs.
- Keep `server-production.js` moving toward composition only.
- Every route must be represented by `server/modules/routeOwnership.js`.
- A route owner must be one of: production module, legacy compatibility owner, or explicit migration shim.
- Duplicate routes are allowed only during compatibility migration and must have a target owner.
- Run `npm run harness:consolidation` after route changes.

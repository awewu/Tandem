# Refactor Routes

Route refactor sequence:

1. Check `audit/product-consolidation-report.json`.
2. Pick one duplicate route group.
3. Identify target owner in `server/modules/routeOwnership.js`.
4. Add/verify contract tests.
5. Move behavior to module owner.
6. Keep compatibility shim only if active frontend still uses it.
7. Run `npm run harness:consolidation` and `npm run test:production-readiness`.

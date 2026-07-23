# Phase 1 Backend Cleanup Matrix

Source of truth: `server/modules/productionRouteCatalog.js` exports `PHASE1_BACKEND_CLEANUP_MATRIX`.

Evidence used:
- `scripts/agent-guards/active-navigation-check.js` keeps Hub modules `brand-console`, `growth`, `product`, `public`, `comfort`, `accounts`.
- The same guard hides `diagnosis`, `crm`, `bim`, `bim-deepen`, `customer`, and `aftersales` navigation.
- Active legacy pages are `index.html`, `index-ready.html`, `privacy.html`, and `consent.html`.
- Retained React/console calls cover auth/session/account management, brand, brand-sites, product-catalog, file-artifact/DAM, growth, and publish.

## Retained

Keep active:
- `v2`
- `admin-guard`
- `cache-delete-guard`
- `backup-guard`
- `qa-config-guard`

Reason: retained pages and consoles require auth/account permissions, brand, product, DAM, growth, and publish APIs. These are routed to NestJS `/api/v2/*` or admin guard compatibility surfaces.

## Unreachable Out Of Scope

Disable from active production mounting, without deleting backend files:
- `dxf-bim`
- `rysnova-bim-base`
- `construction`
- `smart-routing`
- `delivery`
- `rysnova-bim-runtime`
- `tech-support`

Reason: these mounts serve only hidden Phase 1 domains: BIM/Rysnova BIM preview/runtime, construction/delivery, or technical support/settlement. No current active page or retained navigation uses them.

## Legacy Compatibility

Keep active for now:
- `new-features`
- `marketing`
- `exports`
- `reports`
- `drawings-reports-compat`
- `core-api`
- `standards`
- `closed-loop`
- `enterprise-loop`
- `page-aliases`
- `qa`
- `governance-runtime`
- `promotions`
- `journey`
- `ops-runtime`

Reason: these are existing compatibility or governance surfaces. They need a separate migration decision before removal.

## Unknown

Keep active pending narrower evidence:
- `business-domain`
- `front-office-runtime`
- `ai-assistant`
- `channel`
- `oneclick`
- `quotation`
- `quotation-v2`
- `calculation`
- `three-tier`
- `package-purchase`
- `supreme`
- `revit`
- `workflows`
- `hotwater`
- `econet`

Reason: these modules are mixed legacy facades or broad compatibility mounts. They are not proven retained by active navigation, but their blast radius is not proven to be single-domain out-of-scope.

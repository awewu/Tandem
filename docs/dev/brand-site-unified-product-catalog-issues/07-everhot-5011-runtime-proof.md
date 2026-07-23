# 07 - Everhot 5011 published-product runtime proof

## What to build

Prove the Everhot local website reads published Everhot products from the public runtime endpoint and excludes products that are unlisted or hidden on the Everhot site. Runtime API failure must fall back to static data.

## Acceptance criteria

- [ ] `http://localhost:5011/` requests the public Everhot site product endpoint during local development.
- [ ] Published Everhot products appear in the website product surfaces that currently use runtime catalog data.
- [ ] Unlisted and hidden Everhot products do not appear.
- [ ] Products from Rheem and Ruud do not appear on the Everhot website.
- [ ] Runtime failure uses the existing static fallback data.
- [ ] The public response excludes internal-only product fields.
- [ ] The Everhot runtime smoke passes.

## Blocked by

- 05 - Row-level website shelf state and assignment enforcement.

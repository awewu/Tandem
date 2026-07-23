# 瑞诺瓦AI舒适家 PostgreSQL Target Schema

This directory contains the target PostgreSQL business-ledger contract for the 瑞诺瓦AI舒适家 rewrite path.

It is not proof that the current Express/Mongo compatibility trunk has already migrated to PostgreSQL. It is a checked migration contract for the future NestJS/Fastify/PostgreSQL trunk.

Guard:

```bash
npm run guard:postgres-target-schema
```

The guard verifies that the target ledger has tenant-aware tables, Row Level Security, audit logs, outbox events, workflow tracking, and file artifact records.

Rysnova artifact production requirements:

- `rhautt_nexus.file_artifacts` is the PostgreSQL ledger for customer-visible Rysnova deliverables and other file-backed artifacts.
- Customer package reads must use tenant, `data_namespace`, `customer_id`, `project_id`, visibility/status, and recency keys instead of broad project scans.
- Customer-facing artifacts track `customer_visible`, `artifact_status`, storage provider, and storage integrity proof so approval/share and object-storage verification remain auditable.
- Object bytes still live in object storage; PostgreSQL stores the tenant-scoped object key, content hash, visibility, approval, and integrity metadata.

The target ledger also includes three product-module tables. They keep 瑞诺瓦 and Rysnova usable inside the Rhautt portal while preserving future standalone product evolution:

- `rhautt_nexus.product_modules`: product identity, namespace, API namespace, embedded entry, standalone aliases, object storage prefix, analytics namespace, and future extraction strategy.
- `rhautt_nexus.product_module_deployments`: portal-embedded and standalone deployment registrations. Standalone rows require future external domain/deploy proof before final launch can be claimed.
- `rhautt_nexus.product_module_data_partitions`: data extraction contract, including `module_namespace`, `data_namespace`, `product_data_namespace`, MongoDB namespace, object storage prefix, and `independent_database_ready`.

Data independence mode:

- Current mode: `shared-foundation-product-domain-partitioned`. The shared platform can keep tenant, dealer, store, user, audit, outbox, workflow, and identity foundations together, while product-domain records are partitioned by `product_module_id`, `product_data_namespace`, `module_namespace`, and `data_namespace`.
- Future mode: `standalone-database-extractable`. 瑞诺瓦 and Rysnova can be extracted by `product_data_namespace`, MongoDB namespace, API namespace, analytics namespace, and object-storage prefix into an independent PostgreSQL schema, MongoDB namespace, deployment, and domain.
- Standalone launch is not final until external domain/deploy evidence and database extraction proof exist. Local in-process standalone smoke only proves module composition.

Product module targets:

- 瑞诺瓦: `rysnova-consumer-system`, namespace `rysnova`, API `/api/v2/diagnosis`, storage prefix `rysnova/`, standalone aliases `/rysnova`, `/rysnova-ai`, `/rysnova-diagnosis`.
- Rysnova: `rysnova-bim-engineering-support`, namespace `rysnova-bim`, API `/api/v2/rysnova-bim`, storage prefix `rysnova-bim/`, standalone aliases `/rysnova-bim`, `/rysnova-bim-bim`, `/rysnova-bim-workbench`.
- Strategy: `namespace-extractable-shared-ledger`, meaning shared tenant/dealer/user/audit/outbox foundations can remain shared while product-domain data stays extractable by namespace, object storage prefix, and API owner.

Current production truth:

- Mongo/Mongoose compatibility trunk remains active.
- PostgreSQL/RLS/Temporal/Outbox remains target architecture until migrations are applied in staging and backed by contract/integration tests.
- `guard:database` verifies the current Mongo compatibility tenant scope.
- `guard:postgres-target-schema` verifies the future PostgreSQL ledger contract.

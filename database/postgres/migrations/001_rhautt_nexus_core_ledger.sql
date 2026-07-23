-- Rhautt Nexus / 瑞合数智枢纽 target PostgreSQL business ledger.
-- This migration is a target contract for the rewrite trunk; it is not yet production-applied.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE SCHEMA IF NOT EXISTS rhautt_nexus;

CREATE OR REPLACE FUNCTION rhautt_nexus.current_tenant_id()
RETURNS uuid
LANGUAGE sql
STABLE
AS $$
  SELECT NULLIF(current_setting('app.tenant_id', true), '')::uuid;
$$;

CREATE OR REPLACE FUNCTION rhautt_nexus.current_actor_id()
RETURNS uuid
LANGUAGE sql
STABLE
AS $$
  SELECT NULLIF(current_setting('app.actor_id', true), '')::uuid;
$$;

CREATE TABLE IF NOT EXISTS rhautt_nexus.tenants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  tenant_type text NOT NULL CHECK (tenant_type IN ('hq', 'regional', 'dealer_group')),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'archived')),
  settings jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS rhautt_nexus.dealers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES rhautt_nexus.tenants(id),
  code text NOT NULL,
  name text NOT NULL,
  province text,
  city text,
  status text NOT NULL DEFAULT 'active',
  contract_level text,
  contact jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, code)
);

CREATE TABLE IF NOT EXISTS rhautt_nexus.stores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES rhautt_nexus.tenants(id),
  dealer_id uuid NOT NULL REFERENCES rhautt_nexus.dealers(id),
  code text NOT NULL,
  name text NOT NULL,
  city text,
  address text,
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, dealer_id, code)
);

CREATE TABLE IF NOT EXISTS rhautt_nexus.users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES rhautt_nexus.tenants(id),
  dealer_id uuid REFERENCES rhautt_nexus.dealers(id),
  store_id uuid REFERENCES rhautt_nexus.stores(id),
  phone_hash text NOT NULL,
  phone_encrypted text NOT NULL,
  password_hash text NOT NULL,
  display_name text NOT NULL,
  role text NOT NULL,
  permissions jsonb NOT NULL DEFAULT '[]'::jsonb,
  status text NOT NULL DEFAULT 'active',
  last_login_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, phone_hash)
);

CREATE TABLE IF NOT EXISTS rhautt_nexus.product_modules (
  id text PRIMARY KEY,
  display_name text NOT NULL,
  module_kind text NOT NULL,
  module_namespace text NOT NULL UNIQUE,
  data_namespace text NOT NULL UNIQUE,
  api_namespace text NOT NULL,
  embedded_entry text NOT NULL,
  standalone_aliases text[] NOT NULL DEFAULT ARRAY[]::text[],
  embedded_in_rhautt_portal boolean NOT NULL DEFAULT true,
  standalone_launchable boolean NOT NULL DEFAULT true,
  current_deployment_mode text NOT NULL DEFAULT 'rhautt-portal-embedded',
  product_independence_level text NOT NULL DEFAULT 'portal-embedded-and-standalone-extractable',
  standalone_domain_strategy text NOT NULL DEFAULT 'dedicated-domain-or-subdomain-required',
  standalone_app_shell_mode text NOT NULL DEFAULT 'independent-product-app-shell',
  future_database_strategy text NOT NULL DEFAULT 'namespace-extractable-shared-ledger',
  current_data_mode text NOT NULL DEFAULT 'shared-foundation-product-domain-partitioned',
  future_data_mode text NOT NULL DEFAULT 'standalone-database-extractable',
  standalone_postgres_schema text NOT NULL DEFAULT 'rhautt_nexus',
  standalone_mongodb_database text NOT NULL DEFAULT 'rhautt_shared_documents',
  standalone_object_storage_bucket text NOT NULL DEFAULT 'rhautt-shared-platform-artifacts',
  future_standalone_product_ready boolean NOT NULL DEFAULT true,
  extraction_proof_required boolean NOT NULL DEFAULT true,
  extraction_plan text NOT NULL DEFAULT 'shared-foundation-no-standalone-extraction',
  object_storage_prefix text NOT NULL,
  analytics_namespace text NOT NULL,
  owned_by text NOT NULL,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'candidate', 'archived')),
  boundaries jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (current_deployment_mode IN ('rhautt-portal-embedded', 'standalone', 'shared-platform')),
  CHECK (array_length(standalone_aliases, 1) IS NOT NULL)
);

CREATE TABLE IF NOT EXISTS rhautt_nexus.product_module_deployments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_module_id text NOT NULL REFERENCES rhautt_nexus.product_modules(id),
  deployment_mode text NOT NULL CHECK (deployment_mode IN ('rhautt-portal-embedded', 'standalone', 'shared-platform')),
  route_base text NOT NULL,
  domain_hint text,
  target_app text NOT NULL,
  embedded_entry text NOT NULL,
  standalone_aliases text[] NOT NULL DEFAULT ARRAY[]::text[],
  launchable boolean NOT NULL DEFAULT true,
  external_domain_proof_required boolean NOT NULL DEFAULT true,
  standalone_app_shell_mode text NOT NULL DEFAULT 'independent-product-app-shell',
  standalone_domain_strategy text NOT NULL DEFAULT 'dedicated-domain-or-subdomain-required',
  standalone_domain_targets text[] NOT NULL DEFAULT ARRAY[]::text[],
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'candidate', 'archived')),
  boundaries jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (product_module_id, deployment_mode, route_base)
);

CREATE TABLE IF NOT EXISTS rhautt_nexus.product_module_data_partitions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_module_id text NOT NULL REFERENCES rhautt_nexus.product_modules(id),
  module_namespace text NOT NULL,
  data_namespace text NOT NULL,
  product_namespace text NOT NULL,
  product_data_namespace text NOT NULL,
  postgres_schema text NOT NULL DEFAULT 'rhautt_nexus',
  postgres_partition_key text NOT NULL,
  mongodb_namespace text NOT NULL,
  object_storage_prefix text NOT NULL,
  analytics_namespace text NOT NULL,
  extraction_strategy text NOT NULL DEFAULT 'namespace-extractable-shared-ledger',
  current_data_mode text NOT NULL DEFAULT 'shared-foundation-product-domain-partitioned',
  future_data_mode text NOT NULL DEFAULT 'standalone-database-extractable',
  product_independence_level text NOT NULL DEFAULT 'portal-embedded-and-standalone-extractable',
  standalone_domain_strategy text NOT NULL DEFAULT 'dedicated-domain-or-subdomain-required',
  standalone_app_shell_mode text NOT NULL DEFAULT 'independent-product-app-shell',
  standalone_postgres_schema text NOT NULL,
  standalone_mongodb_database text NOT NULL,
  standalone_object_storage_bucket text NOT NULL,
  standalone_database_target text NOT NULL,
  extraction_plan text NOT NULL,
  extraction_proof_required boolean NOT NULL DEFAULT true,
  future_standalone_product_ready boolean NOT NULL DEFAULT true,
  independent_database_ready boolean NOT NULL DEFAULT true,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'candidate', 'archived')),
  boundaries jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (product_module_id, data_namespace),
  UNIQUE (product_module_id, product_data_namespace)
);

INSERT INTO rhautt_nexus.product_modules (
  id,
  display_name,
  module_kind,
  module_namespace,
  data_namespace,
  api_namespace,
  embedded_entry,
  standalone_aliases,
  embedded_in_rhautt_portal,
  standalone_launchable,
  current_deployment_mode,
  product_independence_level,
  standalone_domain_strategy,
  standalone_app_shell_mode,
  future_database_strategy,
  current_data_mode,
  future_data_mode,
  standalone_postgres_schema,
  standalone_mongodb_database,
  standalone_object_storage_bucket,
  future_standalone_product_ready,
  extraction_proof_required,
  extraction_plan,
  object_storage_prefix,
  analytics_namespace,
  owned_by,
  boundaries
) VALUES
(
  'rhautt-shared-platform',
  'Rhautt shared platform',
  'shared-foundation',
  'rhautt-shared',
  'rhautt_shared',
  '/api/v2',
  '/staff-portal.html',
  ARRAY['/staff-portal.html']::text[],
  true,
  false,
  'shared-platform',
  'shared-platform-foundation',
  'not-standalone-product',
  'shared-platform-shell',
  'namespace-extractable-shared-ledger',
  'shared-foundation-product-domain-partitioned',
  'standalone-database-extractable',
  'rhautt_nexus',
  'rhautt_shared_documents',
  'rhautt-shared-platform-artifacts',
  false,
  false,
  'shared-foundation-no-standalone-extraction',
  'rhautt-shared/',
  'rhautt_shared',
  'platform-foundation-owner',
  '{"identity":"shared foundation","poweredBy":"Rhautt Nexus shared platform","iotBoundary":"lifecycle_handoff_only"}'::jsonb
),
(
  'rysnova-consumer-system',
  '瑞诺瓦',
  'consumer-comfort-system-brand',
  'rysnova',
  'rysnova',
  '/api/v2/diagnosis',
  '/pain-diagnosis.html',
  ARRAY['/rysnova', '/rysnova-ai', '/rysnova-diagnosis']::text[],
  true,
  true,
  'rhautt-portal-embedded',
  'portal-embedded-and-standalone-extractable',
  'dedicated-domain-or-subdomain-required',
  'independent-product-app-shell',
  'namespace-extractable-shared-ledger',
  'shared-foundation-product-domain-partitioned',
  'standalone-database-extractable',
  'rysnova',
  'rysnova_documents',
  'rysnova-product-artifacts',
  true,
  true,
  'extract-by-product_data_namespace-moduleNamespace-dataNamespace-objectStoragePrefix',
  'rysnova/',
  'rysnova',
  'consumer-diagnosis-product-owner',
  '{"identity":"independent product module","poweredBy":"Powered by Rhautt Comfort","iotBoundary":"lifecycle_handoff_only","currentDataMode":"shared-foundation-product-domain-partitioned","futureDataMode":"standalone-database-extractable","futureStandaloneProductReady":true}'::jsonb
),
(
  'rysnova-bim-engineering-support',
  'Rysnova',
  'engineering-bim-technical-support',
  'rysnova-bim',
  'rysnova-bim',
  '/api/v2/rysnova-bim',
  '/rysnova-bim-designer.html',
  ARRAY['/rysnova-bim', '/rysnova-bim-bim', '/rysnova-bim-workbench']::text[],
  true,
  true,
  'rhautt-portal-embedded',
  'portal-embedded-and-standalone-extractable',
  'dedicated-domain-or-subdomain-required',
  'independent-product-app-shell',
  'namespace-extractable-shared-ledger',
  'shared-foundation-product-domain-partitioned',
  'standalone-database-extractable',
  'rysnova-bim',
  'rysnova-bim_documents',
  'rysnova-bim-product-artifacts',
  true,
  true,
  'extract-by-data_namespace-moduleNamespace-objectStoragePrefix-artifactHashes',
  'rysnova-bim/',
  'rysnova-bim',
  'solution-design-rysnova-bim-director',
  '{"identity":"independent product module","poweredBy":"Powered by Rhautt Comfort","iotBoundary":"lifecycle_handoff_only","currentDataMode":"shared-foundation-product-domain-partitioned","futureDataMode":"standalone-database-extractable","futureStandaloneProductReady":true}'::jsonb
)
ON CONFLICT (id) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  module_kind = EXCLUDED.module_kind,
  module_namespace = EXCLUDED.module_namespace,
  data_namespace = EXCLUDED.data_namespace,
  api_namespace = EXCLUDED.api_namespace,
  embedded_entry = EXCLUDED.embedded_entry,
  standalone_aliases = EXCLUDED.standalone_aliases,
  embedded_in_rhautt_portal = EXCLUDED.embedded_in_rhautt_portal,
  standalone_launchable = EXCLUDED.standalone_launchable,
  current_deployment_mode = EXCLUDED.current_deployment_mode,
  product_independence_level = EXCLUDED.product_independence_level,
  standalone_domain_strategy = EXCLUDED.standalone_domain_strategy,
  standalone_app_shell_mode = EXCLUDED.standalone_app_shell_mode,
  future_database_strategy = EXCLUDED.future_database_strategy,
  current_data_mode = EXCLUDED.current_data_mode,
  future_data_mode = EXCLUDED.future_data_mode,
  standalone_postgres_schema = EXCLUDED.standalone_postgres_schema,
  standalone_mongodb_database = EXCLUDED.standalone_mongodb_database,
  standalone_object_storage_bucket = EXCLUDED.standalone_object_storage_bucket,
  future_standalone_product_ready = EXCLUDED.future_standalone_product_ready,
  extraction_proof_required = EXCLUDED.extraction_proof_required,
  extraction_plan = EXCLUDED.extraction_plan,
  object_storage_prefix = EXCLUDED.object_storage_prefix,
  analytics_namespace = EXCLUDED.analytics_namespace,
  owned_by = EXCLUDED.owned_by,
  boundaries = EXCLUDED.boundaries,
  updated_at = now();

INSERT INTO rhautt_nexus.product_module_deployments (
  product_module_id,
  deployment_mode,
  route_base,
  domain_hint,
  target_app,
  embedded_entry,
  standalone_aliases,
  launchable,
  external_domain_proof_required,
  standalone_app_shell_mode,
  standalone_domain_strategy,
  standalone_domain_targets,
  boundaries
) VALUES
(
  'rysnova-consumer-system',
  'rhautt-portal-embedded',
  '/pain-diagnosis.html',
  'rhautt-portal-embedded',
  'apps/consumer-diagnosis',
  '/pain-diagnosis.html',
  ARRAY['/rysnova', '/rysnova-ai', '/rysnova-diagnosis']::text[],
  true,
  false,
  'rhautt-portal-embedded-shell',
  'rhautt-portal-owned-route',
  ARRAY[]::text[],
  '{"portalIntegration":"Rhautt 官网可使用瑞诺瓦入口","standaloneProductization":"standalone proof still required","poweredBy":"Powered by Rhautt Comfort"}'::jsonb
),
(
  'rysnova-consumer-system',
  'standalone',
  '/',
  'standalone-domain-proof-required',
  'apps/consumer-diagnosis',
  '/pain-diagnosis.html',
  ARRAY['/rysnova', '/rysnova-ai', '/rysnova-diagnosis']::text[],
  true,
  true,
  'independent-product-app-shell',
  'dedicated-domain-or-subdomain-required',
  ARRAY['pending-dedicated-rysnova-domain-or-subdomain']::text[],
  '{"portalIntegration":"can still be linked from Rhautt portal","standaloneProductization":"independent domain/app shell required","poweredBy":"Powered by Rhautt Comfort"}'::jsonb
),
(
  'rysnova-bim-engineering-support',
  'rhautt-portal-embedded',
  '/rysnova-bim-designer.html',
  'rhautt-portal-embedded',
  'apps/rysnova-bim-workbench',
  '/rysnova-bim-designer.html',
  ARRAY['/rysnova-bim', '/rysnova-bim-bim', '/rysnova-bim-workbench']::text[],
  true,
  false,
  'rhautt-portal-embedded-shell',
  'rhautt-portal-owned-route',
  ARRAY[]::text[],
  '{"portalIntegration":"Rhautt 官网和员工入口可使用 Rysnova","standaloneProductization":"standalone proof still required","poweredBy":"Powered by Rhautt Comfort"}'::jsonb
),
(
  'rysnova-bim-engineering-support',
  'standalone',
  '/',
  'standalone-domain-proof-required',
  'apps/rysnova-bim-workbench',
  '/rysnova-bim-designer.html',
  ARRAY['/rysnova-bim', '/rysnova-bim-bim', '/rysnova-bim-workbench']::text[],
  true,
  true,
  'independent-product-app-shell',
  'dedicated-domain-or-subdomain-required',
  ARRAY['pending-dedicated-rysnova-bim-domain-or-subdomain']::text[],
  '{"portalIntegration":"can still be linked from Rhautt portal","standaloneProductization":"independent domain/app shell required","poweredBy":"Powered by Rhautt Comfort"}'::jsonb
)
ON CONFLICT (product_module_id, deployment_mode, route_base) DO UPDATE SET
  domain_hint = EXCLUDED.domain_hint,
  target_app = EXCLUDED.target_app,
  embedded_entry = EXCLUDED.embedded_entry,
  standalone_aliases = EXCLUDED.standalone_aliases,
  launchable = EXCLUDED.launchable,
  external_domain_proof_required = EXCLUDED.external_domain_proof_required,
  standalone_app_shell_mode = EXCLUDED.standalone_app_shell_mode,
  standalone_domain_strategy = EXCLUDED.standalone_domain_strategy,
  standalone_domain_targets = EXCLUDED.standalone_domain_targets,
  boundaries = EXCLUDED.boundaries,
  updated_at = now();

INSERT INTO rhautt_nexus.product_module_data_partitions (
  product_module_id,
  module_namespace,
  data_namespace,
  product_namespace,
  product_data_namespace,
  postgres_partition_key,
  mongodb_namespace,
  object_storage_prefix,
  analytics_namespace,
  extraction_strategy,
  current_data_mode,
  future_data_mode,
  product_independence_level,
  standalone_domain_strategy,
  standalone_app_shell_mode,
  standalone_postgres_schema,
  standalone_mongodb_database,
  standalone_object_storage_bucket,
  standalone_database_target,
  extraction_plan,
  extraction_proof_required,
  future_standalone_product_ready,
  independent_database_ready,
  boundaries
) VALUES
(
  'rysnova-consumer-system',
  'rysnova',
  'rysnova',
  'rysnova',
  'rysnova',
  'product_data_namespace',
  'DiagnosisReport.moduleNamespace=rysnova',
  'rysnova/',
  'rysnova',
  'namespace-extractable-shared-ledger',
  'shared-foundation-product-domain-partitioned',
  'standalone-database-extractable',
  'portal-embedded-and-standalone-extractable',
  'dedicated-domain-or-subdomain-required',
  'independent-product-app-shell',
  'rysnova',
  'rysnova_documents',
  'rysnova-product-artifacts',
  'rysnova-owned-postgres-schema-plus-mongodb-namespace',
  'extract-by-product_data_namespace-moduleNamespace-dataNamespace-objectStoragePrefix',
  true,
  true,
  true,
  '{"primaryDocuments":["DiagnosisReport"],"sharedRecords":["CustomerV2","Opportunity","QuotationV2"],"sharedFoundation":["tenants","dealers","stores","users","audit_logs","outbox_events","workflow_instances","workflow_steps"],"futureExtraction":"can move by product_data_namespace, mongodb_namespace and object_storage_prefix"}'::jsonb
),
(
  'rysnova-bim-engineering-support',
  'rysnova-bim',
  'rysnova-bim',
  'rysnova-bim',
  'rysnova-bim',
  'product_data_namespace',
  'RysnovaArtifact.moduleNamespace=rysnova-bim',
  'rysnova-bim/',
  'rysnova-bim',
  'namespace-extractable-shared-ledger',
  'shared-foundation-product-domain-partitioned',
  'standalone-database-extractable',
  'portal-embedded-and-standalone-extractable',
  'dedicated-domain-or-subdomain-required',
  'independent-product-app-shell',
  'rysnova-bim',
  'rysnova-bim_documents',
  'rysnova-bim-product-artifacts',
  'rysnova-bim-owned-postgres-schema-plus-mongodb-namespace',
  'extract-by-data_namespace-moduleNamespace-objectStoragePrefix-artifactHashes',
  true,
  true,
  true,
  '{"primaryDocuments":["RysnovaArtifact"],"sharedRecords":["QuotationV2"],"sharedFoundation":["tenants","dealers","stores","users","audit_logs","outbox_events","workflow_instances","workflow_steps"],"futureExtraction":"can move by data_namespace, mongodb_namespace and object_storage_prefix"}'::jsonb
)
ON CONFLICT (product_module_id, data_namespace) DO UPDATE SET
  module_namespace = EXCLUDED.module_namespace,
  product_namespace = EXCLUDED.product_namespace,
  product_data_namespace = EXCLUDED.product_data_namespace,
  postgres_partition_key = EXCLUDED.postgres_partition_key,
  mongodb_namespace = EXCLUDED.mongodb_namespace,
  object_storage_prefix = EXCLUDED.object_storage_prefix,
  analytics_namespace = EXCLUDED.analytics_namespace,
  extraction_strategy = EXCLUDED.extraction_strategy,
  current_data_mode = EXCLUDED.current_data_mode,
  future_data_mode = EXCLUDED.future_data_mode,
  product_independence_level = EXCLUDED.product_independence_level,
  standalone_domain_strategy = EXCLUDED.standalone_domain_strategy,
  standalone_app_shell_mode = EXCLUDED.standalone_app_shell_mode,
  standalone_postgres_schema = EXCLUDED.standalone_postgres_schema,
  standalone_mongodb_database = EXCLUDED.standalone_mongodb_database,
  standalone_object_storage_bucket = EXCLUDED.standalone_object_storage_bucket,
  standalone_database_target = EXCLUDED.standalone_database_target,
  extraction_plan = EXCLUDED.extraction_plan,
  extraction_proof_required = EXCLUDED.extraction_proof_required,
  future_standalone_product_ready = EXCLUDED.future_standalone_product_ready,
  independent_database_ready = EXCLUDED.independent_database_ready,
  boundaries = EXCLUDED.boundaries,
  updated_at = now();

CREATE TABLE IF NOT EXISTS rhautt_nexus.customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES rhautt_nexus.tenants(id),
  dealer_id uuid REFERENCES rhautt_nexus.dealers(id),
  store_id uuid REFERENCES rhautt_nexus.stores(id),
  owner_user_id uuid REFERENCES rhautt_nexus.users(id),
  phone_hash text NOT NULL,
  phone_encrypted text NOT NULL,
  name text,
  city text,
  address text,
  source text,
  product_module_id text NOT NULL DEFAULT 'rhautt-shared-platform' REFERENCES rhautt_nexus.product_modules(id),
  product_deployment_mode text NOT NULL DEFAULT 'shared-platform',
  product_namespace text NOT NULL DEFAULT 'rhautt-shared',
  product_data_namespace text NOT NULL DEFAULT 'rhautt_shared',
  tags text[] NOT NULL DEFAULT ARRAY[]::text[],
  profile jsonb NOT NULL DEFAULT '{}'::jsonb,
  last_interaction_at timestamptz,
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, phone_hash)
);

CREATE TABLE IF NOT EXISTS rhautt_nexus.opportunities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES rhautt_nexus.tenants(id),
  customer_id uuid NOT NULL REFERENCES rhautt_nexus.customers(id),
  owner_user_id uuid REFERENCES rhautt_nexus.users(id),
  store_id uuid REFERENCES rhautt_nexus.stores(id),
  product_module_id text NOT NULL DEFAULT 'rhautt-shared-platform' REFERENCES rhautt_nexus.product_modules(id),
  product_deployment_mode text NOT NULL DEFAULT 'shared-platform',
  product_namespace text NOT NULL DEFAULT 'rhautt-shared',
  product_data_namespace text NOT NULL DEFAULT 'rhautt_shared',
  stage text NOT NULL DEFAULT 'lead-created',
  source text,
  estimated_budget numeric(14, 2),
  probability numeric(5, 2),
  diagnosis_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS rhautt_nexus.quotations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES rhautt_nexus.tenants(id),
  customer_id uuid NOT NULL REFERENCES rhautt_nexus.customers(id),
  opportunity_id uuid REFERENCES rhautt_nexus.opportunities(id),
  dealer_id uuid REFERENCES rhautt_nexus.dealers(id),
  store_id uuid REFERENCES rhautt_nexus.stores(id),
  quotation_no text NOT NULL,
  version integer NOT NULL DEFAULT 1,
  status text NOT NULL DEFAULT 'draft',
  product_module_id text NOT NULL DEFAULT 'rhautt-shared-platform' REFERENCES rhautt_nexus.product_modules(id),
  product_deployment_mode text NOT NULL DEFAULT 'shared-platform',
  product_namespace text NOT NULL DEFAULT 'rhautt-shared',
  product_data_namespace text NOT NULL DEFAULT 'rhautt_shared',
  currency text NOT NULL DEFAULT 'CNY',
  bom jsonb NOT NULL DEFAULT '[]'::jsonb,
  cost_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  price_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  margin_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  approval_state jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid REFERENCES rhautt_nexus.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, quotation_no, version)
);

CREATE TABLE IF NOT EXISTS rhautt_nexus.contracts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES rhautt_nexus.tenants(id),
  customer_id uuid NOT NULL REFERENCES rhautt_nexus.customers(id),
  quotation_id uuid REFERENCES rhautt_nexus.quotations(id),
  contract_no text NOT NULL,
  status text NOT NULL DEFAULT 'draft',
  signed_at timestamptz,
  total_amount numeric(14, 2),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, contract_no)
);

CREATE TABLE IF NOT EXISTS rhautt_nexus.project_lifecycle (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES rhautt_nexus.tenants(id),
  customer_id uuid NOT NULL REFERENCES rhautt_nexus.customers(id),
  contract_id uuid REFERENCES rhautt_nexus.contracts(id),
  opportunity_id uuid REFERENCES rhautt_nexus.opportunities(id),
  quotation_id uuid REFERENCES rhautt_nexus.quotations(id),
  lifecycle_stage text NOT NULL DEFAULT 'contracted',
  project_state text NOT NULL DEFAULT 'solution-drafted',
  handoff_status text NOT NULL DEFAULT 'not-ready',
  installed_assets jsonb NOT NULL DEFAULT '[]'::jsonb,
  service_plan jsonb NOT NULL DEFAULT '{}'::jsonb,
  iot jsonb NOT NULL DEFAULT '{"boundary":"lifecycle_handoff_only"}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS rhautt_nexus.file_artifacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES rhautt_nexus.tenants(id),
  project_id uuid,
  customer_id uuid REFERENCES rhautt_nexus.customers(id),
  module_id text NOT NULL DEFAULT 'rhautt-shared-platform' REFERENCES rhautt_nexus.product_modules(id),
  module_deployment_mode text NOT NULL DEFAULT 'shared-platform',
  module_namespace text NOT NULL DEFAULT 'rhautt-shared',
  data_namespace text NOT NULL DEFAULT 'rhautt_shared',
  artifact_type text NOT NULL CHECK (artifact_type IN (
    'concept-effect-view',
    'principle-diagram',
    'construction-drawing',
    'bim-model',
    'bom',
    'quantity-takeoff',
    'standards-check',
    'customer-report'
  )),
  artifact_status text NOT NULL DEFAULT 'draft' CHECK (artifact_status IN ('draft', 'reviewing', 'approved', 'shared', 'superseded', 'archived')),
  object_key text NOT NULL,
  content_hash text NOT NULL,
  inputs_hash text,
  version integer NOT NULL DEFAULT 1,
  visibility text NOT NULL DEFAULT 'internal' CHECK (visibility IN ('internal', 'dealer', 'customer')),
  customer_visible boolean NOT NULL DEFAULT false,
  storage_provider text,
  storage_integrity_passed boolean NOT NULL DEFAULT false,
  storage_integrity_checked_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid REFERENCES rhautt_nexus.users(id),
  approved_by uuid REFERENCES rhautt_nexus.users(id),
  approved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (customer_visible = false OR artifact_status IN ('approved', 'shared')),
  CHECK (storage_integrity_passed = false OR storage_integrity_checked_at IS NOT NULL),
  UNIQUE (tenant_id, object_key)
);

CREATE TABLE IF NOT EXISTS rhautt_nexus.audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES rhautt_nexus.tenants(id),
  actor_user_id uuid,
  action text NOT NULL,
  resource_type text NOT NULL,
  resource_id text,
  before_state jsonb,
  after_state jsonb,
  request_id text,
  trace_id text,
  ip_hash text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS rhautt_nexus.outbox_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES rhautt_nexus.tenants(id),
  aggregate_type text NOT NULL,
  aggregate_id uuid NOT NULL,
  event_type text NOT NULL,
  payload jsonb NOT NULL,
  idempotency_key text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'delivering', 'delivered', 'dead_letter')),
  available_at timestamptz NOT NULL DEFAULT now(),
  attempts integer NOT NULL DEFAULT 0,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, idempotency_key)
);

CREATE TABLE IF NOT EXISTS rhautt_nexus.workflow_instances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES rhautt_nexus.tenants(id),
  workflow_type text NOT NULL,
  temporal_workflow_id text NOT NULL,
  aggregate_type text NOT NULL,
  aggregate_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'running',
  input jsonb NOT NULL DEFAULT '{}'::jsonb,
  state jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, temporal_workflow_id)
);

CREATE TABLE IF NOT EXISTS rhautt_nexus.workflow_steps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES rhautt_nexus.tenants(id),
  workflow_instance_id uuid NOT NULL REFERENCES rhautt_nexus.workflow_instances(id),
  step_type text NOT NULL,
  status text NOT NULL DEFAULT 'scheduled',
  attempt integer NOT NULL DEFAULT 0,
  input jsonb NOT NULL DEFAULT '{}'::jsonb,
  output jsonb,
  error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  scheduled_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);

CREATE INDEX IF NOT EXISTS dealers_tenant_status_idx ON rhautt_nexus.dealers (tenant_id, status);
CREATE INDEX IF NOT EXISTS stores_tenant_dealer_status_idx ON rhautt_nexus.stores (tenant_id, dealer_id, status);
CREATE INDEX IF NOT EXISTS users_tenant_role_status_idx ON rhautt_nexus.users (tenant_id, dealer_id, role, status);
CREATE INDEX IF NOT EXISTS product_modules_namespace_idx ON rhautt_nexus.product_modules (module_namespace, data_namespace, status);
CREATE INDEX IF NOT EXISTS product_modules_launch_idx ON rhautt_nexus.product_modules (standalone_launchable, current_deployment_mode, status);
CREATE INDEX IF NOT EXISTS product_module_deployments_launch_idx ON rhautt_nexus.product_module_deployments (product_module_id, deployment_mode, launchable, status);
CREATE INDEX IF NOT EXISTS product_module_data_partitions_extract_idx ON rhautt_nexus.product_module_data_partitions (product_module_id, data_namespace, extraction_strategy, independent_database_ready);
CREATE INDEX IF NOT EXISTS customers_tenant_owner_status_idx ON rhautt_nexus.customers (tenant_id, owner_user_id, status, updated_at DESC);
CREATE INDEX IF NOT EXISTS customers_tenant_product_namespace_idx ON rhautt_nexus.customers (tenant_id, product_data_namespace, product_deployment_mode, updated_at DESC);
CREATE INDEX IF NOT EXISTS opportunities_tenant_stage_idx ON rhautt_nexus.opportunities (tenant_id, owner_user_id, stage, updated_at DESC);
CREATE INDEX IF NOT EXISTS opportunities_tenant_product_namespace_idx ON rhautt_nexus.opportunities (tenant_id, product_data_namespace, product_deployment_mode, updated_at DESC);
CREATE INDEX IF NOT EXISTS quotations_tenant_customer_status_idx ON rhautt_nexus.quotations (tenant_id, customer_id, status, updated_at DESC);
CREATE INDEX IF NOT EXISTS quotations_tenant_product_namespace_idx ON rhautt_nexus.quotations (tenant_id, product_data_namespace, product_deployment_mode, updated_at DESC);
CREATE INDEX IF NOT EXISTS contracts_tenant_customer_status_idx ON rhautt_nexus.contracts (tenant_id, customer_id, status, updated_at DESC);
CREATE INDEX IF NOT EXISTS lifecycle_tenant_customer_stage_idx ON rhautt_nexus.project_lifecycle (tenant_id, customer_id, lifecycle_stage, updated_at DESC);
CREATE INDEX IF NOT EXISTS artifacts_tenant_project_type_idx ON rhautt_nexus.file_artifacts (tenant_id, project_id, artifact_type, version DESC);
CREATE INDEX IF NOT EXISTS artifacts_tenant_data_namespace_idx ON rhautt_nexus.file_artifacts (tenant_id, data_namespace, module_deployment_mode, updated_at DESC);
CREATE INDEX IF NOT EXISTS artifacts_tenant_customer_package_idx ON rhautt_nexus.file_artifacts (tenant_id, data_namespace, customer_id, project_id, customer_visible, artifact_status, updated_at DESC);
CREATE INDEX IF NOT EXISTS artifacts_tenant_customer_signoff_idx ON rhautt_nexus.file_artifacts (tenant_id, data_namespace, project_id, customer_id, artifact_type, customer_visible, artifact_status, storage_integrity_passed);
CREATE INDEX IF NOT EXISTS artifacts_tenant_storage_integrity_idx ON rhautt_nexus.file_artifacts (tenant_id, data_namespace, storage_integrity_passed, updated_at DESC);
CREATE INDEX IF NOT EXISTS audit_tenant_resource_idx ON rhautt_nexus.audit_logs (tenant_id, resource_type, resource_id, created_at DESC);
CREATE INDEX IF NOT EXISTS outbox_delivery_idx ON rhautt_nexus.outbox_events (status, available_at, attempts);
CREATE INDEX IF NOT EXISTS workflow_tenant_status_idx ON rhautt_nexus.workflow_instances (tenant_id, workflow_type, status, updated_at DESC);

ALTER TABLE rhautt_nexus.dealers ENABLE ROW LEVEL SECURITY;
ALTER TABLE rhautt_nexus.stores ENABLE ROW LEVEL SECURITY;
ALTER TABLE rhautt_nexus.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE rhautt_nexus.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE rhautt_nexus.opportunities ENABLE ROW LEVEL SECURITY;
ALTER TABLE rhautt_nexus.quotations ENABLE ROW LEVEL SECURITY;
ALTER TABLE rhautt_nexus.contracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE rhautt_nexus.project_lifecycle ENABLE ROW LEVEL SECURITY;
ALTER TABLE rhautt_nexus.file_artifacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE rhautt_nexus.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE rhautt_nexus.outbox_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE rhautt_nexus.workflow_instances ENABLE ROW LEVEL SECURITY;
ALTER TABLE rhautt_nexus.workflow_steps ENABLE ROW LEVEL SECURITY;

ALTER TABLE rhautt_nexus.dealers FORCE ROW LEVEL SECURITY;
ALTER TABLE rhautt_nexus.stores FORCE ROW LEVEL SECURITY;
ALTER TABLE rhautt_nexus.users FORCE ROW LEVEL SECURITY;
ALTER TABLE rhautt_nexus.customers FORCE ROW LEVEL SECURITY;
ALTER TABLE rhautt_nexus.opportunities FORCE ROW LEVEL SECURITY;
ALTER TABLE rhautt_nexus.quotations FORCE ROW LEVEL SECURITY;
ALTER TABLE rhautt_nexus.contracts FORCE ROW LEVEL SECURITY;
ALTER TABLE rhautt_nexus.project_lifecycle FORCE ROW LEVEL SECURITY;
ALTER TABLE rhautt_nexus.file_artifacts FORCE ROW LEVEL SECURITY;
ALTER TABLE rhautt_nexus.audit_logs FORCE ROW LEVEL SECURITY;
ALTER TABLE rhautt_nexus.outbox_events FORCE ROW LEVEL SECURITY;
ALTER TABLE rhautt_nexus.workflow_instances FORCE ROW LEVEL SECURITY;
ALTER TABLE rhautt_nexus.workflow_steps FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS dealers_tenant_isolation ON rhautt_nexus.dealers;
CREATE POLICY dealers_tenant_isolation ON rhautt_nexus.dealers
  USING (tenant_id = rhautt_nexus.current_tenant_id())
  WITH CHECK (tenant_id = rhautt_nexus.current_tenant_id());
DROP POLICY IF EXISTS stores_tenant_isolation ON rhautt_nexus.stores;
CREATE POLICY stores_tenant_isolation ON rhautt_nexus.stores
  USING (tenant_id = rhautt_nexus.current_tenant_id())
  WITH CHECK (tenant_id = rhautt_nexus.current_tenant_id());
DROP POLICY IF EXISTS users_tenant_isolation ON rhautt_nexus.users;
CREATE POLICY users_tenant_isolation ON rhautt_nexus.users
  USING (tenant_id = rhautt_nexus.current_tenant_id())
  WITH CHECK (tenant_id = rhautt_nexus.current_tenant_id());
DROP POLICY IF EXISTS customers_tenant_isolation ON rhautt_nexus.customers;
CREATE POLICY customers_tenant_isolation ON rhautt_nexus.customers
  USING (tenant_id = rhautt_nexus.current_tenant_id())
  WITH CHECK (tenant_id = rhautt_nexus.current_tenant_id());
DROP POLICY IF EXISTS opportunities_tenant_isolation ON rhautt_nexus.opportunities;
CREATE POLICY opportunities_tenant_isolation ON rhautt_nexus.opportunities
  USING (tenant_id = rhautt_nexus.current_tenant_id())
  WITH CHECK (tenant_id = rhautt_nexus.current_tenant_id());
DROP POLICY IF EXISTS quotations_tenant_isolation ON rhautt_nexus.quotations;
CREATE POLICY quotations_tenant_isolation ON rhautt_nexus.quotations
  USING (tenant_id = rhautt_nexus.current_tenant_id())
  WITH CHECK (tenant_id = rhautt_nexus.current_tenant_id());
DROP POLICY IF EXISTS contracts_tenant_isolation ON rhautt_nexus.contracts;
CREATE POLICY contracts_tenant_isolation ON rhautt_nexus.contracts
  USING (tenant_id = rhautt_nexus.current_tenant_id())
  WITH CHECK (tenant_id = rhautt_nexus.current_tenant_id());
DROP POLICY IF EXISTS lifecycle_tenant_isolation ON rhautt_nexus.project_lifecycle;
CREATE POLICY lifecycle_tenant_isolation ON rhautt_nexus.project_lifecycle
  USING (tenant_id = rhautt_nexus.current_tenant_id())
  WITH CHECK (tenant_id = rhautt_nexus.current_tenant_id());
DROP POLICY IF EXISTS file_artifacts_tenant_isolation ON rhautt_nexus.file_artifacts;
CREATE POLICY file_artifacts_tenant_isolation ON rhautt_nexus.file_artifacts
  USING (tenant_id = rhautt_nexus.current_tenant_id())
  WITH CHECK (tenant_id = rhautt_nexus.current_tenant_id());
DROP POLICY IF EXISTS audit_logs_tenant_isolation ON rhautt_nexus.audit_logs;
CREATE POLICY audit_logs_tenant_isolation ON rhautt_nexus.audit_logs
  USING (tenant_id = rhautt_nexus.current_tenant_id())
  WITH CHECK (tenant_id = rhautt_nexus.current_tenant_id());
DROP POLICY IF EXISTS outbox_events_tenant_isolation ON rhautt_nexus.outbox_events;
CREATE POLICY outbox_events_tenant_isolation ON rhautt_nexus.outbox_events
  USING (tenant_id = rhautt_nexus.current_tenant_id())
  WITH CHECK (tenant_id = rhautt_nexus.current_tenant_id());
DROP POLICY IF EXISTS workflow_instances_tenant_isolation ON rhautt_nexus.workflow_instances;
CREATE POLICY workflow_instances_tenant_isolation ON rhautt_nexus.workflow_instances
  USING (tenant_id = rhautt_nexus.current_tenant_id())
  WITH CHECK (tenant_id = rhautt_nexus.current_tenant_id());
DROP POLICY IF EXISTS workflow_steps_tenant_isolation ON rhautt_nexus.workflow_steps;
CREATE POLICY workflow_steps_tenant_isolation ON rhautt_nexus.workflow_steps
  USING (tenant_id = rhautt_nexus.current_tenant_id())
  WITH CHECK (tenant_id = rhautt_nexus.current_tenant_id());

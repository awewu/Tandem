-- Complete the existing file-artifact persistence contract.

CREATE TABLE IF NOT EXISTS rhautt_nexus.object_storage_evidence (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES rhautt_nexus.tenants(id),
  dealer_id varchar,
  actor_id varchar,
  entity_type text NOT NULL,
  entity_id text NOT NULL,
  file_key text NOT NULL,
  original_name varchar,
  operation varchar(20) NOT NULL CHECK (operation IN ('upload', 'download', 'migrate', 'verify')),
  size_bytes bigint NOT NULL DEFAULT 0,
  source_hash varchar(64),
  destination_hash varchar(64),
  pulled_hash varchar(64),
  storage_provider varchar(32),
  storage_region varchar(32),
  storage_url text,
  meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS object_storage_evidence_tenant_entity_idx
  ON rhautt_nexus.object_storage_evidence (tenant_id, entity_type, entity_id, created_at DESC);
CREATE INDEX IF NOT EXISTS object_storage_evidence_tenant_file_idx
  ON rhautt_nexus.object_storage_evidence (tenant_id, file_key, created_at DESC);

ALTER TABLE rhautt_nexus.object_storage_evidence ENABLE ROW LEVEL SECURITY;
ALTER TABLE rhautt_nexus.object_storage_evidence FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS object_storage_evidence_tenant_isolation ON rhautt_nexus.object_storage_evidence;
CREATE POLICY object_storage_evidence_tenant_isolation ON rhautt_nexus.object_storage_evidence
  USING (tenant_id = rhautt_nexus.current_tenant_id())
  WITH CHECK (tenant_id = rhautt_nexus.current_tenant_id());

SET search_path TO rhautt_nexus, public;

CREATE TABLE IF NOT EXISTS rhautt_nexus.auth_external_identity_bindings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text NOT NULL,
  issuer text NOT NULL,
  external_subject text NOT NULL,
  tenant_id uuid REFERENCES rhautt_nexus.tenants(id),
  local_user_id uuid REFERENCES rhautt_nexus.users(id),
  status text NOT NULL DEFAULT 'pending_authorization',
  first_login_at timestamptz NOT NULL DEFAULT now(),
  last_login_at timestamptz,
  last_seen_profile jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT auth_external_identity_status_chk
    CHECK (status IN ('active', 'inactive', 'disabled', 'pending_authorization')),
  CONSTRAINT auth_external_identity_active_local_user_chk
    CHECK (status <> 'active' OR (tenant_id IS NOT NULL AND local_user_id IS NOT NULL)),
  UNIQUE (provider, issuer, external_subject)
);

CREATE INDEX IF NOT EXISTS auth_external_identity_tenant_status_idx
  ON rhautt_nexus.auth_external_identity_bindings (tenant_id, status);

CREATE INDEX IF NOT EXISTS auth_external_identity_user_status_idx
  ON rhautt_nexus.auth_external_identity_bindings (local_user_id, status);

CREATE INDEX IF NOT EXISTS auth_external_identity_last_login_idx
  ON rhautt_nexus.auth_external_identity_bindings (provider, issuer, last_login_at DESC);

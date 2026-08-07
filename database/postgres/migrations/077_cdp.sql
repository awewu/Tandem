-- 077 · CDP 客户数据平台（模块2 地基）
-- AI GTM Nexus Phase 0：终端用户统一档案 / 分群 / PIPL 同意台账。
-- PII 以 compliance.pii 加密列存放（*_enc）；检索用哈希（phone_hash）。tenant_id + FORCE RLS。

SET search_path TO rhautt_nexus, public;

CREATE TABLE IF NOT EXISTS rhautt_nexus.cdp_end_user_profile (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES rhautt_nexus.tenants(id),
  external_ref text,                      -- 跨源统一标识（打通用）
  name_enc text,
  phone_hash text,                        -- 检索哈希（compliance.pii.hashPII）
  phone_enc text,
  email_enc text,
  attributes jsonb NOT NULL DEFAULT '{}'::jsonb,   -- 画像属性（房型/意向/来源渠道…）
  segment_codes text[] NOT NULL DEFAULT ARRAY[]::text[],
  consent_status text NOT NULL DEFAULT 'unknown'
    CHECK (consent_status IN ('unknown', 'granted', 'revoked')),
  source text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, phone_hash)
);
CREATE INDEX IF NOT EXISTS cdp_profile_tenant_idx ON rhautt_nexus.cdp_end_user_profile (tenant_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS rhautt_nexus.cdp_segment (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES rhautt_nexus.tenants(id),
  code text NOT NULL,
  name text NOT NULL,
  rule jsonb NOT NULL DEFAULT '{}'::jsonb,
  member_count integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, code)
);

CREATE TABLE IF NOT EXISTS rhautt_nexus.cdp_consent_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES rhautt_nexus.tenants(id),
  profile_id uuid NOT NULL REFERENCES rhautt_nexus.cdp_end_user_profile(id) ON DELETE CASCADE,
  purpose text NOT NULL,
  granted boolean NOT NULL,
  channel text,
  evidence text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS cdp_consent_profile_idx ON rhautt_nexus.cdp_consent_ledger (tenant_id, profile_id, created_at DESC);

ALTER TABLE rhautt_nexus.cdp_end_user_profile ENABLE ROW LEVEL SECURITY;
ALTER TABLE rhautt_nexus.cdp_segment ENABLE ROW LEVEL SECURITY;
ALTER TABLE rhautt_nexus.cdp_consent_ledger ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS cdp_profile_tenant_isolation ON rhautt_nexus.cdp_end_user_profile;
CREATE POLICY cdp_profile_tenant_isolation ON rhautt_nexus.cdp_end_user_profile
  USING (tenant_id = rhautt_nexus.current_tenant_id())
  WITH CHECK (tenant_id = rhautt_nexus.current_tenant_id());

DROP POLICY IF EXISTS cdp_segment_tenant_isolation ON rhautt_nexus.cdp_segment;
CREATE POLICY cdp_segment_tenant_isolation ON rhautt_nexus.cdp_segment
  USING (tenant_id = rhautt_nexus.current_tenant_id())
  WITH CHECK (tenant_id = rhautt_nexus.current_tenant_id());

DROP POLICY IF EXISTS cdp_consent_tenant_isolation ON rhautt_nexus.cdp_consent_ledger;
CREATE POLICY cdp_consent_tenant_isolation ON rhautt_nexus.cdp_consent_ledger
  USING (tenant_id = rhautt_nexus.current_tenant_id())
  WITH CHECK (tenant_id = rhautt_nexus.current_tenant_id());

ALTER TABLE rhautt_nexus.cdp_end_user_profile FORCE ROW LEVEL SECURITY;
ALTER TABLE rhautt_nexus.cdp_segment FORCE ROW LEVEL SECURITY;
ALTER TABLE rhautt_nexus.cdp_consent_ledger FORCE ROW LEVEL SECURITY;

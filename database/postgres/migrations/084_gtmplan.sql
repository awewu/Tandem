-- 084 · 战役/预算 MROI（模块7）+ OKR（模块10）
-- AI GTM Nexus Phase 2/3：营销战役预算与投产比(MROI) + 集团→事业部→职能 三级 OKR。
-- 喂 CMO 驾驶舱 mroi / teamOkr 屏。

SET search_path TO rhautt_nexus, public;

CREATE TABLE IF NOT EXISTS rhautt_nexus.gtm_campaign (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES rhautt_nexus.tenants(id),
  name text NOT NULL,
  bu_type text,                         -- group / brand / category
  bu_ref text,
  period text,
  budget numeric NOT NULL DEFAULT 0,
  spend numeric NOT NULL DEFAULT 0,
  attributed_revenue numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'planned'
    CHECK (status IN ('planned', 'running', 'completed', 'cancelled')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS gtm_campaign_idx ON rhautt_nexus.gtm_campaign (tenant_id, status, period);

CREATE TABLE IF NOT EXISTS rhautt_nexus.gtm_okr (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES rhautt_nexus.tenants(id),
  level text NOT NULL CHECK (level IN ('group', 'business_unit', 'function')),
  owner text,
  bu_ref text,
  objective text NOT NULL,
  key_results jsonb NOT NULL DEFAULT '[]'::jsonb,   -- [{kr, target, current}]
  progress numeric NOT NULL DEFAULT 0,               -- 0..1
  period text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS gtm_okr_idx ON rhautt_nexus.gtm_okr (tenant_id, level, period);

ALTER TABLE rhautt_nexus.gtm_campaign ENABLE ROW LEVEL SECURITY;
ALTER TABLE rhautt_nexus.gtm_okr ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS gtm_campaign_tenant_isolation ON rhautt_nexus.gtm_campaign;
CREATE POLICY gtm_campaign_tenant_isolation ON rhautt_nexus.gtm_campaign
  USING (tenant_id = rhautt_nexus.current_tenant_id()) WITH CHECK (tenant_id = rhautt_nexus.current_tenant_id());
DROP POLICY IF EXISTS gtm_okr_tenant_isolation ON rhautt_nexus.gtm_okr;
CREATE POLICY gtm_okr_tenant_isolation ON rhautt_nexus.gtm_okr
  USING (tenant_id = rhautt_nexus.current_tenant_id()) WITH CHECK (tenant_id = rhautt_nexus.current_tenant_id());

ALTER TABLE rhautt_nexus.gtm_campaign FORCE ROW LEVEL SECURITY;
ALTER TABLE rhautt_nexus.gtm_okr FORCE ROW LEVEL SECURITY;

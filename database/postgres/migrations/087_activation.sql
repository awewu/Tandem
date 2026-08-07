-- 087 · 活动运营（模块5）：优惠券/拼团/秒杀/裂变/转介绍 促销活动 + 参与记录
-- AI GTM Nexus Phase 3：品牌侧活动运营（非会员金融）。裂变/转介绍护线索飞轮。

SET search_path TO rhautt_nexus, public;

CREATE TABLE IF NOT EXISTS rhautt_nexus.activation_activity (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES rhautt_nexus.tenants(id),
  brand_code text,
  category text,
  type text NOT NULL CHECK (type IN ('coupon', 'groupon', 'flashsale', 'fission', 'referral')),
  name text NOT NULL,
  rules jsonb NOT NULL DEFAULT '{}'::jsonb,
  budget numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'running', 'paused', 'ended')),
  period_start date,
  period_end date,
  metrics jsonb NOT NULL DEFAULT '{}'::jsonb,     -- 参与/核销/带来线索 汇总
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS activation_activity_idx ON rhautt_nexus.activation_activity (tenant_id, status, type);

CREATE TABLE IF NOT EXISTS rhautt_nexus.activation_participation (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES rhautt_nexus.tenants(id),
  activity_id uuid REFERENCES rhautt_nexus.activation_activity(id) ON DELETE CASCADE,
  participant_ref text,                  -- CDP profile 引用/脱敏标识
  action text NOT NULL,                  -- join / share / redeem / refer
  referred_lead boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS activation_participation_idx ON rhautt_nexus.activation_participation (tenant_id, activity_id, action);

ALTER TABLE rhautt_nexus.activation_activity ENABLE ROW LEVEL SECURITY;
ALTER TABLE rhautt_nexus.activation_participation ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS activation_activity_tenant_isolation ON rhautt_nexus.activation_activity;
CREATE POLICY activation_activity_tenant_isolation ON rhautt_nexus.activation_activity
  USING (tenant_id = rhautt_nexus.current_tenant_id()) WITH CHECK (tenant_id = rhautt_nexus.current_tenant_id());
DROP POLICY IF EXISTS activation_participation_tenant_isolation ON rhautt_nexus.activation_participation;
CREATE POLICY activation_participation_tenant_isolation ON rhautt_nexus.activation_participation
  USING (tenant_id = rhautt_nexus.current_tenant_id()) WITH CHECK (tenant_id = rhautt_nexus.current_tenant_id());

ALTER TABLE rhautt_nexus.activation_activity FORCE ROW LEVEL SECURITY;
ALTER TABLE rhautt_nexus.activation_participation FORCE ROW LEVEL SECURITY;
